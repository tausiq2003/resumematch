# scraper.py
import pandas as pd
from jobspy import scrape_jobs
from config import Config
import logging
import asyncio

logger = logging.getLogger(__name__)


def rename_scraper_columns(df):
    """Standardize column names from jobspy scraper to match the common schema"""
    if df.empty:
        return df

    # Map JobSpy columns to our standard schema
    # Only rename columns that exist in the dataframe
    column_mapping = {
        'job_title': 'title',
        'company_name': 'company',
        'job_location': 'location',
        'job_description': 'description',
        'job_url': 'job_url',
        'posted_date': 'date_posted',
        'job_type': 'job_type'
    }

    # Only rename columns that exist in the dataframe
    columns_to_rename = {k: v for k,
                         v in column_mapping.items() if k in df.columns}
    return df.rename(columns=columns_to_rename)


async def fetch_jobs_scraper(search_terms, location, radius, interval, retries=3, backoff_factor=0.5):
    """Fetch jobs using the JobSpy scraper with concurrent site scraping"""
    all_jobs_df = pd.DataFrame()
    country_name = location.get('name', '')
    country_code = location.get('code', '')
    
    # Run each site concurrently
    async def scrape_site(site):
        try:
            logger.info(f"Starting {site} scraping...")
            jobs_df = scrape_jobs(
                site_name=[site],
                search_term=search_terms if isinstance(search_terms, str) else ' '.join(search_terms),
                location=f"{radius}, {country_name}, {country_code}",
                distance=25,
                results_wanted=Config.RESULTS_WANTED,  # Get full results for each site
                hours_old=Config.INTERVAL_MAPPING.get(interval, 30) * 24,
                country_indeed=country_name,
                linkedin_fetch_description=True,
            )
            
            if jobs_df is not None and not jobs_df.empty:
                logger.info(f"Found {len(jobs_df)} jobs from {site}")
                jobs_df['source'] = site
                return rename_scraper_columns(jobs_df)
            else:
                logger.warning(f"No jobs found from {site}")
            return pd.DataFrame()
        except Exception as e:
            logger.error(f"Error scraping {site}: {e}")
            return pd.DataFrame()

    # Run all sites concurrently
    sites = ["indeed", "linkedin", "google"]
    tasks = [scrape_site(site) for site in sites]
    results = await asyncio.gather(*tasks)
    
    # Combine results
    for site, result in zip(sites, results):
        if not result.empty:
            logger.info(f"Adding {len(result)} jobs from {site}")
            all_jobs_df = pd.concat([all_jobs_df, result], ignore_index=True)
    
    # Remove duplicates
    if not all_jobs_df.empty:
        initial_count = len(all_jobs_df)
        all_jobs_df = all_jobs_df.drop_duplicates(
            subset=['title', 'company', 'job_url'],
            keep='first'
        )
        final_count = len(all_jobs_df)
        logger.info(f"Deduplication: Removed {initial_count - final_count} duplicate jobs")
    
    logger.info(f"Total jobs from scraper: {len(all_jobs_df)}")
    return all_jobs_df
