-- 启用RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_follow_ups ENABLE ROW LEVEL SECURITY;
ALTER TABLE bidding_info ENABLE ROW LEVEL SECURITY;
ALTER TABLE bidding_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_follow_ups ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE operation_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE field_configs ENABLE ROW LEVEL SECURITY;

-- 创建辅助函数
CREATE OR REPLACE FUNCTION is_super_admin(uid uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = uid AND p.role = 'super_admin'::user_role
  );
$$;

CREATE OR REPLACE FUNCTION is_leader(uid uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = uid AND p.role = 'leader'::user_role
  );
$$;

CREATE OR REPLACE FUNCTION is_system_admin(uid uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = uid AND p.role = 'system_admin'::user_role
  );
$$;

CREATE OR REPLACE FUNCTION is_data_clerk(uid uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = uid AND p.role = 'data_clerk'::user_role
  );
$$;

CREATE OR REPLACE FUNCTION is_admin_or_leader(uid uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = uid AND p.role IN ('super_admin'::user_role, 'leader'::user_role, 'system_admin'::user_role)
  );
$$;

-- profiles表策略
CREATE POLICY "超级管理员全权限" ON profiles FOR ALL TO authenticated USING (is_super_admin(auth.uid()));
CREATE POLICY "系统管理员全权限" ON profiles FOR ALL TO authenticated USING (is_system_admin(auth.uid()));
CREATE POLICY "用户可查看自己的profile" ON profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "用户可更新自己的profile（除role外）" ON profiles FOR UPDATE TO authenticated 
  USING (auth.uid() = id)
  WITH CHECK (role IS NOT DISTINCT FROM (SELECT role FROM profiles WHERE id = auth.uid()));

-- weekly_reports表策略
CREATE POLICY "超级管理员全权限" ON weekly_reports FOR ALL TO authenticated USING (is_super_admin(auth.uid()));
CREATE POLICY "领导和管理员可查看所有周报" ON weekly_reports FOR SELECT TO authenticated 
  USING (is_admin_or_leader(auth.uid()) OR user_id = auth.uid());
CREATE POLICY "用户可创建自己的周报" ON weekly_reports FOR INSERT TO authenticated 
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "用户可更新自己的周报" ON weekly_reports FOR UPDATE TO authenticated 
  USING (user_id = auth.uid() OR is_admin_or_leader(auth.uid()));
CREATE POLICY "领导可审阅周报" ON weekly_reports FOR UPDATE TO authenticated 
  USING (is_admin_or_leader(auth.uid()));

-- projects表策略
CREATE POLICY "超级管理员全权限" ON projects FOR ALL TO authenticated USING (is_super_admin(auth.uid()));
CREATE POLICY "领导和管理员可查看所有项目" ON projects FOR SELECT TO authenticated 
  USING (is_admin_or_leader(auth.uid()) OR responsible_person_id = auth.uid());
CREATE POLICY "用户可创建项目" ON projects FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "负责人可更新项目" ON projects FOR UPDATE TO authenticated 
  USING (responsible_person_id = auth.uid() OR is_admin_or_leader(auth.uid()));

-- project_follow_ups表策略
CREATE POLICY "超级管理员全权限" ON project_follow_ups FOR ALL TO authenticated USING (is_super_admin(auth.uid()));
CREATE POLICY "用户可查看自己负责项目的跟进记录" ON project_follow_ups FOR SELECT TO authenticated 
  USING (
    is_admin_or_leader(auth.uid()) OR 
    user_id = auth.uid() OR
    EXISTS (SELECT 1 FROM projects WHERE id = project_id AND responsible_person_id = auth.uid())
  );
CREATE POLICY "用户可创建跟进记录" ON project_follow_ups FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- bidding_info表策略
CREATE POLICY "超级管理员全权限" ON bidding_info FOR ALL TO authenticated USING (is_super_admin(auth.uid()));
CREATE POLICY "所有人可查看投标信息" ON bidding_info FOR SELECT TO authenticated USING (true);
CREATE POLICY "资料员可管理投标信息" ON bidding_info FOR ALL TO authenticated 
  USING (is_data_clerk(auth.uid()) OR is_admin_or_leader(auth.uid()));

-- bidding_progress表策略
CREATE POLICY "超级管理员全权限" ON bidding_progress FOR ALL TO authenticated USING (is_super_admin(auth.uid()));
CREATE POLICY "所有人可查看投标进度" ON bidding_progress FOR SELECT TO authenticated USING (true);
CREATE POLICY "资料员可管理投标进度" ON bidding_progress FOR ALL TO authenticated 
  USING (is_data_clerk(auth.uid()) OR is_admin_or_leader(auth.uid()));

-- customers表策略
CREATE POLICY "超级管理员全权限" ON customers FOR ALL TO authenticated USING (is_super_admin(auth.uid()));
CREATE POLICY "领导和管理员可查看所有客户" ON customers FOR SELECT TO authenticated 
  USING (is_admin_or_leader(auth.uid()) OR responsible_person_id = auth.uid());
