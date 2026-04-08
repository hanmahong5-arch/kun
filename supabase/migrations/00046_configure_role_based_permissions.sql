-- 第一步：更新角色表，使用新的5个角色
TRUNCATE TABLE roles CASCADE;

INSERT INTO roles (code, name, description, is_system, is_active) VALUES
  ('super_admin', '超级管理员', '拥有系统全部权限，可管理所有功能和数据', true, true),
  ('company_leader', '公司领导', '查看所有数据和统计报表，审核工作汇报', true, true),
  ('business_center_staff', '经营中心人员', '管理项目、客户、投标等经营业务', true, true),
  ('data_clerk', '资料员', '管理项目资料、文档和基础数据', true, true),
  ('system_admin', '系统管理员', '管理用户、角色和系统配置', true, true);

-- 第二步：创建权限表
CREATE TABLE IF NOT EXISTS permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(100) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  module VARCHAR(50) NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 第三步：创建角色权限关联表
CREATE TABLE IF NOT EXISTS role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(role_id, permission_id)
);

-- 添加索引
CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_permission ON role_permissions(permission_id);
CREATE INDEX IF NOT EXISTS idx_permissions_module ON permissions(module);

-- 添加注释
COMMENT ON TABLE permissions IS '权限定义表';
COMMENT ON TABLE role_permissions IS '角色权限关联表';
COMMENT ON COLUMN permissions.module IS '权限所属模块';

-- RLS策略
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;

-- 所有人可查看权限
CREATE POLICY "所有人可查看权限" ON permissions FOR SELECT USING (true);

-- 管理员可管理权限
CREATE POLICY "管理员可管理权限" ON permissions FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('super_admin', 'system_admin'))
);

-- 所有人可查看角色权限关联
CREATE POLICY "所有人可查看角色权限" ON role_permissions FOR SELECT USING (true);

-- 管理员可管理角色权限关联
CREATE POLICY "管理员可管理角色权限" ON role_permissions FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('super_admin', 'system_admin'))
);

-- 第四步：插入权限数据

-- 项目管理权限
INSERT INTO permissions (code, name, module, description) VALUES
  ('view_projects', '查看项目', 'project_management', '查看项目列表和详情'),
  ('create_project', '创建项目', 'project_management', '创建新项目'),
  ('edit_project', '编辑项目', 'project_management', '编辑项目信息'),
  ('delete_project', '删除项目', 'project_management', '删除项目'),
  ('export_projects', '导出项目', 'project_management', '导出项目数据');

-- 任务管理权限
INSERT INTO permissions (code, name, module, description) VALUES
  ('view_tasks', '查看任务', 'task_management', '查看任务列表和详情'),
  ('create_task', '创建任务', 'task_management', '创建新任务'),
  ('edit_task', '编辑任务', 'task_management', '编辑任务信息'),
  ('delete_task', '删除任务', 'task_management', '删除任务'),
  ('assign_task', '分配任务', 'task_management', '分配任务给用户');

-- 工作汇报权限
INSERT INTO permissions (code, name, module, description) VALUES
  ('view_reports', '查看汇报', 'work_report', '查看工作汇报'),
  ('submit_report', '提交汇报', 'work_report', '提交工作汇报'),
  ('edit_report', '编辑汇报', 'work_report', '编辑工作汇报'),
  ('delete_report', '删除汇报', 'work_report', '删除工作汇报'),
  ('review_report', '审核汇报', 'work_report', '审核工作汇报');

-- 客户管理权限
INSERT INTO permissions (code, name, module, description) VALUES
  ('view_customers', '查看客户', 'customer_management', '查看客户列表和详情'),
  ('create_customer', '创建客户', 'customer_management', '创建新客户'),
  ('edit_customer', '编辑客户', 'customer_management', '编辑客户信息'),
  ('delete_customer', '删除客户', 'customer_management', '删除客户');

-- 投标管理权限
INSERT INTO permissions (code, name, module, description) VALUES
  ('view_bidding', '查看投标', 'bidding_management', '查看投标信息'),
  ('create_bidding', '创建投标', 'bidding_management', '创建投标记录'),
  ('edit_bidding', '编辑投标', 'bidding_management', '编辑投标信息'),
  ('delete_bidding', '删除投标', 'bidding_management', '删除投标记录');

