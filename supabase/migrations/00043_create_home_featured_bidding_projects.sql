-- 创建首页展示的本月计划开标项目表
CREATE TABLE IF NOT EXISTS home_featured_bidding_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(project_id)
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_home_featured_bidding_display_order ON home_featured_bidding_projects(display_order);
CREATE INDEX IF NOT EXISTS idx_home_featured_bidding_project_id ON home_featured_bidding_projects(project_id);

-- 启用RLS
ALTER TABLE home_featured_bidding_projects ENABLE ROW LEVEL SECURITY;

-- RLS策略
CREATE POLICY "所有人可查看首页展示项目" ON home_featured_bidding_projects FOR SELECT USING (true);
CREATE POLICY "管理员可添加首页展示项目" ON home_featured_bidding_projects FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND role = 'system_admin'
  )
);
CREATE POLICY "管理员可删除首页展示项目" ON home_featured_bidding_projects FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND role = 'system_admin'
  )
);
CREATE POLICY "管理员可更新首页展示项目" ON home_featured_bidding_projects FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND role = 'system_admin'
  )
);