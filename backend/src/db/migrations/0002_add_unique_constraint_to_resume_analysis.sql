-- Add unique constraint to resume_analysis table
ALTER TABLE resume_analysis ADD CONSTRAINT resume_analysis_user_id_unique UNIQUE (user_id); 