
-- 修复role_permissions表的RLS策略，移除super_admin引用

-- 删除旧策略
DROP POLICY IF EXISTS "管理员可管理角色权限" ON role_permissions;

-- 创建新策略（仅检查system_admin）
CREATE POLICY "管理员可管理角色权限"
ON role_permissions
FOR ALL
TO public
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'system_admin'
  )
);
