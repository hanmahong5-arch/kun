
-- 修复roles表的RLS策略，移除super_admin引用

-- 删除旧策略
DROP POLICY IF EXISTS "管理员可管理角色" ON roles;

-- 创建新策略（仅检查system_admin）
CREATE POLICY "管理员可管理角色"
ON roles
FOR ALL
TO public
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'system_admin'
  )
);
