-- 创建函数：获取用户的所有权限
CREATE OR REPLACE FUNCTION get_user_permissions(user_id_param UUID)
RETURNS TABLE (
  permission_code VARCHAR,
  permission_name VARCHAR,
  module VARCHAR
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT
    p.code::VARCHAR,
    p.name::VARCHAR,
    p.module::VARCHAR
  FROM user_roles ur
  JOIN role_permissions rp ON ur.role_id = rp.role_id
  JOIN permissions p ON rp.permission_id = p.id
  WHERE ur.user_id = user_id_param;
END;
$$;

-- 创建函数：检查用户是否有某个权限
CREATE OR REPLACE FUNCTION has_permission(user_id_param UUID, permission_code_param VARCHAR)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM user_roles ur
    JOIN role_permissions rp ON ur.role_id = rp.role_id
    JOIN permissions p ON rp.permission_id = p.id
    WHERE ur.user_id = user_id_param
    AND p.code = permission_code_param
  );
END;
$$;

-- 创建函数：获取角色的所有权限
CREATE OR REPLACE FUNCTION get_role_permissions(role_code_param VARCHAR)
RETURNS TABLE (
  permission_code VARCHAR,
  permission_name VARCHAR,
  module VARCHAR
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.code::VARCHAR,
    p.name::VARCHAR,
    p.module::VARCHAR
  FROM roles r
  JOIN role_permissions rp ON r.id = rp.role_id
  JOIN permissions p ON rp.permission_id = p.id
  WHERE r.code = role_code_param
  ORDER BY p.module, p.code;
END;
$$;

-- 创建视图：用户权限汇总视图
CREATE OR REPLACE VIEW user_permissions_summary AS
SELECT 
  ur.user_id,
  p.name as profile_name,
  r.code as role_code,
  r.name as role_name,
  perm.code as permission_code,
  perm.name as permission_name,
  perm.module
FROM user_roles ur
JOIN profiles p ON ur.user_id = p.id
JOIN roles r ON ur.role_id = r.id
JOIN role_permissions rp ON r.id = rp.role_id
JOIN permissions perm ON rp.permission_id = perm.id;

-- 为视图添加RLS策略
ALTER VIEW user_permissions_summary SET (security_invoker = true);

-- 添加注释
COMMENT ON FUNCTION get_user_permissions IS '获取用户的所有权限列表';
COMMENT ON FUNCTION has_permission IS '检查用户是否拥有指定权限';
COMMENT ON FUNCTION get_role_permissions IS '获取角色的所有权限列表';
COMMENT ON VIEW user_permissions_summary IS '用户权限汇总视图，显示用户-角色-权限的完整关系';