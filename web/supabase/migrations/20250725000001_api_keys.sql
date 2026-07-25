-- API Keys table for public V1 API authentication (Req 32.2)
-- Keys are stored as SHA-256 hashes — never in plaintext.
CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Default',
  key_hash TEXT NOT NULL UNIQUE,
  key_prefix TEXT NOT NULL, -- first 8 chars of the key for identification (e.g. "sg_live_")
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  rate_limit INTEGER NOT NULL DEFAULT 100, -- requests per minute
  scopes TEXT[] NOT NULL DEFAULT ARRAY['events:read'], -- allowed API scopes
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES auth.users(id)
);

-- Index for fast hash lookups
CREATE INDEX idx_api_keys_key_hash ON api_keys(key_hash);
CREATE INDEX idx_api_keys_workspace ON api_keys(workspace_id);

-- RLS: Only workspace admins/owners can manage API keys
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace admins can manage API keys"
  ON api_keys FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = api_keys.workspace_id
      AND wm.user_id = auth.uid()
      AND wm.role IN ('Owner', 'WorkspaceAdmin')
    )
  );

-- Service role can always access (for API key validation in route handlers)
CREATE POLICY "Service role full access to api_keys"
  ON api_keys FOR ALL
  USING (auth.role() = 'service_role');
