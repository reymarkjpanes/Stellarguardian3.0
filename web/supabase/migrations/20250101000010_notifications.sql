-- Migration: notifications
-- Tables: notifications, notification_preferences
-- Requirements: 2.2, 2.4, 2.5, 2.7, 16, 19.1, 28
--
-- Adding these tables to the supabase_realtime publication (Req 2.5, 28.2)
-- is a deploy-time/RLS-adjacent concern handled alongside task 3.3, which
-- also configures the publication for events and teams.

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  category text not null check (char_length(category) > 0),
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  priority text not null default 'normal' check (priority in ('urgent', 'normal')),
  created_at timestamptz not null default now()
);

create index idx_notifications_user_id on public.notifications (user_id);
create index idx_notifications_created_at on public.notifications (created_at);

create table public.notification_preferences (
  user_id uuid not null references public.users (id) on delete cascade,
  category text not null check (char_length(category) > 0),
  email_enabled boolean not null default true,
  primary key (user_id, category)
);
