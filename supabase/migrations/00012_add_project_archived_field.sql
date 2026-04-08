-- 添加项目归档字段
ALTER TABLE projects ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE;

-- 添加归档时间字段
ALTER TABLE projects ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_projects_is_archived ON projects(is_archived);

-- 更新RLS策略，确保归档项目也能被查询
-- 已有的SELECT策略会自动包含is_archived字段
