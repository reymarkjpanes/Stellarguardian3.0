-- Migration: webhook_endpoints
-- Purpose: Table for webhook configuration per workspace.
-- The webhook.ts service references this table but no prior migration created it.

create table public.webhook_endpoints (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  url text not null check (url ~ '^https://'),
  secret text not null,
  events text[] not null default '{}',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_webhook_endpoints_workspace on public.webhook_endpoints (workspace_id);
create index idx_webhook_endpoints_active on public.webhook_endpoints (workspace_id, active) where active = true;

-- RLS
alter table public.webhook_endpoints enable row level security;

-- Only workspace Owners/Admins can manage webhooks
create policy "Workspace owners can manage webhooks"
  on public.webhook_endpoints
  for all
  using (
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = webhook_endpoints.workspace_id
        and wm.user_id = (select auth.uid())
        and wm.role in ('Owner', 'Admin')
    )
  )
  with check (
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = webhook_endpoints.workspace_id
        and wm.user_id = (select auth.uid())
        and wm.role in ('Owner', 'Admin')
    )
  );

comment on table public.webhook_endpoints is
  'Webhook delivery targets per workspace. URLs must be HTTPS. Secret used for HMAC signature verification.';
