
-- 先删除所有使用is_super_admin()的策略

DROP POLICY IF EXISTS "超级管理员全权限" ON bidding_info;
DROP POLICY IF EXISTS "超级管理员全权限" ON bidding_progress;
DROP POLICY IF EXISTS "超级管理员全权限" ON customer_follow_ups;
DROP POLICY IF EXISTS "超级管理员全权限" ON customers;
DROP POLICY IF EXISTS "超级管理员全权限" ON documents;
DROP POLICY IF EXISTS "超级管理员全权限" ON field_configs;
DROP POLICY IF EXISTS "超级管理员全权限" ON notifications;
DROP POLICY IF EXISTS "超级管理员全权限" ON operation_logs;
DROP POLICY IF EXISTS "超级管理员全权限" ON profiles;
DROP POLICY IF EXISTS "超级管理员全权限" ON project_follow_ups;
DROP POLICY IF EXISTS "超级管理员全权限" ON projects;
DROP POLICY IF EXISTS "创建者可更新报表配置" ON report_configs;
DROP POLICY IF EXISTS "超级管理员全权限" ON report_configs;
DROP POLICY IF EXISTS "超级管理员全权限" ON tasks;
DROP POLICY IF EXISTS "超级管理员全权限" ON weekly_reports;
