-- ==============================================================================
-- Module 2: Matchmaking & Networking Schema (Sprint 3.5)
-- Identifies 4 Bounded Contexts: Identity, Membership, Networking, Teams
-- ==============================================================================

-- 1. Identity & Skills (Replaces JSONB/Enum hardcoded lists)
CREATE TABLE IF NOT EXISTS skill_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS skills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID NOT NULL REFERENCES skill_categories(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL UNIQUE,
    slug VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_skills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL, -- references global users
    skill_id UUID NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
    experience_level VARCHAR(50), -- e.g., 'Beginner', 'Intermediate', 'Expert'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, skill_id)
);

-- 2. Team Requirements (Matchmaking preferences)
CREATE TABLE IF NOT EXISTS team_required_skills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL, -- references teams
    skill_id UUID NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(team_id, skill_id)
);

-- Note: We could add team_preferred_roles and team_preferred_languages similarly if we extract those out of enums

-- 3. Networking & Workflows
CREATE TABLE IF NOT EXISTS team_join_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL, -- references teams
    user_id UUID NOT NULL, -- references global users / event members
    event_id UUID NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING', -- PENDING, APPROVED, REJECTED, CANCELED
    message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(team_id, user_id)
);

CREATE TABLE IF NOT EXISTS team_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL,
    user_id UUID NOT NULL,
    event_id UUID NOT NULL,
    invited_by UUID NOT NULL, -- captain who sent the invite
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING', -- PENDING, ACCEPTED, DECLINED, CANCELED
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(team_id, user_id)
);

-- 4. Advanced Networking & Matchmaking
CREATE TABLE IF NOT EXISTS saved_searches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    event_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    filters JSONB NOT NULL DEFAULT '{}'::jsonb, -- e.g. { "skills": [...], "timezone": "GMT+8" }
    notify_me BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS matchmaking_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID NOT NULL,
    team_id UUID NOT NULL,
    event_id UUID NOT NULL,
    score DECIMAL(5,2) NOT NULL, -- 0.00 to 100.00
    breakdown JSONB NOT NULL DEFAULT '{}'::jsonb, -- { "skills": 35, "role": 20 }
    generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    version INT NOT NULL DEFAULT 1,
    UNIQUE(member_id, team_id)
);
