-- 创建投标信息表
CREATE TABLE IF NOT EXISTS bids (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_name VARCHAR(200) NOT NULL,
  bid_date DATE NOT NULL,
  bid_amount DECIMAL(15,2),
  bid_result VARCHAR(50) DEFAULT 'pending',
  won_amount DECIMAL(15,2),
  won_date DATE,
  remarks TEXT,
  attachments JSONB DEFAULT '[]',
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 添加索引
CREATE INDEX IF NOT EXISTS idx_bids_project_name ON bids(project_name);
CREATE INDEX IF NOT EXISTS idx_bids_bid_date ON bids(bid_date DESC);
CREATE INDEX IF NOT EXISTS idx_bids_result ON bids(bid_result);
CREATE INDEX IF NOT EXISTS idx_bids_created_by ON bids(created_by);

-- 添加注释
COMMENT ON TABLE bids IS '投标与中标信息表';
COMMENT ON COLUMN bids.bid_result IS '投标结果: pending-待定, won-中标, lost-未中标';

-- RLS策略
ALTER TABLE bids ENABLE ROW LEVEL SECURITY;

-- 所有人可查看
CREATE POLICY "所有人可查看投标信息" ON bids
  FOR SELECT
  USING (true);

-- 资料员、管理员可创建
CREATE POLICY "资料员和管理员可创建投标信息" ON bids
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('super_admin', 'system_admin', 'data_clerk')
    )
  );

-- 资料员、管理员可更新
CREATE POLICY "资料员和管理员可更新投标信息" ON bids
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('super_admin', 'system_admin', 'data_clerk')
    )
  );

-- 管理员可删除
CREATE POLICY "管理员可删除投标信息" ON bids
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('super_admin', 'system_admin')
    )
  );

-- 插入示例数据
INSERT INTO bids (project_name, bid_date, bid_amount, bid_result, won_amount, won_date, remarks) VALUES
  ('某市政道路工程项目', '2026-01-15', 5000, 'won', 4800, '2026-01-20', '成功中标，项目周期6个月'),
  ('某商业综合体建设项目', '2026-02-10', 8000, 'won', 7500, '2026-02-15', '大型项目，预计工期12个月'),
  ('某住宅小区配套工程', '2026-03-05', 3000, 'lost', NULL, NULL, '价格因素未中标'),
  ('某工业园区基础设施项目', '2026-03-20', 6000, 'pending', NULL, NULL, '评标中，预计4月初公布结果')
ON CONFLICT DO NOTHING;