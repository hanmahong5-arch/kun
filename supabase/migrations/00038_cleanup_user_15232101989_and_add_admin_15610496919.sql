-- ========================================
-- 用户数据清理和管理员添加
-- ========================================
-- 
-- 目标：
-- 1. 删除用户15232101989（常东松）
-- 2. 将其业务数据转移给管理员17685587922
-- 3. 添加新管理员15610496919
-- 
-- ========================================

-- 步骤1：将用户15232101989的所有业务数据转移给管理员17685587922
DO $$
DECLARE
  old_user_id UUID := '22222222-2222-2222-2222-222222222222';
  new_user_id UUID := '1249d8fe-3bb4-4c89-9f47-02565e90bd19';
BEGIN
  -- 转移annual_goals
  UPDATE annual_goals SET created_by = new_user_id WHERE created_by = old_user_id;
  
  -- 转移annual_targets
  UPDATE annual_targets SET created_by = new_user_id WHERE created_by = old_user_id;
  UPDATE annual_targets SET updated_by = new_user_id WHERE updated_by = old_user_id;
  
  -- 转移audit_logs（保留历史记录，不转移）
  -- UPDATE audit_logs SET user_id = new_user_id WHERE user_id = old_user_id;
  
  -- 转移bids
  UPDATE bids SET created_by = new_user_id WHERE created_by = old_user_id;
  
  -- 转移customer_follow_ups
  UPDATE customer_follow_ups SET user_id = new_user_id WHERE user_id = old_user_id;
  
  -- 转移customers
  UPDATE customers SET responsible_person_id = new_user_id WHERE responsible_person_id = old_user_id;
  
  -- 转移documents
  UPDATE documents SET uploaded_by = new_user_id WHERE uploaded_by = old_user_id;
  
  -- 转移job_level_role_mapping
  UPDATE job_level_role_mapping SET created_by = new_user_id WHERE created_by = old_user_id;
  
  -- 转移leader_dashboards
  UPDATE leader_dashboards SET user_id = new_user_id WHERE user_id = old_user_id;
  
  -- 转移module_permissions
  UPDATE module_permissions SET user_id = new_user_id WHERE user_id = old_user_id;
  
  -- 转移notifications
  UPDATE notifications SET user_id = new_user_id WHERE user_id = old_user_id;
  
  -- 转移operation_logs（保留历史记录，不转移）
  -- UPDATE operation_logs SET user_id = new_user_id WHERE user_id = old_user_id;
  
  -- 转移permission_change_logs
  UPDATE permission_change_logs SET user_id = new_user_id WHERE user_id = old_user_id;
  UPDATE permission_change_logs SET changed_by = new_user_id WHERE changed_by = old_user_id;
  
  -- 转移profiles（approved_by）
  UPDATE profiles SET approved_by = new_user_id WHERE approved_by = old_user_id;
  
  -- 转移project_content_templates
  UPDATE project_content_templates SET created_by = new_user_id WHERE created_by = old_user_id;
  
  -- 转移project_contents
  UPDATE project_contents SET created_by = new_user_id WHERE created_by = old_user_id;
  
  -- 转移project_follow_ups
  UPDATE project_follow_ups SET user_id = new_user_id WHERE user_id = old_user_id;
  
  -- 转移project_tracking_records
  UPDATE project_tracking_records SET updated_by = new_user_id WHERE updated_by = old_user_id;
  
  -- 转移projects
  UPDATE projects SET responsible_person_id = new_user_id WHERE responsible_person_id = old_user_id;
  
  -- 转移report_alerts
  UPDATE report_alerts SET read_by = new_user_id WHERE read_by = old_user_id;
  
  -- 转移report_configs
  UPDATE report_configs SET created_by = new_user_id WHERE created_by = old_user_id;
  
  -- 转移report_task_relations
  UPDATE report_task_relations SET created_by = new_user_id WHERE created_by = old_user_id;
  
  -- 转移review_history
  UPDATE review_history SET reviewer_id = new_user_id WHERE reviewer_id = old_user_id;
  
  -- 转移task_notifications
  UPDATE task_notifications SET recipient_id = new_user_id WHERE recipient_id = old_user_id;
  
  -- 转移task_progress_updates
  UPDATE task_progress_updates SET updated_by = new_user_id WHERE updated_by = old_user_id;
  
  -- 转移tasks
  UPDATE tasks SET assigned_by = new_user_id WHERE assigned_by = old_user_id;
  UPDATE tasks SET confirmed_by = new_user_id WHERE confirmed_by = old_user_id;
  UPDATE tasks SET responsible_person_id = new_user_id WHERE responsible_person_id = old_user_id;
  
  -- 转移team_goals
  UPDATE team_goals SET created_by = new_user_id WHERE created_by = old_user_id;
  
  -- 转移teams
  UPDATE teams SET created_by = new_user_id WHERE created_by = old_user_id;
  
  -- 转移template_versions
  UPDATE template_versions SET created_by = new_user_id WHERE created_by = old_user_id;
  
  -- 转移user_roles（assigned_by）
  UPDATE user_roles SET assigned_by = new_user_id WHERE assigned_by = old_user_id;
  
  -- 转移weekly_report_templates
  UPDATE weekly_report_templates SET created_by = new_user_id WHERE created_by = old_user_id;
  
  -- 转移weekly_reports
  UPDATE weekly_reports SET user_id = new_user_id WHERE user_id = old_user_id;
  UPDATE weekly_reports SET reviewed_by = new_user_id WHERE reviewed_by = old_user_id;
  
  RAISE NOTICE '业务数据转移完成';
END $$;

-- 步骤2：删除用户15232101989的关联数据
DELETE FROM user_roles WHERE user_id = '22222222-2222-2222-2222-222222222222';
DELETE FROM user_teams WHERE user_id = '22222222-2222-2222-2222-222222222222';
DELETE FROM profiles WHERE id = '22222222-2222-2222-2222-222222222222';

-- 步骤3：删除Auth用户（需要在Edge Function中执行，这里只是标记）
-- 注意：auth.users表的删除需要使用Supabase Admin API

-- 步骤4：验证清理结果
SELECT 
  'cleanup_completed' as status,
  COUNT(*) as remaining_profiles
FROM profiles;