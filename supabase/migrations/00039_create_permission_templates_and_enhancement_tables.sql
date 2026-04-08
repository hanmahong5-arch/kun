-- ========================================
-- 权限管理系统增强 - 数据库设计
-- ========================================
--
-- 功能：
-- 1. 权限模板表（permission_templates）
-- 2. 权限模板详情表（permission_template_items）
-- 3. 权限模板版本表（permission_template_versions）
-- 4. 权限模板应用记录表（permission_template_applications）
--
-- ========================================

-- 1. 创建权限模板表
CREATE TABLE IF NOT EXISTS permission_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(100) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(50), -- 模板分类：system（系统预设）、custom（自定义）
  is_active BOOLEAN DEFAULT true,
  version INTEGER DEFAULT 1,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 创建权限模板详情表（存储模板包含的权限）
CREATE TABLE IF NOT EXISTS permission_template_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES permission_templates(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(template_id, permission_id)
);

-- 3. 创建权限模板版本表（用于版本管理）
CREATE TABLE IF NOT EXISTS permission_template_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES permission_templates(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  permission_snapshot JSONB NOT NULL, -- 存储该版本的权限快照
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(template_id, version)
);

-- 4. 创建权限模板应用记录表（记录模板应用历史）
CREATE TABLE IF NOT EXISTS permission_template_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES permission_templates(id) ON DELETE CASCADE,
  template_version INTEGER NOT NULL,
  target_type VARCHAR(20) NOT NULL, -- user 或 role
  target_id UUID NOT NULL, -- 用户ID或角色ID
  applied_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  applied_at TIMESTAMPTZ DEFAULT NOW(),
  status VARCHAR(20) DEFAULT 'success', -- success, failed, rolled_back
  error_message TEXT
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_permission_templates_code ON permission_templates(code);
CREATE INDEX IF NOT EXISTS idx_permission_templates_category ON permission_templates(category);
CREATE INDEX IF NOT EXISTS idx_permission_templates_is_active ON permission_templates(is_active);

CREATE INDEX IF NOT EXISTS idx_permission_template_items_template_id ON permission_template_items(template_id);
CREATE INDEX IF NOT EXISTS idx_permission_template_items_permission_id ON permission_template_items(permission_id);

CREATE INDEX IF NOT EXISTS idx_permission_template_versions_template_id ON permission_template_versions(template_id);
CREATE INDEX IF NOT EXISTS idx_permission_template_versions_version ON permission_template_versions(template_id, version);

CREATE INDEX IF NOT EXISTS idx_permission_template_applications_template_id ON permission_template_applications(template_id);
CREATE INDEX IF NOT EXISTS idx_permission_template_applications_target ON permission_template_applications(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_permission_template_applications_applied_at ON permission_template_applications(applied_at);

-- 创建RLS策略
ALTER TABLE permission_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE permission_template_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE permission_template_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE permission_template_applications ENABLE ROW LEVEL SECURITY;

-- 系统管理员可以查看和管理所有模板
CREATE POLICY "system_admin_can_manage_templates" ON permission_templates
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
        AND r.code IN ('super_admin', 'system_admin')
    )
  );

CREATE POLICY "system_admin_can_manage_template_items" ON permission_template_items
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
        AND r.code IN ('super_admin', 'system_admin')
    )
  );

CREATE POLICY "system_admin_can_manage_template_versions" ON permission_template_versions
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
        AND r.code IN ('super_admin', 'system_admin')
    )
  );

CREATE POLICY "system_admin_can_view_template_applications" ON permission_template_applications
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
        AND r.code IN ('super_admin', 'system_admin')
    )
  );

-- service_role可以插入应用记录
CREATE POLICY "service_role_can_insert_applications" ON permission_template_applications
  FOR INSERT
  WITH CHECK (true);

-- 插入预设权限模板数据
-- 注意：这里需要先查询现有的权限ID，然后插入模板

-- 模板1：普通员工（经营中心人员）
INSERT INTO permission_templates (code, name, description, category, is_active, version)
VALUES (
  'employee_basic',
  '普通员工',
  '适用于经营中心普通员工，包含基本的项目和客户管理权限',
  'system',
  true,
  1
) ON CONFLICT (code) DO NOTHING;

-- 模板2：部门经理（经营中心主要领导）
INSERT INTO permission_templates (code, name, description, category, is_active, version)
VALUES (
  'department_manager',
  '部门经理',
  '适用于部门经理，包含团队管理和数据查看权限',
  'system',
  true,
  1
) ON CONFLICT (code) DO NOTHING;

-- 模板3：系统管理员
INSERT INTO permission_templates (code, name, description, category, is_active, version)
VALUES (
  'system_administrator',
  '系统管理员',
  '适用于系统管理员，包含系统配置和用户管理权限',
  'system',
  true,
  1
) ON CONFLICT (code) DO NOTHING;

