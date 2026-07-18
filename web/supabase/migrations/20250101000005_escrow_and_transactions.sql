-- Migration: escrow_and_transactions
-- Tables: escrow_accounts, transactions
-- Requirements: 2.2, 2.4, 2.7, 4, 8, 9, 19.1, 25.7, 26

-- escrow_accounts — Req 4, 26
-- state CHECK mirrors the 9 canonical EscrowState values in
-- web/types/enums.ts (EscrowStateSchema) exactly.
create table public.escrow_accounts (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null unique references public.events (id) on delete restrict,
  stellar_public_key text not null check (stellar_public_key ~ '^G[A-Z2-7]{55}$'),
  encrypted_secret_key bytea not null,
  state text not null default 'PendingFunding' check (
    state in (
      'PendingFunding',
      'PartiallyFunded',
      'FullyFunded',
      'Locked',
      'PendingRelease',
      'Released',
      'Refunded',
      'Failed',
      'Cancelled'
    )
  ),
  expected_balance numeric not null default 0 check (expected_balance >= 0),
  last_reconciled_balance numeric check (last_reconciled_balance is null or last_reconciled_balance >= 0),
  last_reconciled_block bigint,
  funding_wallet text check (funding_wallet is null or funding_wallet ~ '^G[A-Z2-7]{55}$'),
  inconsistent boolean not null default false,
  version int not null default 0
);

create index idx_escrow_accounts_event_id on public.escrow_accounts (event_id);
create index idx_escrow_accounts_state on public.escrow_accounts (state);

comment on table public.escrow_accounts is
  'Per-event escrow keypair; only the public key is queryable via API (Req 4.2). Secret key is KMS-envelope-encrypted and never exposed to read APIs.';
comment on column public.escrow_accounts.encrypted_secret_key is
  'KMS-envelope-encrypted secret key. Deny-by-default RLS is added in task 3.3; never selected by client-facing views.';

-- transactions — Req 4.4, 9.3, 25.7
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete restrict,
  escrow_id uuid references public.escrow_accounts (id) on delete set null,
  type text not null check (type in ('fund', 'disbursement', 'refund', 'escrow_op')),
  tx_hash text not null unique,
  amount numeric not null check (amount >= 0),
  from_address text not null check (from_address ~ '^G[A-Z2-7]{55}$'),
  to_address text not null check (to_address ~ '^G[A-Z2-7]{55}$'),
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'failed')),
  network_mode text not null check (network_mode in ('testnet', 'mainnet')),
  created_at timestamptz not null default now()
);

create index idx_transactions_event_id on public.transactions (event_id);

comment on table public.transactions is
  'On-chain tx_hash is the canonical funding/disbursement/refund reference (Req 4.4).';
