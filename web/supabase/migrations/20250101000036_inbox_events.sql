CREATE TABLE IF NOT EXISTS inbox_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL,
  event_type VARCHAR(255) NOT NULL,
  aggregate_id UUID NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  status VARCHAR(50) NOT NULL DEFAULT 'Pending', -- Pending, Processed, Failed
  retry_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  
  CONSTRAINT inbox_events_event_id_unique UNIQUE (event_id)
);

CREATE INDEX idx_inbox_events_status ON inbox_events(status);

-- RLS
ALTER TABLE inbox_events ENABLE ROW LEVEL SECURITY;

-- No access via APIs, only Service Role
