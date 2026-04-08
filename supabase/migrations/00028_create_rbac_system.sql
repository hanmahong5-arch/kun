-- 创建角色表
CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  is_system BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建用户-角色关联表
CREATE TABLE IF NOT EXISTS user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES profiles(id),
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, role_id)
);

-- 创建审计日志表
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id),
  action VARCHAR(50) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id UUID,
  old_value JSONB,
  new_value JSONB,
  ip_address VARCHAR(50),
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 添加索引
CREATE INDEX IF NOT EXISTS idx_user_roles_user ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles(role_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);

-- 添加注释
COMMENT ON TABLE roles IS '角色定义表';
COMMENT ON TABLE user_roles IS '用户-角色关联表（多对多）';
COMMENT ON TABLE audit_logs IS '审计日志表';
COMMENT ON COLUMN roles.is_system IS '是否为系统预置角色（不可删除）';
COMMENT ON COLUMN user_roles.assigned_by IS '分配该角色的管理员ID';

-- RLS策略
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- 所有人可查看角色
CREATE POLICY "所有人可查看角色" ON roles FOR SELECT USING (true);

-- 管理员可管理角色
CREATE POLICY "管理员可管理角色" ON roles FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('super_admin', 'system_admin'))
);

-- 用户可查看自己的角色关联
CREATE POLICY "用户可查看自己的角色" ON user_roles FOR SELECT USING (
  user_id = auth.uid() OR
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('super_admin', 'system_admin'))
);

-- 管理员可管理用户角色
CREATE POLICY "管理员可管理用户角色" ON user_roles FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('super_admin', 'system_admin'))
);

-- 用户可查看自己的审计日志
CREATE POLICY "用户可查看自己的日志" ON audit_logs FOR SELECT USING (
  user_id = auth.uid() OR
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('super_admin', 'system_admin'))
);

-- 系统可插入审计日志
CREATE POLICY "系统可插入日志" ON audit_logs FOR INSERT WITH CHECK (true);

-- 插入预置角色
INSERT INTO roles (code, name, description, is_system, is_active) VALUES
('super_admin', '超级管理员', '拥有系统所有权限，可管理所有功能和用户', true, true),
('system_admin', '系统管理员', '可管理用户、角色和系统配置', true, true),
('leader', '公司领导', '可查看所有数据和报表，审阅工作汇报', true, true),
('data_clerk', '资料员', '可管理文档、投标等资料', true, true),
('market_staff', '经营人员', '可管理项目、客户和工作汇报', true, true)
ON CONFLICT (code) DO NOTHING;

-- 更新role_permissions表，使用role_id替代role_code
ALTER TABLE role_permissions DROP CONSTRAINT IF EXISTS role_permissions_role_code_permission_code_key;
ALTER TABLE role_permissions ADD COLUMN IF NOT EXISTS role_id UUID REFERENCES roles(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_role_permissions_role_id ON role_permissions(role_id);

-- 迁移现有role_permissions数据
UPDATE role_permissions rp
SET role_id = r.id
FROM roles r
WHERE rp.role_code = r.code AND rp.role_id IS NULL;

-- 添加唯一约束
ALTER TABLE role_permissions ADD CONSTRAINT role_permissions_role_id_permission_code_key UNIQUE(role_id, permission_code);