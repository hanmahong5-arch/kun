
-- 删除旧函数并创建新函数
DROP FUNCTION IF EXISTS is_super_admin(uuid);

CREATE OR REPLACE FUNCTION is_system_admin(uid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = uid AND p.role = 'system_admin'::user_role
  );
$$;

-- 只创建不存在的策略（跳过profiles表，因为已存在）

-- bidding_info表
CREATE POLICY "系统管理员全权限"
ON bidding_info FOR ALL TO public
USING (is_system_admin(auth.uid()));

-- bidding_progress表
CREATE POLICY "系统管理员全权限"
ON bidding_progress FOR ALL TO public
USING (is_system_admin(auth.uid()));

-- customer_follow_ups表
CREATE POLICY "系统管理员全权限"
ON customer_follow_ups FOR ALL TO public
USING (is_system_admin(auth.uid()));

-- customers表
CREATE POLICY "系统管理员全权限"
ON customers FOR ALL TO public
USING (is_system_admin(auth.uid()));

-- documents表（使用不同名称避免冲突）
CREATE POLICY "系统管理员全权限_2"
ON documents FOR ALL TO public
USING (is_system_admin(auth.uid()));

-- field_configs表
CREATE POLICY "系统管理员全权限"
ON field_configs FOR ALL TO public
USING (is_system_admin(auth.uid()));

-- notifications表
CREATE POLICY "系统管理员全权限"
ON notifications FOR ALL TO public
USING (is_system_admin(auth.uid()));

-- operation_logs表
CREATE POLICY "系统管理员全权限"
ON operation_logs FOR ALL TO public
USING (is_system_admin(auth.uid()));

-- project_follow_ups表
CREATE POLICY "系统管理员全权限"
ON project_follow_ups FOR ALL TO public
USING (is_system_admin(auth.uid()));

-- projects表
CREATE POLICY "系统管理员全权限"
ON projects FOR ALL TO public
USING (is_system_admin(auth.uid()));

-- report_configs表
CREATE POLICY "创建者可更新报表配置"
ON report_configs FOR UPDATE TO public
USING (created_by = auth.uid() OR is_system_admin(auth.uid()));

CREATE POLICY "系统管理员全权限"
ON report_configs FOR ALL TO public
USING (is_system_admin(auth.uid()));

-- tasks表
CREATE POLICY "系统管理员全权限"
ON tasks FOR ALL TO public
USING (is_system_admin(auth.uid()));

-- weekly_reports表
CREATE POLICY "系统管理员全权限"
ON weekly_reports FOR ALL TO public
USING (is_system_admin(auth.uid()));
