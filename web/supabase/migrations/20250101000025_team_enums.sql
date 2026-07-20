-- Migration: 20250101000025_team_enums.sql
-- Description: Create the ENUMs for Module 3 Teams & Matchmaking domain.

-- Create enums if they don't exist
DO $$ BEGIN
    CREATE TYPE public.team_lifecycle_state AS ENUM ('Draft', 'Recruiting', 'Ready', 'Locked', 'Archived');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.team_visibility AS ENUM ('Public', 'Workspace', 'Private');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.team_membership_status AS ENUM ('Active', 'Invited', 'Pending', 'Left', 'Removed', 'Transferred');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.join_request_status AS ENUM ('Pending', 'Accepted', 'Rejected', 'Withdrawn', 'Expired');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.team_invitation_status AS ENUM ('Pending', 'Accepted', 'Declined', 'Cancelled', 'Expired');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.team_activity_action AS ENUM (
        'TEAM_CREATED', 'MEMBER_JOINED', 'MEMBER_LEFT', 'CAPTAIN_CHANGED', 
        'ROLE_UPDATED', 'SUBMISSION_STARTED', 'SUBMISSION_COMPLETED', 
        'TEAM_ARCHIVED', 'JOIN_REQUEST_CREATED', 'JOIN_REQUEST_APPROVED', 
        'JOIN_REQUEST_REJECTED', 'INVITATION_SENT', 'INVITATION_ACCEPTED', 
        'INVITATION_DECLINED', 'FILE_UPLOADED', 'LINK_ADDED', 'SETTINGS_UPDATED'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.team_link_type AS ENUM ('GitHub', 'Figma', 'Devpost', 'Documentation', 'Demo', 'Video', 'Slides', 'Website');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.experience_level AS ENUM ('Junior', 'Mid', 'Senior');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.file_status AS ENUM ('Uploading', 'Uploaded', 'Scanning', 'Ready', 'Failed', 'Deleted');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.activity_source AS ENUM ('API', 'WEB', 'SYSTEM', 'CRON', 'ADMIN');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
