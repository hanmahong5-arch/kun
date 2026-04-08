
-- 添加项目表的新字段
ALTER TABLE projects ADD COLUMN IF NOT EXISTS project_overview TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS engineering_type TEXT CHECK (engineering_type IN ('市政', '水利', '公路', '新能源', '房建', '其他'));

-- 创建项目跟踪记录表
CREATE TABLE IF NOT EXISTS project_tracking_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  tracking_content TEXT NOT NULL,
  updated_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 项目跟踪记录表的RLS策略
ALTER TABLE project_tracking_records ENABLE ROW LEVEL SECURITY;

-- 所有认证用户可以查看跟踪记录
CREATE POLICY "authenticated_users_can_view_tracking_records"
ON project_tracking_records
FOR SELECT
TO authenticated
USING (true);

-- 认证用户可以创建跟踪记录
CREATE POLICY "authenticated_users_can_create_tracking_records"
ON project_tracking_records
FOR INSERT
TO authenticated
WITH CHECK (true);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_project_tracking_project_id ON project_tracking_records(project_id);
CREATE INDEX IF NOT EXISTS idx_project_tracking_created_at ON project_tracking_records(created_at DESC);

COMMENT ON TABLE project_tracking_records IS '项目跟踪记录表';
COMMENT ON COLUMN projects.project_overview IS '工程概况';
COMMENT ON COLUMN projects.engineering_type IS '工程类型：市政、水利、公路、新能源、房建、其他';
COMMENT ON COLUMN project_tracking_records.tracking_content IS '跟踪进展内容';
COMMENT ON COLUMN project_tracking_records.updated_by IS '更新人ID';