-- 模板4：资料员
INSERT INTO permission_templates (code, name, description, category, is_active, version)
VALUES (
  'data_clerk',
  '资料员',
  '适用于资料员，包含投标管理和知识库管理权限',
  'system',
  true,
  1
) ON CONFLICT (code) DO NOTHING;

-- 模板5：公司领导
INSERT INTO permission_templates (code, name, description, category, is_active, version)
VALUES (
  'company_leader',
  '公司领导',
  '适用于公司领导，包含全局数据查看和决策分析权限',
  'system',
  true,
  1
) ON CONFLICT (code) DO NOTHING;

-- 为模板添加权限项（这里需要根据实际的权限ID来插入）
-- 由于权限ID是动态生成的，我们在Edge Function中处理模板权限的初始化

-- 创建函数：获取用户的所有权限（包括继承的）
CREATE OR REPLACE FUNCTION get_user_all_permissions(user_uuid UUID)
RETURNS TABLE (
  permission_id UUID,
  permission_code VARCHAR,
  permission_name VARCHAR,
  permission_type permission_type,
  permission_description TEXT,
  source VARCHAR, -- 'direct' 或 'inherited'
  source_role_id UUID,
  source_role_name VARCHAR
) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT
    p.id AS permission_id,
    p.code AS permission_code,
    p.name AS permission_name,
    p.type AS permission_type,
    p.description AS permission_description,
    'inherited' AS source,
    r.id AS source_role_id,
    r.name AS source_role_name
  FROM permissions p
  JOIN role_permissions rp ON p.id = rp.permission_id OR p.code = rp.permission_code
  JOIN roles r ON rp.role_id = r.id OR rp.role_code = r.code
  JOIN user_roles ur ON r.id = ur.role_id
  WHERE ur.user_id = user_uuid
    AND r.is_active = true
  ORDER BY p.type, p.sort_order, p.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 创建函数：获取角色的所有权限
CREATE OR REPLACE FUNCTION get_role_all_permissions(role_uuid UUID)
RETURNS TABLE (
  permission_id UUID,
  permission_code VARCHAR,
  permission_name VARCHAR,
  permission_type permission_type,
  permission_description TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT
    p.id AS permission_id,
    p.code AS permission_code,
    p.name AS permission_name,
    p.type AS permission_type,
    p.description AS permission_description
  FROM permissions p
  JOIN role_permissions rp ON p.id = rp.permission_id OR p.code = rp.permission_code
  WHERE rp.role_id = role_uuid
  ORDER BY p.type, p.sort_order, p.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 创建函数：对比两个权限集合
CREATE OR REPLACE FUNCTION compare_permission_sets(
  set1_ids UUID[],
  set2_ids UUID[]
)
RETURNS TABLE (
  permission_id UUID,
  permission_code VARCHAR,
  permission_name VARCHAR,
  permission_type permission_type,
  in_set1 BOOLEAN,
  in_set2 BOOLEAN,
  comparison_result VARCHAR -- 'both', 'only_set1', 'only_set2'
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id AS permission_id,
    p.code AS permission_code,
    p.name AS permission_name,
    p.type AS permission_type,
    (p.id = ANY(set1_ids)) AS in_set1,
    (p.id = ANY(set2_ids)) AS in_set2,
    CASE
      WHEN (p.id = ANY(set1_ids)) AND (p.id = ANY(set2_ids)) THEN 'both'
      WHEN (p.id = ANY(set1_ids)) AND NOT (p.id = ANY(set2_ids)) THEN 'only_set1'
      WHEN NOT (p.id = ANY(set1_ids)) AND (p.id = ANY(set2_ids)) THEN 'only_set2'
      ELSE 'none'
    END AS comparison_result
  FROM permissions p
  WHERE p.id = ANY(set1_ids) OR p.id = ANY(set2_ids)
  ORDER BY p.type, p.sort_order, p.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 添加注释
COMMENT ON TABLE permission_templates IS '权限模板表，存储预设和自定义的权限配置模板';
COMMENT ON TABLE permission_template_items IS '权限模板详情表，存储模板包含的具体权限';
COMMENT ON TABLE permission_template_versions IS '权限模板版本表，用于版本管理和历史追溯';
COMMENT ON TABLE permission_template_applications IS '权限模板应用记录表，记录模板应用历史';

COMMENT ON FUNCTION get_user_all_permissions IS '获取用户的所有权限（包括通过角色继承的权限）';
COMMENT ON FUNCTION get_role_all_permissions IS '获取角色的所有权限';
COMMENT ON FUNCTION compare_permission_sets IS '对比两个权限集合，返回交集、差异和独有权限';