CREATE POLICY "用户可创建客户" ON customers FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "负责人可更新客户" ON customers FOR UPDATE TO authenticated 
  USING (responsible_person_id = auth.uid() OR is_admin_or_leader(auth.uid()));

-- customer_follow_ups表策略
CREATE POLICY "超级管理员全权限" ON customer_follow_ups FOR ALL TO authenticated USING (is_super_admin(auth.uid()));
CREATE POLICY "用户可查看自己负责客户的跟进记录" ON customer_follow_ups FOR SELECT TO authenticated 
  USING (
    is_admin_or_leader(auth.uid()) OR 
    user_id = auth.uid() OR
    EXISTS (SELECT 1 FROM customers WHERE id = customer_id AND responsible_person_id = auth.uid())
  );
CREATE POLICY "用户可创建跟进记录" ON customer_follow_ups FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- tasks表策略
CREATE POLICY "超级管理员全权限" ON tasks FOR ALL TO authenticated USING (is_super_admin(auth.uid()));
CREATE POLICY "任务相关人可查看任务" ON tasks FOR SELECT TO authenticated 
  USING (
    assigned_by = auth.uid() OR 
    responsible_person_id = auth.uid() OR 
    auth.uid() = ANY(collaborators)
  );
CREATE POLICY "领导可创建任务" ON tasks FOR INSERT TO authenticated 
  WITH CHECK (is_admin_or_leader(auth.uid()));
CREATE POLICY "任务相关人可更新任务" ON tasks FOR UPDATE TO authenticated 
  USING (
    assigned_by = auth.uid() OR 
    responsible_person_id = auth.uid() OR 
    auth.uid() = ANY(collaborators)
  );

-- documents表策略
CREATE POLICY "超级管理员全权限" ON documents FOR ALL TO authenticated USING (is_super_admin(auth.uid()));
CREATE POLICY "用户可查看有权限的文档" ON documents FOR SELECT TO authenticated 
  USING (
    NOT is_confidential OR 
    is_admin_or_leader(auth.uid()) OR
    (SELECT role::text FROM profiles WHERE id = auth.uid()) = ANY(allowed_roles)
  );
CREATE POLICY "资料员和管理员可管理文档" ON documents FOR ALL TO authenticated 
  USING (is_data_clerk(auth.uid()) OR is_admin_or_leader(auth.uid()));

-- notifications表策略
CREATE POLICY "超级管理员全权限" ON notifications FOR ALL TO authenticated USING (is_super_admin(auth.uid()));
CREATE POLICY "用户可查看自己的通知" ON notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "系统可创建通知" ON notifications FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "用户可更新自己的通知" ON notifications FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- operation_logs表策略
CREATE POLICY "超级管理员全权限" ON operation_logs FOR ALL TO authenticated USING (is_super_admin(auth.uid()));
CREATE POLICY "系统管理员可查看日志" ON operation_logs FOR SELECT TO authenticated USING (is_system_admin(auth.uid()));
CREATE POLICY "系统可创建日志" ON operation_logs FOR INSERT TO authenticated WITH CHECK (true);

-- report_configs表策略
CREATE POLICY "超级管理员全权限" ON report_configs FOR ALL TO authenticated USING (is_super_admin(auth.uid()));
CREATE POLICY "领导和管理员可查看报表配置" ON report_configs FOR SELECT TO authenticated 
  USING (is_admin_or_leader(auth.uid()));
CREATE POLICY "领导和管理员可创建报表配置" ON report_configs FOR INSERT TO authenticated 
  WITH CHECK (is_admin_or_leader(auth.uid()));
CREATE POLICY "创建者可更新报表配置" ON report_configs FOR UPDATE TO authenticated 
  USING (created_by = auth.uid() OR is_super_admin(auth.uid()));

-- field_configs表策略
CREATE POLICY "超级管理员全权限" ON field_configs FOR ALL TO authenticated USING (is_super_admin(auth.uid()));
CREATE POLICY "所有人可查看字段配置" ON field_configs FOR SELECT TO authenticated USING (true);

-- 存储桶策略
CREATE POLICY "所有人可查看文档" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'app-aqrho2yuzfnl_documents');
CREATE POLICY "资料员和管理员可上传文档" ON storage.objects FOR INSERT TO authenticated 
  WITH CHECK (bucket_id = 'app-aqrho2yuzfnl_documents' AND (is_data_clerk(auth.uid()) OR is_admin_or_leader(auth.uid())));

CREATE POLICY "所有人可查看附件" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'app-aqrho2yuzfnl_attachments');
CREATE POLICY "所有人可上传附件" ON storage.objects FOR INSERT TO authenticated 
  WITH CHECK (bucket_id = 'app-aqrho2yuzfnl_attachments');