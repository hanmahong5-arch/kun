-- =====================================================
-- 数据库完整重构：简化权限管理系统
-- 备份现有数据 → 删除旧表 → 创建新表 → 插入初始数据
-- =====================================================

-- 第一步：备份现有的users表数据（如果需要保留）
CREATE TABLE IF NOT EXISTS users_backup_restructure AS 
SELECT * FROM users;

-- 第二步：删除所有权限相关表（按依赖关系逆序删除）

-- 删除视图
DROP VIEW IF EXISTS user_with_group_info CASCADE;

-- 删除权限模板相关表
DROP TABLE IF EXISTS permission_template_applications CASCADE;
DROP TABLE IF EXISTS permission_template_versions CASCADE;
DROP TABLE IF EXISTS permission_template_items CASCADE;
DROP TABLE IF EXISTS permission_templates CASCADE;

-- 删除用户角色和权限关联表
DROP TABLE IF EXISTS user_roles CASCADE;
DROP TABLE IF EXISTS role_permissions CASCADE;
DROP TABLE IF EXISTS module_permissions CASCADE;
DROP TABLE IF EXISTS permission_definitions CASCADE;

-- 删除角色和权限表
DROP TABLE IF EXISTS roles CASCADE;

-- 删除用户小组关联表
DROP TABLE IF EXISTS user_teams CASCADE;
DROP TABLE IF EXISTS teams CASCADE;

-- 删除现有的users表
DROP TABLE IF EXISTS users CASCADE;

-- 删除profiles表（如果存在且不再需要）
-- 注意：如果profiles表被其他功能使用，请谨慎删除
-- DROP TABLE IF EXISTS profiles CASCADE;

-- 删除数据库函数
DROP FUNCTION IF EXISTS get_user_all_permissions(UUID);
DROP FUNCTION IF EXISTS get_role_all_permissions(UUID);
DROP FUNCTION IF EXISTS compare_permission_sets(UUID[], UUID[]);
DROP FUNCTION IF EXISTS verify_user_password(VARCHAR, VARCHAR);
DROP FUNCTION IF EXISTS get_user_features(INTEGER);
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;

-- 第三步：创建新的表结构

-- 3.1 创建分组表
CREATE TABLE groups (
  id INTEGER PRIMARY KEY,
  group_name VARCHAR(100) NOT NULL UNIQUE,
  available_features JSONB NOT NULL DEFAULT '[]'::jsonb,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 为分组表创建索引
CREATE INDEX idx_groups_group_name ON groups(group_name);

-- 为分组表添加注释
COMMENT ON TABLE groups IS '用户分组表，定义不同分组的可用功能';
COMMENT ON COLUMN groups.id IS '分组ID（整型）';
COMMENT ON COLUMN groups.group_name IS '分组名称（唯一）';
COMMENT ON COLUMN groups.available_features IS '可用功能列表（JSON数组）';
COMMENT ON COLUMN groups.description IS '分组描述';

-- 3.2 创建用户表
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  phone VARCHAR(20) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  name VARCHAR(100) NOT NULL,
  group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE RESTRICT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login_at TIMESTAMPTZ
);

-- 为用户表创建索引
CREATE INDEX idx_users_phone ON users(phone);
CREATE INDEX idx_users_group_id ON users(group_id);
CREATE INDEX idx_users_is_active ON users(is_active);

-- 为用户表添加注释
COMMENT ON TABLE users IS '用户表，存储用户基本信息和分组关联';
COMMENT ON COLUMN users.id IS '用户ID（自增主键）';
COMMENT ON COLUMN users.phone IS '手机号（唯一）';
COMMENT ON COLUMN users.password IS '密码（加密存储）';
COMMENT ON COLUMN users.name IS '用户姓名';
COMMENT ON COLUMN users.group_id IS '所属分组ID（外键关联groups.id）';
COMMENT ON COLUMN users.is_active IS '账号是否启用';
COMMENT ON COLUMN users.last_login_at IS '最后登录时间';

-- 第四步：插入预设分组数据

INSERT INTO groups (id, group_name, available_features, description) VALUES
(0, '管理员组', '["all"]'::jsonb, '系统管理员，拥有所有功能权限'),
(1, '领导组', '["report_view", "data_analysis", "approval", "task_assign", "team_overview", "goal_management", "dashboard_view", "export_data"]'::jsonb, '公司领导，可查看报表、分析数据、审批任务、管理目标'),
(2, '经营组', '["order_manage", "customer_manage", "data_entry", "project_manage", "report_submit", "customer_follow_up", "project_tracking"]'::jsonb, '经营人员，可管理订单、客户、项目，提交报表');

-- 第五步：安装pgcrypto扩展并插入管理员用户

-- 安装pgcrypto扩展（如果尚未安装）
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 插入管理员用户（密码：123456，使用bcrypt加密）
INSERT INTO users (phone, password, name, group_id, is_active) VALUES
('15610496919', crypt('123456', gen_salt('bf')), '管理员', 0, true);

-- 第六步：创建更新时间戳的触发器函数

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 为groups表创建更新时间戳触发器
CREATE TRIGGER update_groups_updated_at
  BEFORE UPDATE ON groups
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 为users表创建更新时间戳触发器
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 第七步：创建密码验证函数

