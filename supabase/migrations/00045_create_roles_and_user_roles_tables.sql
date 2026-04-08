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

-- 添加索引
CREATE INDEX IF NOT EXISTS idx_user_roles_user ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles(role_id);

-- 添加注释
COMMENT ON TABLE roles IS '角色定义表';
COMMENT ON TABLE user_roles IS '用户-角色关联表（多对多）';
COMMENT ON COLUMN roles.is_system IS '是否为系统预置角色（不可删除）';
COMMENT ON COLUMN user_roles.assigned_by IS '分配该角色的管理员ID';

-- RLS策略
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

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

-- 插入系统预置角色
INSERT INTO roles (code, name, description, is_system, is_active) VALUES
  ('system_admin', '系统管理员', '拥有系统全部权限，可管理所有用户和数据', true, true),
  ('department_admin', '部门管理员', '管理本部门用户和数据', true, true),
  ('project_manager', '项目经理', '管理项目和任务', true, true),
  ('team_leader', '小组长', '管理小组成员和任务', true, true),
  ('normal_user', '普通用户', '基础用户权限', true, true)
ON CONFLICT (code) DO NOTHING;