
-- 批量修复所有包含super_admin引用的RLS策略

-- 1. annual_goals表
DROP POLICY IF EXISTS "Admins can manage annual goals" ON annual_goals;
CREATE POLICY "Admins can manage annual goals"
ON annual_goals FOR ALL TO public
USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'system_admin'));

-- 2. audit_logs表
DROP POLICY IF EXISTS "用户可查看自己的日志" ON audit_logs;
CREATE POLICY "用户可查看自己的日志"
ON audit_logs FOR SELECT TO public
USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'system_admin'));

-- 3. bids表
DROP POLICY IF EXISTS "管理员可删除投标信息" ON bids;
DROP POLICY IF EXISTS "资料员和管理员可更新投标信息" ON bids;
CREATE POLICY "管理员可删除投标信息"
ON bids FOR DELETE TO public
USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'system_admin'));
CREATE POLICY "资料员和管理员可更新投标信息"
ON bids FOR UPDATE TO public
USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('system_admin', 'data_clerk')));

-- 4. custom_roles表
DROP POLICY IF EXISTS "admins_can_manage_roles" ON custom_roles;
CREATE POLICY "admins_can_manage_roles"
ON custom_roles FOR ALL TO public
USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'system_admin'));

-- 5. department_template_mapping表
DROP POLICY IF EXISTS "Admins can manage department mapping" ON department_template_mapping;
CREATE POLICY "Admins can manage department mapping"
ON department_template_mapping FOR ALL TO public
USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'system_admin'));

-- 6. documents表
DROP POLICY IF EXISTS "管理员可删除文档" ON documents;
DROP POLICY IF EXISTS "资料员和管理员可更新文档" ON documents;
CREATE POLICY "管理员可删除文档"
ON documents FOR DELETE TO public
USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'system_admin'));
CREATE POLICY "资料员和管理员可更新文档"
ON documents FOR UPDATE TO public
USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('system_admin', 'data_clerk')));

-- 7. job_level_role_mapping表
DROP POLICY IF EXISTS "管理员可删除映射" ON job_level_role_mapping;
DROP POLICY IF EXISTS "管理员可更新映射" ON job_level_role_mapping;
DROP POLICY IF EXISTS "管理员可查看所有映射" ON job_level_role_mapping;
CREATE POLICY "管理员可删除映射"
ON job_level_role_mapping FOR DELETE TO public
USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'system_admin'));
CREATE POLICY "管理员可更新映射"
ON job_level_role_mapping FOR UPDATE TO public
USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'system_admin'));
CREATE POLICY "管理员可查看所有映射"
ON job_level_role_mapping FOR SELECT TO public
USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'system_admin'));

-- 8. kpi_data表
DROP POLICY IF EXISTS "管理员可管理KPI数据" ON kpi_data;
DROP POLICY IF EXISTS "领导和管理员可查看KPI数据" ON kpi_data;
CREATE POLICY "管理员可管理KPI数据"
ON kpi_data FOR ALL TO public
USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'system_admin'));
CREATE POLICY "领导和管理员可查看KPI数据"
ON kpi_data FOR SELECT TO public
USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('system_admin', 'leader')));

-- 9. kpi_indicators表
DROP POLICY IF EXISTS "管理员可管理KPI指标" ON kpi_indicators;
DROP POLICY IF EXISTS "领导和管理员可查看KPI指标" ON kpi_indicators;
CREATE POLICY "管理员可管理KPI指标"
ON kpi_indicators FOR ALL TO public
USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'system_admin'));
CREATE POLICY "领导和管理员可查看KPI指标"
ON kpi_indicators FOR SELECT TO public
USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('system_admin', 'leader')));

-- 10. permission_change_logs表
DROP POLICY IF EXISTS "管理员可查看所有日志" ON permission_change_logs;
CREATE POLICY "管理员可查看所有日志"
ON permission_change_logs FOR SELECT TO public
USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'system_admin'));

-- 11. permission_definitions表
DROP POLICY IF EXISTS "管理员可管理权限定义" ON permission_definitions;
CREATE POLICY "管理员可管理权限定义"
ON permission_definitions FOR ALL TO public
USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'system_admin'));

-- 12. permissions表
DROP POLICY IF EXISTS "admins_can_manage_permissions" ON permissions;
CREATE POLICY "admins_can_manage_permissions"
ON permissions FOR ALL TO public
USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'system_admin'));

-- 13. project_content_templates表
DROP POLICY IF EXISTS "管理员可管理项目内容模板" ON project_content_templates;
CREATE POLICY "管理员可管理项目内容模板"
ON project_content_templates FOR ALL TO public
USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'system_admin'));

-- 14. project_contents表
DROP POLICY IF EXISTS "管理员可管理所有项目内容" ON project_contents;
CREATE POLICY "管理员可管理所有项目内容"
ON project_contents FOR ALL TO public
USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'system_admin'));

-- 15. report_alerts表
DROP POLICY IF EXISTS "管理员可管理预警" ON report_alerts;
DROP POLICY IF EXISTS "领导和管理员可查看预警" ON report_alerts;
CREATE POLICY "管理员可管理预警"
ON report_alerts FOR ALL TO public
USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'system_admin'));
CREATE POLICY "领导和管理员可查看预警"
ON report_alerts FOR SELECT TO public
USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('system_admin', 'leader')));

-- 16. team_goal_history表
DROP POLICY IF EXISTS "管理员可管理小组目标历史" ON team_goal_history;
CREATE POLICY "管理员可管理小组目标历史"
ON team_goal_history FOR ALL TO public
USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'system_admin'));

-- 17. team_goals表
DROP POLICY IF EXISTS "管理员可管理小组目标" ON team_goals;
CREATE POLICY "管理员可管理小组目标"
ON team_goals FOR ALL TO public
USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'system_admin'));

-- 18. teams表
DROP POLICY IF EXISTS "管理员可管理小组" ON teams;
CREATE POLICY "管理员可管理小组"
ON teams FOR ALL TO public
USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'system_admin'));

-- 19. user_roles表
DROP POLICY IF EXISTS "用户可查看自己的角色" ON user_roles;
DROP POLICY IF EXISTS "管理员可管理用户角色" ON user_roles;
CREATE POLICY "用户可查看自己的角色"
ON user_roles FOR SELECT TO public
USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'system_admin'));
CREATE POLICY "管理员可管理用户角色"
ON user_roles FOR ALL TO public
USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'system_admin'));

-- 20. user_teams表
DROP POLICY IF EXISTS "管理员可管理用户小组关联" ON user_teams;
CREATE POLICY "管理员可管理用户小组关联"
ON user_teams FOR ALL TO public
USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'system_admin'));

-- 21. weekly_report_template_fields表
DROP POLICY IF EXISTS "Admins can manage template fields" ON weekly_report_template_fields;
CREATE POLICY "Admins can manage template fields"
ON weekly_report_template_fields FOR ALL TO public
USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'system_admin'));

-- 22. weekly_report_templates表
DROP POLICY IF EXISTS "Admins can manage templates" ON weekly_report_templates;
CREATE POLICY "Admins can manage templates"
ON weekly_report_templates FOR ALL TO public
USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'system_admin'));
