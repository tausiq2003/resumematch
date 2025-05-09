import pandas as pd
import regex as re
from datetime import datetime, timedelta, timezone
import logging

logger = logging.getLogger(__name__)

def parse_date_string(date_str):
    """Parse various date string formats into datetime object."""
    if not isinstance(date_str, str) or date_str.lower() in ['unknown', 'today']:
        return datetime.now(timezone.utc)
        
    try:
        # Handle "X days/hours/months ago" format
        if "ago" in date_str.lower():
            number = 1
            number_match = re.search(r'\d+', date_str)
            if number_match:
                number = int(number_match.group())
            
            if "day" in date_str:
                return datetime.now(timezone.utc) - timedelta(days=number)
            elif "hour" in date_str:
                return datetime.now(timezone.utc) - timedelta(hours=number)
            elif "month" in date_str:
                return datetime.now(timezone.utc) - timedelta(days=number * 30)
            elif "minute" in date_str:
                return datetime.now(timezone.utc) - timedelta(minutes=number)
                
        # Handle "Month Day" format (e.g., "Apr 30")
        try:
            current_year = datetime.now(timezone.utc).year
            parsed_date = datetime.strptime(f"{date_str} {current_year}", "%b %d %Y")
            
            # If the date is in the future, it's probably from last year
            if parsed_date.replace(tzinfo=timezone.utc) > datetime.now(timezone.utc):
                parsed_date = parsed_date.replace(year=current_year - 1)
                
            return parsed_date.replace(tzinfo=timezone.utc)
        except ValueError:
            pass
            
        # Handle ISO format
        return pd.to_datetime(date_str).tz_localize(timezone.utc)
        
    except Exception as e:
        logger.warning(f"Failed to parse date string: {date_str}, error: {e}")
        return datetime.now(timezone.utc)

def devise_date_from_human_readable(jobs_df, human_readable_date_column_name, date_column_name):
    """Convert human readable dates to datetime objects."""
    jobs_df[date_column_name] = jobs_df[human_readable_date_column_name].apply(parse_date_string)
    
    # Fill missing dates with current time
    jobs_df[date_column_name] = jobs_df[date_column_name].fillna(datetime.now(timezone.utc))
    return jobs_df

def filter_jobs_by_date(jobs_df, day_interval, date_column_name):
    """Filter jobs based on date interval with improved logging."""
    if day_interval <= 0:
        return jobs_df
        
    cutoff_date = datetime.now(timezone.utc) - timedelta(days=day_interval)
    
    # Ensure dates are datetime objects
    jobs_df[date_column_name] = pd.to_datetime(jobs_df[date_column_name], errors='coerce', utc=True)
    
    # Log date range
    logger.info(f"Filtering jobs between {cutoff_date.strftime('%Y-%m-%d')} and {datetime.now(timezone.utc).strftime('%Y-%m-%d')}")
    
    # Filter jobs
    filtered_jobs = jobs_df[jobs_df[date_column_name] >= cutoff_date]
    
    # Log filtering results with more details
    filtered_count = len(filtered_jobs)
    total_count = len(jobs_df)
    logger.info(f"Date filtering: kept {filtered_count}/{total_count} jobs within {day_interval} days")
    
    # Log some example dates for debugging
    if not filtered_jobs.empty:
        sample_dates = filtered_jobs[date_column_name].head(3).dt.strftime('%Y-%m-%d').tolist()
        logger.info(f"Sample dates in filtered results: {sample_dates}")
    
    return filtered_jobs.reset_index(drop=True)
