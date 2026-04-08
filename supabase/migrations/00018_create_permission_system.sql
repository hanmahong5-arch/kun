-- 创建权限类型枚举
CREATE TYPE permission_type AS ENUM ('menu', 'operation', 'data');

-- 创建权限项表
CREATE TABLE IF NOT EXISTS permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(100) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  type permission_type NOT NULL,
  description TEXT,
  parent_id UUID REFERENCES permissions(id) ON DELETE CASCADE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建自定义角色表
CREATE TABLE IF NOT EXISTS custom_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  parent_role_id UUID REFERENCES custom_roles(id) ON DELETE SET NULL,
  is_system BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建角色权限关联表
CREATE TABLE IF NOT EXISTS role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID REFERENCES custom_roles(id) ON DELETE CASCADE,
  permission_id UUID REFERENCES permissions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(role_id, permission_id)
);

-- 创建用户角色关联表（扩展现有profiles表）
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS custom_role_id UUID REFERENCES custom_roles(id) ON DELETE SET NULL;

-- 插入默认权限项
INSERT INTO permissions (code, name, type, description, sort_order) VALUES
-- 菜单权限
('menu_home', '首页', 'menu', '访问首页', 1),
('menu_reports', '周报管理', 'menu', '访问周报模块', 2),
('menu_projects', '项目管理', 'menu', '访问项目模块', 3),
('menu_customers', '客户管理', 'menu', '访问客户模块', 4),
('menu_tasks', '任务管理', 'menu', '访问任务模块', 5),
('menu_teams', '小组管理', 'menu', '访问小组模块', 6),
('menu_system', '系统设置', 'menu', '访问系统设置', 7),

-- 操作权限
('op_report_create', '创建周报', 'operation', '创建新周报', 10),
('op_report_edit', '编辑周报', 'operation', '编辑周报', 11),
('op_report_delete', '删除周报', 'operation', '删除周报', 12),
('op_report_export', '导出周报', 'operation', '导出周报数据', 13),
('op_project_create', '创建项目', 'operation', '创建新项目', 20),
('op_project_edit', '编辑项目', 'operation', '编辑项目', 21),
('op_project_delete', '删除项目', 'operation', '删除项目', 22),
('op_customer_create', '创建客户', 'operation', '创建新客户', 30),
('op_customer_edit', '编辑客户', 'operation', '编辑客户', 31),
('op_customer_delete', '删除客户', 'operation', '删除客户', 32),
('op_task_assign', '分配任务', 'operation', '分配任务给他人', 40),
('op_user_manage', '用户管理', 'operation', '管理系统用户', 50),
('op_role_manage', '角色管理', 'operation', '管理角色权限', 51),
('op_team_manage', '小组管理', 'operation', '管理小组', 52),

-- 数据权限
('data_all', '全部数据', 'data', '查看所有数据', 100),
('data_team', '小组数据', 'data', '查看本小组数据', 101),
('data_self', '个人数据', 'data', '仅查看个人数据', 102)
ON CONFLICT (code) DO NOTHING;

-- 插入系统默认角色
INSERT INTO custom_roles (code, name, description, is_system) VALUES
('super_admin', '超级管理员', '系统最高权限', TRUE),
('system_admin', '系统管理员', '系统配置管理', TRUE),
('leader', '公司领导', '查看决策、目标管控', TRUE),
('market_staff', '经营中心人员', '一线填报、业务执行', TRUE),
('data_clerk', '资料员', '内勤归档、数据补录', TRUE)
ON CONFLICT (code) DO NOTHING;

-- 为超级管理员分配所有权限
INSERT INTO role_permissions (role_id, permission_id)
SELECT 
  (SELECT id FROM custom_roles WHERE code = 'super_admin'),
  id
FROM permissions
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_permissions_type ON permissions(type);
CREATE INDEX IF NOT EXISTS idx_permissions_parent ON permissions(parent_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_permission ON role_permissions(permission_id);
CREATE INDEX IF NOT EXISTS idx_profiles_custom_role ON profiles(custom_role_id);

-- RLS策略
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;

-- 管理员可以查看和管理权限
CREATE POLICY "admins_can_manage_permissions" ON permissions
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('super_admin', 'system_admin')
  )
);

CREATE POLICY "admins_can_manage_roles" ON custom_roles
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('super_admin', 'system_admin')
  )
);

CREATE POLICY "admins_can_manage_role_permissions" ON role_permissions
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('super_admin', 'system_admin')
  )
);

-- 所有用户可以查看自己的角色权限
CREATE POLICY "users_can_view_own_role_permissions" ON role_permissions
FOR SELECT TO authenticated
USING (
  role_id IN (
    SELECT custom_role_id FROM profiles WHERE id = auth.uid()
  )
);