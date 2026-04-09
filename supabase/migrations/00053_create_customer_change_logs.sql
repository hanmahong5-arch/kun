-- Customer change logs for timeline feature
-- Records who changed what and when

CREATE TABLE IF NOT EXISTS customer_change_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id),
  action VARCHAR(50) NOT NULL, -- 'create', 'update', 'delete'
  field_name VARCHAR(100), -- which field was changed
  old_value TEXT,
  new_value TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_change_logs_customer ON customer_change_logs(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_change_logs_created ON customer_change_logs(created_at);

-- RLS
ALTER TABLE customer_change_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_can_view_customer_logs" ON customer_change_logs
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "authenticated_can_insert_customer_logs" ON customer_change_logs
  FOR INSERT TO authenticated WITH CHECK (true);

COMMENT ON TABLE customer_change_logs IS 'Customer modification history timeline';