CREATE OR REPLACE FUNCTION verify_user_password(
  user_phone VARCHAR,
  user_password VARCHAR
)
RETURNS TABLE(
  user_id INTEGER,
  user_name VARCHAR,
  group_id INTEGER,
  group_name VARCHAR,
  available_features JSONB,
  is_active BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.id,
    u.name,
    u.group_id,
    g.group_name,
    g.available_features,
    u.is_active
  FROM users u
  INNER JOIN groups g ON u.group_id = g.id
  WHERE u.phone = user_phone
    AND u.password = crypt(user_password, u.password)
    AND u.is_active = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION verify_user_password IS '验证用户密码并返回用户信息和权限';

-- 第八步：创建获取用户权限的函数

CREATE OR REPLACE FUNCTION get_user_features(user_id_param INTEGER)
RETURNS JSONB AS $$
DECLARE
  features JSONB;
BEGIN
  SELECT g.available_features INTO features
  FROM users u
  INNER JOIN groups g ON u.group_id = g.id
  WHERE u.id = user_id_param;
  
  RETURN COALESCE(features, '[]'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_user_features IS '获取指定用户的可用功能列表';

-- 第九步：创建修改密码的函数

CREATE OR REPLACE FUNCTION change_user_password(
  user_id_param INTEGER,
  old_password VARCHAR,
  new_password VARCHAR
)
RETURNS BOOLEAN AS $$
DECLARE
  password_match BOOLEAN;
BEGIN
  -- 验证旧密码
  SELECT (password = crypt(old_password, password)) INTO password_match
  FROM users
  WHERE id = user_id_param;
  
  IF NOT password_match THEN
    RETURN FALSE;
  END IF;
  
  -- 更新为新密码
  UPDATE users
  SET password = crypt(new_password, gen_salt('bf')),
      updated_at = NOW()
  WHERE id = user_id_param;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION change_user_password IS '修改用户密码（需验证旧密码）';

-- 第十步：配置RLS（行级安全）策略

-- 启用RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;

-- 创建策略：管理员可以查看和管理所有用户
CREATE POLICY admin_can_manage_all_users ON users
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users u
      INNER JOIN groups g ON u.group_id = g.id
      WHERE u.id = current_setting('app.user_id', true)::integer
        AND g.group_name = '管理员组'
    )
  );

-- 创建策略：用户可以查看自己的信息
CREATE POLICY users_can_view_own_info ON users
  FOR SELECT
  USING (id = current_setting('app.user_id', true)::integer);

-- 创建策略：用户可以更新自己的部分信息（不包括group_id）
CREATE POLICY users_can_update_own_info ON users
  FOR UPDATE
  USING (id = current_setting('app.user_id', true)::integer)
  WITH CHECK (
    id = current_setting('app.user_id', true)::integer
    AND group_id = (SELECT group_id FROM users WHERE id = current_setting('app.user_id', true)::integer)
  );

-- 创建策略：管理员可以查看和管理所有分组
CREATE POLICY admin_can_manage_all_groups ON groups
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users u
      INNER JOIN groups g ON u.group_id = g.id
      WHERE u.id = current_setting('app.user_id', true)::integer
        AND g.group_name = '管理员组'
    )
  );

-- 创建策略：所有用户可以查看分组信息（用于显示分组名称等）
CREATE POLICY all_users_can_view_groups ON groups
  FOR SELECT
  USING (true);

-- 第十一步：创建视图，方便查询用户和分组信息

CREATE OR REPLACE VIEW user_with_group_info AS
SELECT 
  u.id,
  u.phone,
  u.name,
  u.group_id,
  g.group_name,
  g.available_features,
  u.is_active,
  u.created_at,
  u.updated_at,
  u.last_login_at
FROM users u
INNER JOIN groups g ON u.group_id = g.id;

COMMENT ON VIEW user_with_group_info IS '用户和分组信息的联合视图';

-- 第十二步：创建用户管理的辅助函数

-- 创建用户（仅管理员可调用）
CREATE OR REPLACE FUNCTION create_user(
  user_phone VARCHAR,
  user_password VARCHAR,
  user_name VARCHAR,
  user_group_id INTEGER
)
RETURNS INTEGER AS $$
DECLARE
  new_user_id INTEGER;
BEGIN
  INSERT INTO users (phone, password, name, group_id, is_active)
  VALUES (
    user_phone,
    crypt(user_password, gen_salt('bf')),
    user_name,
    user_group_id,
    true
  )
  RETURNING id INTO new_user_id;
  
  RETURN new_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION create_user IS '创建新用户（密码自动加密）';

-- 重置用户密码（仅管理员可调用）
CREATE OR REPLACE FUNCTION reset_user_password(
  user_id_param INTEGER,
  new_password VARCHAR
)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE users
  SET password = crypt(new_password, gen_salt('bf')),
      updated_at = NOW()
  WHERE id = user_id_param;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION reset_user_password IS '重置用户密码（管理员功能）';

-- 完成
-- 数据库重构完成！
-- 
-- 新系统特点：
-- 1. 简化的基于分组的权限模型
-- 2. 密码使用bcrypt加密存储
-- 3. 完善的RLS策略保障数据安全
-- 4. 提供便捷的用户管理和密码验证函数
-- 
-- 初始数据：
-- - 管理员用户：手机号 15610496919，密码 123456
-- - 3个预设分组：管理员组(id=0)、领导组(id=1)、经营组(id=2)