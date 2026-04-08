-- 删除旧表
DROP TABLE IF EXISTS role_permissions CASCADE;
DROP TABLE IF EXISTS permission_definitions CASCADE;

-- 创建权限定义表
CREATE TABLE permission_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(100) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  parent_id UUID,
  module VARCHAR(50) NOT NULL,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 添加外键约束
ALTER TABLE permission_definitions
  ADD CONSTRAINT fk_parent
  FOREIGN KEY (parent_id)
  REFERENCES permission_definitions(id)
  ON DELETE CASCADE;

-- 创建角色权限关联表
CREATE TABLE role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_code VARCHAR(50) NOT NULL,
  permission_code VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(role_code, permission_code)
);

-- 添加索引
CREATE INDEX idx_permission_definitions_parent ON permission_definitions(parent_id);
CREATE INDEX idx_permission_definitions_module ON permission_definitions(module);
CREATE INDEX idx_permission_definitions_code ON permission_definitions(code);
CREATE INDEX idx_role_permissions_role ON role_permissions(role_code);
CREATE INDEX idx_role_permissions_permission ON role_permissions(permission_code);

-- 添加注释
COMMENT ON TABLE permission_definitions IS '系统权限定义表';
COMMENT ON TABLE role_permissions IS '角色权限关联表';

-- RLS策略
ALTER TABLE permission_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "所有人可查看权限定义" ON permission_definitions FOR SELECT USING (true);
CREATE POLICY "管理员可管理权限定义" ON permission_definitions FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('super_admin', 'system_admin'))
);

CREATE POLICY "所有人可查看角色权限" ON role_permissions FOR SELECT USING (true);
CREATE POLICY "管理员可管理角色权限" ON role_permissions FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('super_admin', 'system_admin'))
);