-- Rollback migration 14: files_and_evidence
drop policy if exists "activity_log_read" on public.activity_log;
drop policy if exists "submission_versions_read" on public.submission_versions;
drop policy if exists "dispute_evidence_event_access" on public.dispute_evidence;
drop policy if exists "submission_files_event_access" on public.submission_files;

drop table if exists public.activity_log;
drop table if exists public.submission_versions;
drop table if exists public.dispute_evidence;
drop table if exists public.submission_files;
