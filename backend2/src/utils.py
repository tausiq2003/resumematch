import asyncio
import os
import regex as re
from urllib.parse import urlparse
import magic
from flask import jsonify
from config import Config
import pandas as pd
import csv
from werkzeug.utils import secure_filename
import pdfplumber
import stopwordsiso
import logging
from rapidfuzz import process as rf_process
from rapidfuzz.fuzz import ratio
from datetime import datetime, timedelta, timezone
from .fetchers.jsearch import fetch_jobs_jsearch
from .fetchers.scraper import fetch_jobs_scraper

# Logger
logger = logging.getLogger(__name__)
delimiters = r'[,;.]+'


def preprocess_text(text):
    """Efficient text preprocessing: convert to lowercase, replace non-alphanumeric chars, reduce spaces."""
    if not text:
        return ''
    return re.sub(r'[^\p{L}\p{N}]+', ' ', text.lower()).strip()


stopwords_cache = {}


def remove_stopwords(text_list, lang_code, fallback_lang='en'):
    """Remove stopwords from a list of texts based on detected language."""
    if lang_code not in stopwords_cache:
        if stopwordsiso.has_lang(lang_code):
            stopwords_cache[lang_code] = set(stopwordsiso.stopwords(lang_code))
        elif stopwordsiso.has_lang(fallback_lang):
            logger.warning(
                f"Stopwords for '{lang_code}' not found. Using fallback: {fallback_lang}.")
            stopwords_cache[lang_code] = set(
                stopwordsiso.stopwords(fallback_lang))
        else:
            logger.warning(
                f"Neither '{lang_code}' nor fallback '{fallback_lang}' have stopword lists.")
            return text_list

    stopwords = stopwords_cache[lang_code]

    return [
        ' '.join([word for word in text.split() if word not in stopwords])
        for text in text_list
    ]


def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in Config.ALLOWED_EXTENSIONS


def get_file_mime_type(file_path):
    return magic.from_file(file_path, mime=True)


def extract_text_from_pdf(file_path):
    """Extracts text from different file formats based on MIME type."""
    with pdfplumber.open(file_path) as pdf:
        return ' '.join([page.extract_text() for page in pdf.pages if page.extract_text()])


def validate_and_clean_input(form, files):
    """Validates and cleans form inputs and file uploads."""
    job_position = preprocess_text(form.get('job_position', '').strip())
    logger.info("bar1")
    # Handle country field more safely
    country_field = form.get('country', '').strip()
    logger.info("bar2")
    if ',' in country_field:
        country_name, country_code = country_field.split(',', 1)
        country_name = country_name.strip()
        country_code = country_code.strip()
    else:
        country_name = country_field
        # Use first two letters as code
        country_code = country_field[:2].upper()
    logger.info("bar3")

    region = form.get('region', '').strip().split(',')[0]

    # Combine all keywords into a single search query
    preferred_keywords_pure = [k.strip() for k in re.split(delimiters, form.get('preferred_keywords', ''))]
    search_terms = [job_position] + preferred_keywords_pure
    search_query = ' '.join(set(search_terms))  # Use unique terms
    
    # Keep preferred keywords for ranking
    preferred_keywords = preferred_keywords_pure + [job_position]
    preferred_keywords += [word for phrase in preferred_keywords for word in phrase.split()]
    preferred_keywords = list(set(preferred_keywords))
    preferred_keywords += preferred_keywords_pure
    preferred_keywords = [s for s in preferred_keywords if s]

    exclude_keywords = [preprocess_text(k.strip()) for k in re.split(
        delimiters, form.get('exclude_keywords', ''))]
    if exclude_keywords == ['']:
        exclude_keywords = []

    interval = form.get('posted_since', 'month')
    logger.info(country_name)

    if not job_position:
        return jsonify({'error': 'Job titles are required and cannot be empty or gibberish'}), 400
    if not country_name:
        return jsonify({'error': 'Location is required and cannot be empty or gibberish'}), 400

    file = files.get('resume', None)
    if file:
        if not allowed_file(file.filename):
            return jsonify({'error': 'Unsupported CV file extension'}), 400
        filename = secure_filename(file.filename)
        file_path = os.path.join(Config.UPLOAD_FOLDER, filename)
        file.save(file_path)

        mime_type = get_file_mime_type(file_path)
        if mime_type not in Config.ALLOWED_MIME_TYPES:
            os.remove(file_path)
            return jsonify({'error': 'Unsupported CV file type'}), 400

        try:
            raw_resume_text = extract_text_from_pdf(file_path)
        finally:
            os.remove(file_path)

        resume_text = preprocess_text(raw_resume_text)
        resume_text = ' '.join(resume_text.split()[:Config.CV_TEXT_LIMIT])
        if not resume_text:
            return jsonify({'error': 'CV file is empty or contains invalid content'}), 400
    else:
        resume_text = ' '.join(preferred_keywords)

    return {
        'job_position': job_position,
        'country': {'name': country_name, 'code': country_code},
        'region': region,
        'interval': interval,
        'resume_text': resume_text,
        'preferred_keywords': preferred_keywords,
        'exclude_keywords': exclude_keywords
    }


