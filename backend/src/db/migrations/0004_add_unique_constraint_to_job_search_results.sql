-- Add unique constraint to job_search_results table
ALTER TABLE job_search_results ADD CONSTRAINT job_search_results_user_id_unique UNIQUE (user_id); 