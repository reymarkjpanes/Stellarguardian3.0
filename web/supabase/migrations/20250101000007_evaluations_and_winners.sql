-- Migration: evaluations_and_winners
-- Tables: evaluations, winners
-- Requirements: 2.2, 2.4, 2.7, 8, 11, 19.1

-- evaluations — Req 11
create table public.evaluations (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions (id) on delete cascade,
  judge_id uuid not null references public.users (id) on delete restrict,
  scores jsonb not null,
  conflict_of_interest boolean not null default false,
  created_at timestamptz not null default now(),
  constraint evaluations_unique_submission_judge unique (submission_id, judge_id)
);

create index idx_evaluations_submission_id on public.evaluations (submission_id);
create index idx_evaluations_judge_id on public.evaluations (judge_id);

comment on column public.evaluations.conflict_of_interest is
  'Excluded from averages when true (Req 11.4).';

-- winners — Req 8
create table public.winners (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  recipient_id uuid not null references public.users (id) on delete restrict,
  team_id uuid references public.teams (id) on delete set null,
  prize_amount numeric not null check (prize_amount >= 0),
  disbursement_tx_hash text,
  status text not null default 'pending' check (status in ('pending', 'disbursed', 'held', 'skipped')),
  version int not null default 0
);

create index idx_winners_event_id on public.winners (event_id);
create index idx_winners_recipient_id on public.winners (recipient_id);