def dump_ranked_jobs(ranked_jobs_df, file_path):
    ranked_jobs_df.to_csv(
        file_path, quoting=csv.QUOTE_NONNUMERIC, escapechar="\\", index=False)


def extract_domain(url):
    parsed_url = urlparse(url)
    domain = parsed_url.netloc.split('.')[-2]
    return domain.capitalize()


def clean_url(url):
    parsed_url = urlparse(url)
    if 'indeed' in parsed_url.netloc or 'talent' in parsed_url.netloc:
        query_params = parsed_url.query.split('&')
        first_param = query_params[0] if query_params else ''
        base_url = f"{parsed_url.scheme}://{parsed_url.netloc}{parsed_url.path}"
        return f"{base_url}?{first_param}" if first_param else base_url
    if 'linkedin' in parsed_url.netloc:
        netloc_parts = parsed_url.netloc.split('.')
        if len(netloc_parts) > 2:
            netloc = '.'.join(netloc_parts[-2:])
            return f"{parsed_url.scheme}://{netloc}{parsed_url.path}"
    return url.split('?')[0]


async def fetch_jobs_unified(search_terms, location, radius, interval, fetch_from=None):
    """Fetch jobs from multiple sources concurrently with improved logging"""
    sources = fetch_from if fetch_from else ["scraper", "jsearch"]
    jobs_df_list = []
    
    logger.info(f"Starting job fetch from sources: {sources}")

    # Run fetchers concurrently
    async def fetch_all():
        tasks = []
        if "scraper" in sources:
            tasks.append(fetch_jobs_scraper(search_terms, location, radius, interval))
        if "jsearch" in sources:
            tasks.append(fetch_jobs_jsearch(search_terms, location, radius, interval))
        return await asyncio.gather(*tasks, return_exceptions=True)

    try:
        results = await fetch_all()
        
        for source, result in zip(sources, results):
            if isinstance(result, Exception):
                logger.error(f"Error fetching jobs from {source}: {result}")
                continue
            if isinstance(result, pd.DataFrame) and not result.empty:
                logger.info(f"Received {len(result)} jobs from {source}")
                jobs_df_list.append(result)

    except Exception as e:
        logger.error(f"Error in fetch_jobs_unified: {e}")
        return pd.DataFrame()

    if not jobs_df_list:
        logger.warning("No jobs found from any source")
        return pd.DataFrame()

    # Merge results efficiently
    initial_count = sum(len(df) for df in jobs_df_list)
    merged_df = pd.concat(jobs_df_list, ignore_index=True)
    
    # Efficient deduplication
    merged_df = merged_df.drop_duplicates(
        subset=['title', 'company', 'job_url'], 
        keep='first'
    ).reset_index(drop=True)
    
    final_count = len(merged_df)
    logger.info(f"Total jobs after merging and deduplication: {final_count} (removed {initial_count - final_count} duplicates)")
    
    # Log sample of results
    if not merged_df.empty:
        sample = merged_df[['title', 'company', 'date_posted']].head(3)
        logger.info(f"Sample of results:\n{sample}")
    
    return merged_df


def process_job_dataframe(jobs_df):
    if jobs_df.empty:
        return jobs_df

    # Process only required columns
    required_cols = ['title', 'company', 'description', 'job_url', 'date_posted', 'source']
    jobs_df = jobs_df[required_cols].copy()

    # Format date efficiently
    jobs_df['date_posted'] = pd.to_datetime(jobs_df['date_posted'], errors='coerce', utc=True)
    jobs_df['date_posted'] = jobs_df['date_posted'].fillna(pd.Timestamp.now(tz='UTC'))
    jobs_df['date_posted'] = jobs_df['date_posted'].dt.strftime('%b %d')
    
    # Handle missing values efficiently
    jobs_df['display_title'] = jobs_df['title'].fillna('Unknown').str.strip()
    jobs_df['display_company'] = jobs_df['company'].fillna('Unknown').str.strip().str.title()
    
    # Vectorized text preprocessing
    jobs_df['title'] = jobs_df['display_title'].apply(preprocess_text)
    jobs_df['description'] = jobs_df['description'].fillna('').apply(preprocess_text)
    jobs_df['description'] = jobs_df['title'] + ' ' + jobs_df['description']
    jobs_df['company'] = jobs_df['display_company'].apply(preprocess_text)

    # Process apply options efficiently
    def create_apply_option(row):
        if pd.notna(row.get('job_url')):
            publisher = row.get('source', 'Unknown')
            if pd.notna(publisher):
                publisher = publisher.capitalize()
            else:
                publisher = 'Unknown'
            return [{'apply_link': row['job_url'], 'publisher': publisher}]
        return []

    jobs_df['apply_options'] = jobs_df.apply(create_apply_option, axis=1)

    # Drop unnecessary columns and rows
    jobs_df = jobs_df.drop(columns=['source', 'job_url'])
    jobs_df = jobs_df.dropna(subset=['display_title', 'display_company'])

    return jobs_df
