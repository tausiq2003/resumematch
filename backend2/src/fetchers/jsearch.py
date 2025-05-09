# jsearch.py
import pandas as pd
import logging
import redis
import time
import asyncio
import aiohttp
import random
from config import Config
from src.date_utils import devise_date_from_human_readable, filter_jobs_by_date

# Constants for JSearch
API_URL = Config.JSEARCH_API_URL
API_HEADERS = {
    "x-rapidapi-key": Config.JSEARCH_API_KEY,
    "x-rapidapi-host": Config.JSEARCH_API_HOST
}
RATE_LIMIT_CALLS = Config.JSEARCH_API_RATE_LIMIT_CALLS
RATE_LIMIT_PERIOD = Config.JSEARCH_API_RATE_LIMIT_PERIOD

logger = logging.getLogger(__name__)

# Initialize Redis connection with error handling
try:
    redis_client = redis.StrictRedis(
        host=Config.REDIS_HOST, port=Config.REDIS_PORT, db=0)
    redis_client.ping()  # Test connection
except redis.exceptions.ConnectionError as e:
    logger.error(f"Redis connection failed: {e}")
    redis_client = None

# Redis key to track API call timestamps
REDIS_KEY = "jsearch_api_call_timestamps"


def rename_jsearch_columns(jobs_df):
    """Standardize column names from JSearch API to match the common schema"""
    if jobs_df.empty:
        return jobs_df

    # Map JSearch columns to our standard schema
    column_mapping = {
        'job_title': 'title',
        'employer_name': 'company',
        'job_city': 'location',
        'job_description': 'description',
        'job_apply_link': 'job_url',
        'job_posted_at_datetime_utc': 'date_posted'
    }

    # Only rename columns that exist in the dataframe
    columns_to_rename = {k: v for k,
                         v in column_mapping.items() if k in jobs_df.columns}
    return jobs_df.rename(columns=columns_to_rename)

# Rate limiting with Redis error handling


async def enforce_rate_limit():
    """Optimized rate limiting with Redis"""
    if not redis_client:
        return
        
    current_time = time.time()
    timestamps = redis_client.lrange(REDIS_KEY, 0, -1)
    timestamps = [float(ts) for ts in timestamps]
    
    # Remove old timestamps
    cutoff_time = current_time - RATE_LIMIT_PERIOD
    timestamps = [ts for ts in timestamps if ts > cutoff_time]
    
    if len(timestamps) >= RATE_LIMIT_CALLS:
        # Calculate wait time
        oldest_timestamp = min(timestamps)
        wait_time = RATE_LIMIT_PERIOD - (current_time - oldest_timestamp)
        if wait_time > 0:
            await asyncio.sleep(wait_time)
    
    # Add current timestamp
    redis_client.lpush(REDIS_KEY, current_time)
    redis_client.ltrim(REDIS_KEY, 0, RATE_LIMIT_CALLS - 1)


def format_time_ago(date_str):
    """Convert a date string to a human-readable 'time ago' format."""
    try:
        date_obj = pd.to_datetime(date_str)
        now = pd.Timestamp.now()
        delta = now - date_obj

        days = delta.days

        if days == 0:
            hours = delta.seconds // 3600
            if hours == 0:
                minutes = delta.seconds // 60
                return f"{minutes} minutes ago" if minutes != 1 else "1 minute ago"
            return f"{hours} hours ago" if hours != 1 else "1 hour ago"
        elif days < 7:
            return f"{days} days ago" if days != 1 else "1 day ago"
        elif days < 30:
            weeks = days // 7
            return f"{weeks} weeks ago" if weeks != 1 else "1 week ago"
        elif days < 365:
            months = days // 30
            return f"{months} months ago" if months != 1 else "1 month ago"
        else:
            years = days // 365
            return f"{years} years ago" if years != 1 else "1 year ago"
    except:
        return "Unknown date"


async def fetch_jobs_for_search_term(session, search_term, country, location, interval, retries=3, backoff_factor=0.5):
    """Fetch jobs for a single search term from JSearch API, with retry and rate limiting."""
    querystring = {
        "query": f"{search_term} in {location}" if location else search_term,
        "country": country['code'],
        "date_posted": interval,
        "num_pages": Config.NUM_SEARCH_PAGES,
    }

    for attempt in range(retries):
        await enforce_rate_limit()  # Ensure rate limit is respected before every attempt
        try:
            async with session.get(API_URL, headers=API_HEADERS, params=querystring) as response:
                if response.status == 200:
                    return await response.json()
                else:
                    logger.warning(
                        f"Error fetching jobs (status {response.status}) for query: {querystring} - Attempt {attempt + 1}/{retries}")
        except Exception as e:
            logger.error(
                f"Error during JSearch API call: {e} - Attempt {attempt + 1}/{retries}")

        # Exponential backoff with jitter
        delay = backoff_factor * (2 ** attempt) + random.uniform(0, 0.1)
        await asyncio.sleep(delay)

    logger.error(
        f"Failed to fetch jobs from JSearch after {retries} attempts.")
    return None


async def fetch_jobs_jsearch(search_terms, country, location, interval):
    """Fetch jobs using JSearch API with optimized rate limiting"""
    if not Config.JSEARCH_API_KEY:
        logger.error("JSearch API key is missing. Skipping JSearch fetching.")
        return pd.DataFrame()

    # Use the combined search query
    search_query = search_terms if isinstance(search_terms, str) else ' '.join(search_terms)
    logger.info(f"Starting JSearch API fetch for query: {search_query}")

    async with aiohttp.ClientSession() as session:
        try:
            data = await fetch_jobs_for_search_term(session, search_query, country, location, interval)
            
            if not data:
                logger.warning("No data received from JSearch API")
                return pd.DataFrame()
                
            # Process results
            if isinstance(data, dict) and 'data' in data:
                jobs_df = pd.DataFrame(data.get('data', []))
                if not jobs_df.empty:
                    logger.info(f"Found {len(jobs_df)} jobs from JSearch API")
                    
                    # Add source column
                    jobs_df['source'] = 'jsearch'

                    # Standardize column names
                    jobs_df = rename_jsearch_columns(jobs_df)

                    # Format and filter dates
                    jobs_df['job_posted_human_readable'] = jobs_df['date_posted'].apply(
                        lambda x: format_time_ago(x) if pd.notna(x) else "today"
                    )
                    jobs_df['job_posted_human_readable'] = jobs_df['job_posted_human_readable'].replace(
                        ['', None, 'Unknown'], 'today').fillna('today')

                    # Apply date filtering if needed
                    day_interval = Config.INTERVAL_MAPPING.get(interval, 30)
                    jobs_df = devise_date_from_human_readable(
                        jobs_df, 'job_posted_human_readable', 'date_posted')
                    jobs_df = filter_jobs_by_date(
                        jobs_df, day_interval, 'date_posted')
                    
                    # Log final results
                    logger.info(f"Final JSearch results after filtering: {len(jobs_df)} jobs")
                    return jobs_df.dropna(how='all').loc[:, jobs_df.notna().any()]
            
            return pd.DataFrame()
            
        except Exception as e:
            logger.error(f"Error in JSearch API call: {e}")
            return pd.DataFrame()
