-- Migration: users_and_wallets
-- Tables: users, wallets, wallet_challenges
-- Requirements: 2.2, 2.4, 2.7, 5.1, 5.5, 5.6, 25, 33.15, 34.1
--
-- `users` extends Supabase `auth.users` (design.md Core Tables: users). RLS
-- and append-only/permission enforcement are added in task 3.3.

create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 120),
  email text not null,
  deactivated_at timestamptz,
  terms_accepted_version text,
  terms_accepted_at timestamptz,
  created_at timestamptz not null default now()
);

comment on table public.users is
  'Public profile fields extending auth.users (Req 34.1 terms acceptance).';

-- wallets — Req 5, 25, 33.15
create table public.wallets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  public_key text not null check (public_key ~ '^G[A-Z2-7]{55}$'),
  provider text not null check (char_length(provider) > 0),
  verification_status text not null default 'Unverified'
    check (verification_status in ('Unverified', 'Pending', 'Verified')),
  verified_at timestamptz,
  network_mode text not null check (network_mode in ('testnet', 'mainnet')),
  constraint wallets_user_public_key_unique unique (user_id, public_key)
);

create index idx_wallets_user_id on public.wallets (user_id);

comment on table public.wallets is
  'Wallet ownership records; promoted to Verified only via completed challenge-response (Req 5.6).';

-- wallet_challenges — Req 5.1, 5.5
create table public.wallet_challenges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  claimed_public_key text not null check (claimed_public_key ~ '^G[A-Z2-7]{55}$'),
  nonce bytea not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_wallet_challenges_user_id on public.wallet_challenges (user_id);
create index idx_wallet_challenges_expires_at on public.wallet_challenges (expires_at);

comment on table public.wallet_challenges is
  '32-byte nonce challenges with a 5-minute expiry window (Req 5.1, 5.5).';
