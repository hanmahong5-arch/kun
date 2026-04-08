-- 更新is_system_admin函数，使其同时支持super_admin和system_admin
-- 这样超级管理员就可以访问所有受RLS保护的数据

CREATE OR REPLACE FUNCTION is_system_admin(uid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = uid 
    AND p.role IN ('super_admin', 'system_admin')
  );
$$;

COMMENT ON FUNCTION is_system_admin IS '检查用户是否是管理员（超级管理员或系统管理员）';

-- 创建额外的辅助函数
CREATE OR REPLACE FUNCTION is_super_admin(uid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = uid AND p.role = 'super_admin'
  );
$$;

COMMENT ON FUNCTION is_super_admin IS '检查用户是否是超级管理员';

CREATE OR REPLACE FUNCTION is_leader(uid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = uid AND p.role = 'leader'
  );
$$;

COMMENT ON FUNCTION is_leader IS '检查用户是否是公司领导';

CREATE OR REPLACE FUNCTION is_leader_or_admin(uid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = uid 
    AND p.role IN ('super_admin', 'system_admin', 'leader')
  );
$$;

COMMENT ON FUNCTION is_leader_or_admin IS '检查用户是否是领导或管理员';