-- Migration: Add standard fields to submissions table
-- Upgrades the submission module to support comprehensive hackathon fields

ALTER TABLE submissions
    ADD COLUMN IF NOT EXISTS title VARCHAR(255),
    ADD COLUMN IF NOT EXISTS short_description VARCHAR(500),
    ADD COLUMN IF NOT EXISTS detailed_description TEXT,
    ADD COLUMN IF NOT EXISTS problem_statement TEXT,
    ADD COLUMN IF NOT EXISTS solution_overview TEXT,
    ADD COLUMN IF NOT EXISTS key_features TEXT,
    ADD COLUMN IF NOT EXISTS tech_stack TEXT[],
    ADD COLUMN IF NOT EXISTS github_url TEXT,
    ADD COLUMN IF NOT EXISTS live_demo_url TEXT,
    ADD COLUMN IF NOT EXISTS video_url TEXT,
    ADD COLUMN IF NOT EXISTS presentation_url TEXT,
    ADD COLUMN IF NOT EXISTS documentation_url TEXT,
    ADD COLUMN IF NOT EXISTS api_docs_url TEXT,
    ADD COLUMN IF NOT EXISTS smart_contract_addresses TEXT[],
    ADD COLUMN IF NOT EXISTS blockchain_explorer_url TEXT,
    ADD COLUMN IF NOT EXISTS deployed_network VARCHAR(100),
    ADD COLUMN IF NOT EXISTS ai_models_used TEXT,
    ADD COLUMN IF NOT EXISTS challenges_faced TEXT,
    ADD COLUMN IF NOT EXISTS future_improvements TEXT,
    ADD COLUMN IF NOT EXISTS additional_notes TEXT,
    ADD COLUMN IF NOT EXISTS screenshots TEXT[],
    ADD COLUMN IF NOT EXISTS categories_entered TEXT[];

-- Optional: Add an index on title for faster searching
CREATE INDEX IF NOT EXISTS idx_submissions_title ON submissions(title);
