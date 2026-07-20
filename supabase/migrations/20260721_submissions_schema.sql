-- Migration: Submissions Module (Module 4)

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Submission Requirements (Configurable per event)
CREATE TABLE submission_requirements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    asset_type VARCHAR(50) NOT NULL, -- TEXT, MARKDOWN, URL, FILE, SMART_CONTRACT, VIDEO, IMAGE, PDF, JSON, ZIP
    is_required BOOLEAN DEFAULT false,
    
    -- Rich Validation Metadata
    minimum_files INT DEFAULT 1,
    maximum_files INT DEFAULT 1,
    accepted_file_types VARCHAR(255), -- e.g., "application/pdf,image/png"
    max_size_mb INT,
    validation_regex TEXT,
    default_value TEXT,
    placeholder TEXT,
    help_text TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Submissions Aggregate
CREATE TABLE submissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    
    status VARCHAR(50) NOT NULL DEFAULT 'NOT_STARTED', -- NOT_STARTED, DRAFT, READY, SUBMITTED, LOCKED, UNDER_REVIEW, REVIEWED, FINALIZED, ARCHIVED
    version INT NOT NULL DEFAULT 1, -- Optimistic concurrency
    
    submitted_at TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE (team_id, event_id)
);

-- 3. Submission Assets (Typed values)
CREATE TABLE submission_assets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    submission_id UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
    requirement_id UUID NOT NULL REFERENCES submission_requirements(id) ON DELETE RESTRICT,
    
    asset_type VARCHAR(50) NOT NULL,
    
    -- Typed value columns
    text_value TEXT,
    url_value TEXT,
    storage_path TEXT,
    metadata JSONB, -- Additional metadata like filesize, duration, etc.
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE (submission_id, requirement_id)
);

-- 4. Submission Versions (Snapshots)
CREATE TABLE submission_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    submission_id UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
    version INT NOT NULL,
    snapshot_json JSONB NOT NULL,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(submission_id, version)
);

-- 5. Submission History (Timeline)
CREATE TABLE submission_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    submission_id UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
    actor_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    action VARCHAR(255) NOT NULL,
    details TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Submission Comments (Reviews/Mentoring)
CREATE TABLE submission_comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    submission_id UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    visibility VARCHAR(50) NOT NULL DEFAULT 'PRIVATE', -- PRIVATE, TEAM, PUBLIC
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Submission Locks
CREATE TABLE submission_locks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    submission_id UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
    locked_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    reason TEXT,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. Submission Events (Realtime/Outbox logs)
CREATE TABLE submission_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    submission_id UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
    event_type VARCHAR(100) NOT NULL, -- SUBMISSION_CREATED, AUTO_SAVE, ASSET_ADDED, ASSET_REMOVED, SUBMITTED, LOCKED, REOPENED
    payload JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_sub_req_event ON submission_requirements(event_id);
CREATE INDEX idx_sub_team ON submissions(team_id);
CREATE INDEX idx_sub_event ON submissions(event_id);
CREATE INDEX idx_sub_asset_sub ON submission_assets(submission_id);
CREATE INDEX idx_sub_vers_sub ON submission_versions(submission_id);
CREATE INDEX idx_sub_hist_sub ON submission_history(submission_id);
CREATE INDEX idx_sub_comm_sub ON submission_comments(submission_id);
