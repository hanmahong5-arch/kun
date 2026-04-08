-- 创建功能模块权限配置表
CREATE TABLE IF NOT EXISTS module_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  module_name TEXT NOT NULL,
  can_view BOOLEAN DEFAULT false,
  can_create BOOLEAN DEFAULT false,
  can_edit BOOLEAN DEFAULT false,
  can_delete BOOLEAN DEFAULT false,
  can_export BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, module_name)
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_module_permissions_user_id ON module_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_module_permissions_module_name ON module_permissions(module_name);

-- 启用RLS
ALTER TABLE module_permissions ENABLE ROW LEVEL SECURITY;

-- 创建RLS策略
CREATE POLICY "用户可以查看自己的权限配置"
  ON module_permissions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "系统管理员可以查看所有权限配置"
  ON module_permissions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'system_admin'
    )
  );

CREATE POLICY "系统管理员可以管理权限配置"
  ON module_permissions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'system_admin'
    )
  );

-- 创建更新时间触发器
CREATE OR REPLACE FUNCTION update_module_permissions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_module_permissions_updated_at
  BEFORE UPDATE ON module_permissions
  FOR EACH ROW
  EXECUTE FUNCTION update_module_permissions_updated_at();