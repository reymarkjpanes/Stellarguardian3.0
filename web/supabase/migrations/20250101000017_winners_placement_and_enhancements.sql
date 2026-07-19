-- Migration: Add placement column to winners + enhance for future upgrades
-- Fixes: "Could not find the 'placement' column of 'winners' in the schema cache"

-- Add placement column for ranking winners (1st, 2nd, 3rd...)
alter table public.winners
  add column if not exists placement int;

-- Add created_at for tracking when winners were assigned
alter table public.winners
  add column if not exists created_at timestamptz not null default now();

-- Add notes field for organizer comments on winner selection
alter table public.winners
  add column if not exists notes text;

-- Index for efficient queries by event + placement
create index if not exists idx_winners_event_placement
  on public.winners (event_id, placement)
  where placement is not null;

-- Add event_id column to evaluations (was missing - needed for direct event queries)
-- Check if it exists first via a DO block
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'evaluations'
      and column_name = 'event_id'
  ) then
    alter table public.evaluations add column event_id uuid references public.events(id) on delete cascade;
    create index idx_evaluations_event_id on public.evaluations (event_id);
  end if;
end $$;

comment on column public.winners.placement is
  'Ranking position (1=first place, 2=second, etc). Nullable for unranked prizes.';