-- 数据中心权限
INSERT INTO permissions (code, name, module, description) VALUES
  ('view_statistics', '查看统计', 'data_center', '查看数据统计'),
  ('export_data', '导出数据', 'data_center', '导出数据报表'),
  ('view_dashboard', '查看报表', 'data_center', '查看数据看板');

-- 用户管理权限
INSERT INTO permissions (code, name, module, description) VALUES
  ('view_users', '查看用户', 'user_management', '查看用户列表'),
  ('create_user', '创建用户', 'user_management', '创建新用户'),
  ('edit_user', '编辑用户', 'user_management', '编辑用户信息'),
  ('delete_user', '删除用户', 'user_management', '删除用户'),
  ('assign_roles', '分配角色', 'user_management', '为用户分配角色');

-- 系统设置权限
INSERT INTO permissions (code, name, module, description) VALUES
  ('view_settings', '查看设置', 'system_settings', '查看系统设置'),
  ('edit_settings', '修改设置', 'system_settings', '修改系统设置'),
  ('view_logs', '查看日志', 'system_settings', '查看系统日志');

-- 小组管理权限
INSERT INTO permissions (code, name, module, description) VALUES
  ('view_teams', '查看小组', 'team_management', '查看小组列表'),
  ('create_team', '创建小组', 'team_management', '创建新小组'),
  ('edit_team', '编辑小组', 'team_management', '编辑小组信息'),
  ('delete_team', '删除小组', 'team_management', '删除小组');

-- 第五步：配置角色权限

-- 1. 超级管理员：所有权限
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.code = 'super_admin';

-- 2. 公司领导：查看所有数据、审核汇报、查看统计报表
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.code = 'company_leader'
AND p.code IN (
  -- 项目管理：查看、导出
  'view_projects', 'export_projects',
  -- 任务管理：查看
  'view_tasks',
  -- 工作汇报：查看、审核
  'view_reports', 'review_report',
  -- 客户管理：查看
  'view_customers',
  -- 投标管理：查看
  'view_bidding',
  -- 数据中心：全部权限
  'view_statistics', 'export_data', 'view_dashboard',
  -- 用户管理：查看
  'view_users',
  -- 小组管理：查看
  'view_teams'
);

-- 3. 经营中心人员：项目、客户、投标的全部权限，任务和汇报的创建编辑权限
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.code = 'business_center_staff'
AND p.code IN (
  -- 项目管理：全部权限
  'view_projects', 'create_project', 'edit_project', 'delete_project', 'export_projects',
  -- 任务管理：查看、创建、编辑、分配
  'view_tasks', 'create_task', 'edit_task', 'assign_task',
  -- 工作汇报：查看、提交、编辑
  'view_reports', 'submit_report', 'edit_report',
  -- 客户管理：全部权限
  'view_customers', 'create_customer', 'edit_customer', 'delete_customer',
  -- 投标管理：全部权限
  'view_bidding', 'create_bidding', 'edit_bidding', 'delete_bidding',
  -- 数据中心：查看统计和报表
  'view_statistics', 'view_dashboard',
  -- 小组管理：查看、创建、编辑
  'view_teams', 'create_team', 'edit_team'
);

-- 4. 资料员：项目、客户、投标的查看和编辑权限
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.code = 'data_clerk'
AND p.code IN (
  -- 项目管理：查看、编辑
  'view_projects', 'edit_project',
  -- 任务管理：查看
  'view_tasks',
  -- 工作汇报：查看、提交
  'view_reports', 'submit_report',
  -- 客户管理：查看、编辑
  'view_customers', 'edit_customer',
  -- 投标管理：查看、编辑
  'view_bidding', 'edit_bidding',
  -- 数据中心：查看统计
  'view_statistics',
  -- 小组管理：查看
  'view_teams'
);

-- 5. 系统管理员：用户管理、系统设置的全部权限，其他模块的查看权限
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.code = 'system_admin'
AND p.code IN (
  -- 项目管理：查看
  'view_projects',
  -- 任务管理：查看
  'view_tasks',
  -- 工作汇报：查看
  'view_reports',
  -- 客户管理：查看
  'view_customers',
  -- 投标管理：查看
  'view_bidding',
  -- 数据中心：查看统计和报表
  'view_statistics', 'view_dashboard',
  -- 用户管理：全部权限
  'view_users', 'create_user', 'edit_user', 'delete_user', 'assign_roles',
  -- 系统设置：全部权限
  'view_settings', 'edit_settings', 'view_logs',
  -- 小组管理：全部权限
  'view_teams', 'create_team', 'edit_team', 'delete_team'
);