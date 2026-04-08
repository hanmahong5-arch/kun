-- 创建KPI指标定义表
CREATE TABLE IF NOT EXISTS kpi_indicators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  code VARCHAR(50) UNIQUE NOT NULL,
  category VARCHAR(50) NOT NULL,
  unit VARCHAR(20),
  target_value DECIMAL(15,2),
  warning_threshold DECIMAL(15,2),
  description TEXT,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建KPI数据记录表
CREATE TABLE IF NOT EXISTS kpi_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  indicator_id UUID NOT NULL REFERENCES kpi_indicators(id) ON DELETE CASCADE,
  value DECIMAL(15,2) NOT NULL,
  date DATE NOT NULL,
  period_type VARCHAR(20) DEFAULT 'daily',
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(indicator_id, date, period_type)
);

-- 创建领导仪表盘配置表
CREATE TABLE IF NOT EXISTS leader_dashboards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  config JSONB NOT NULL DEFAULT '{}',
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建报表预警记录表
CREATE TABLE IF NOT EXISTS report_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  indicator_id UUID NOT NULL REFERENCES kpi_indicators(id) ON DELETE CASCADE,
  alert_type VARCHAR(50) NOT NULL,
  threshold DECIMAL(15,2),
  current_value DECIMAL(15,2),
  message TEXT,
  triggered_at TIMESTAMPTZ DEFAULT NOW(),
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ,
  read_by UUID REFERENCES profiles(id)
);

-- 添加索引
CREATE INDEX IF NOT EXISTS idx_kpi_indicators_code ON kpi_indicators(code);
CREATE INDEX IF NOT EXISTS idx_kpi_indicators_category ON kpi_indicators(category);
CREATE INDEX IF NOT EXISTS idx_kpi_data_indicator_date ON kpi_data(indicator_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_kpi_data_date ON kpi_data(date DESC);
CREATE INDEX IF NOT EXISTS idx_leader_dashboards_user ON leader_dashboards(user_id);
CREATE INDEX IF NOT EXISTS idx_report_alerts_triggered ON report_alerts(triggered_at DESC);
CREATE INDEX IF NOT EXISTS idx_report_alerts_unread ON report_alerts(is_read) WHERE is_read = false;

-- 添加注释
COMMENT ON TABLE kpi_indicators IS 'KPI指标定义表';
COMMENT ON TABLE kpi_data IS 'KPI数据记录表';
COMMENT ON TABLE leader_dashboards IS '领导仪表盘配置表';
COMMENT ON TABLE report_alerts IS '报表预警记录表';

-- RLS策略：KPI指标表（领导和管理员可查看）
ALTER TABLE kpi_indicators ENABLE ROW LEVEL SECURITY;

CREATE POLICY "领导和管理员可查看KPI指标" ON kpi_indicators
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('super_admin', 'system_admin', 'leader')
    )
  );

CREATE POLICY "管理员可管理KPI指标" ON kpi_indicators
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('super_admin', 'system_admin')
    )
  );

-- RLS策略：KPI数据表
ALTER TABLE kpi_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "领导和管理员可查看KPI数据" ON kpi_data
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('super_admin', 'system_admin', 'leader')
    )
  );

CREATE POLICY "管理员可管理KPI数据" ON kpi_data
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('super_admin', 'system_admin')
    )
  );

-- RLS策略：领导仪表盘配置表
ALTER TABLE leader_dashboards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "用户可查看自己的仪表盘" ON leader_dashboards
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "用户可管理自己的仪表盘" ON leader_dashboards
  FOR ALL
  USING (user_id = auth.uid());

-- RLS策略：报表预警表
ALTER TABLE report_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "领导和管理员可查看预警" ON report_alerts
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('super_admin', 'system_admin', 'leader')
    )
  );

CREATE POLICY "管理员可管理预警" ON report_alerts
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('super_admin', 'system_admin')
    )
  );

-- 插入示例KPI指标
INSERT INTO kpi_indicators (name, code, category, unit, target_value, warning_threshold, description, display_order) VALUES
  ('合同总额', 'contract_total', 'financial', '万元', 10000, 8000, '年度合同总额目标', 1),
  ('已完成合同额', 'contract_completed', 'financial', '万元', 8000, 6000, '已完成的合同金额', 2),
  ('项目总数', 'project_total', 'project', '个', 100, 80, '在跟进的项目总数', 3),
  ('中标项目数', 'project_won', 'project', '个', 50, 40, '成功中标的项目数量', 4),
  ('客户总数', 'customer_total', 'customer', '个', 200, 150, '活跃客户总数', 5),
  ('新增客户数', 'customer_new', 'customer', '个', 50, 30, '本期新增客户数量', 6),
  ('任务完成率', 'task_completion_rate', 'operation', '%', 95, 80, '任务按时完成率', 7),
  ('周报提交率', 'report_submission_rate', 'operation', '%', 100, 90, '周报按时提交率', 8)
ON CONFLICT (code) DO NOTHING;

-- 插入示例KPI数据（最近30天）
INSERT INTO kpi_data (indicator_id, value, date, period_type)
SELECT 
  i.id,
  CASE 
    WHEN i.code = 'contract_total' THEN 10000
    WHEN i.code = 'contract_completed' THEN 7500 + (random() * 500)::DECIMAL(15,2)
    WHEN i.code = 'project_total' THEN 95 + (random() * 10)::INTEGER
    WHEN i.code = 'project_won' THEN 45 + (random() * 5)::INTEGER
    WHEN i.code = 'customer_total' THEN 180 + (random() * 20)::INTEGER
    WHEN i.code = 'customer_new' THEN 40 + (random() * 10)::INTEGER
    WHEN i.code = 'task_completion_rate' THEN 85 + (random() * 10)::DECIMAL(15,2)
    WHEN i.code = 'report_submission_rate' THEN 90 + (random() * 8)::DECIMAL(15,2)
  END,
  CURRENT_DATE - (generate_series(0, 29) || ' days')::INTERVAL,
  'daily'
FROM kpi_indicators i
WHERE i.is_active = true
ON CONFLICT (indicator_id, date, period_type) DO NOTHING;