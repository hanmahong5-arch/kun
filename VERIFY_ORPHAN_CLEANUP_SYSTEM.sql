-- ========================================
-- 孤儿用户清理系统 - 验证脚本
-- ========================================
-- 
-- 使用方法：
-- 1. 在Supabase Dashboard的SQL Editor中打开此脚本
-- 2. 逐个执行查询语句
-- 3. 验证系统是否正常工作
-- 
-- ========================================

-- ========================================
-- 1. 验证表是否存在
-- ========================================

-- 检查cleanup_logs表
SELECT 
  table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'cleanup_logs'
ORDER BY ordinal_position;

-- 检查consistency_check_logs表
SELECT 
  table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'consistency_check_logs'
ORDER BY ordinal_position;

-- ========================================
-- 2. 验证存储过程是否存在
-- ========================================

-- 检查存储过程
SELECT 
  routine_name,
  routine_type,
  data_type
FROM information_schema.routines
WHERE routine_name IN (
  'get_orphan_auth_users',
  'get_orphan_profiles',
  'auto_cleanup_orphan_users'
)
ORDER BY routine_name;

-- ========================================
-- 3. 验证定时任务是否存在
-- ========================================

-- 检查pg_cron扩展
SELECT * FROM pg_extension WHERE extname = 'pg_cron';

-- 检查定时任务
SELECT 
  jobid,
  schedule,
  command,
  nodename,
  nodeport,
  database,
  username,
  active,
  jobname
FROM cron.job
WHERE jobname = 'auto-cleanup-orphan-users';

-- 查看定时任务执行历史（最近10次）
SELECT 
  jobid,
  runid,
  job_pid,
  database,
  username,
  command,
  status,
  return_message,
  start_time,
  end_time
FROM cron.job_run_details
WHERE jobid = (
  SELECT jobid FROM cron.job WHERE jobname = 'auto-cleanup-orphan-users'
)
ORDER BY start_time DESC
LIMIT 10;

-- ========================================
-- 4. 验证RLS策略是否存在
-- ========================================

-- 检查cleanup_logs表的RLS策略
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'cleanup_logs';

-- 检查consistency_check_logs表的RLS策略
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'consistency_check_logs';

-- ========================================
-- 5. 查询孤儿用户
-- ========================================

-- 查询孤儿Auth用户
SELECT * FROM get_orphan_auth_users();

-- 查询孤儿Profile记录
SELECT * FROM get_orphan_profiles();

-- 统计孤儿用户数量
SELECT 
  (SELECT COUNT(*) FROM get_orphan_auth_users()) as orphan_auth_count,
  (SELECT COUNT(*) FROM get_orphan_profiles()) as orphan_profile_count;

-- ========================================
-- 6. 查询清理日志
-- ========================================

-- 查询最近10条清理日志
SELECT 
  id,
  cleaned_at,
  orphan_count,
  trigger_type,
  status,
  execution_time_ms,
  CASE 
    WHEN error_message IS NOT NULL THEN '有错误'
    ELSE '无错误'
  END as has_error
FROM cleanup_logs
ORDER BY cleaned_at DESC
LIMIT 10;

-- 统计清理日志
SELECT 
  trigger_type,
  status,
  COUNT(*) as count,
  SUM(orphan_count) as total_orphan_count,
  AVG(execution_time_ms) as avg_execution_time_ms
FROM cleanup_logs
GROUP BY trigger_type, status
ORDER BY trigger_type, status;

-- 查询需要告警的清理记录
SELECT 
  id,
  cleaned_at,
  orphan_count,
  trigger_type,
  status
FROM cleanup_logs
WHERE orphan_count > 2
ORDER BY cleaned_at DESC;

-- ========================================
-- 7. 查询一致性检查日志
-- ========================================

-- 查询最近10条一致性检查日志
SELECT 
  id,
  checked_at,
  operator_name,
  orphan_auth_count,
  orphan_profile_count,
  fixed,
  execution_time_ms
FROM consistency_check_logs
ORDER BY checked_at DESC
LIMIT 10;

-- 统计一致性检查日志
SELECT 
  fixed,
  COUNT(*) as count,
  SUM(orphan_auth_count) as total_orphan_auth_count,
  SUM(orphan_profile_count) as total_orphan_profile_count,
  AVG(execution_time_ms) as avg_execution_time_ms
FROM consistency_check_logs
GROUP BY fixed
ORDER BY fixed;

-- 查询修复操作的详细结果
SELECT 
  id,
  checked_at,
  operator_name,
  orphan_auth_count,
  orphan_profile_count,
  fix_result
FROM consistency_check_logs
WHERE fixed = true
ORDER BY checked_at DESC;

-- ========================================
-- 8. 验证索引是否存在
-- ========================================

-- 检查cleanup_logs表的索引
SELECT 
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'cleanup_logs'
ORDER BY indexname;

-- 检查consistency_check_logs表的索引
SELECT 
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'consistency_check_logs'
ORDER BY indexname;

-- ========================================
-- 9. 测试存储过程
-- ========================================

-- 测试auto_cleanup_orphan_users（仅查询，不实际清理）
-- 注意：此操作会记录一条清理日志
SELECT auto_cleanup_orphan_users();

-- ========================================
-- 10. 系统健康检查
-- ========================================

-- 检查系统整体状态
SELECT 
  '表结构' as check_item,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cleanup_logs')
      AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'consistency_check_logs')
    THEN '✅ 正常'
    ELSE '❌ 异常'
  END as status
UNION ALL
SELECT 
  '存储过程' as check_item,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'get_orphan_auth_users')
      AND EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'get_orphan_profiles')
      AND EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'auto_cleanup_orphan_users')
    THEN '✅ 正常'
    ELSE '❌ 异常'
  END as status
UNION ALL
SELECT 
  '定时任务' as check_item,
  CASE 
    WHEN EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'auto-cleanup-orphan-users')
    THEN '✅ 正常'
    ELSE '❌ 异常'
  END as status
UNION ALL
SELECT 
  'RLS策略' as check_item,
  CASE 
    WHEN EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'cleanup_logs')
      AND EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'consistency_check_logs')
    THEN '✅ 正常'
    ELSE '❌ 异常'
  END as status
UNION ALL
SELECT 
  '孤儿用户' as check_item,
  CASE 
    WHEN (SELECT COUNT(*) FROM get_orphan_auth_users()) = 0
      AND (SELECT COUNT(*) FROM get_orphan_profiles()) = 0
    THEN '✅ 无孤儿用户'
    WHEN (SELECT COUNT(*) FROM get_orphan_auth_users()) <= 2
      AND (SELECT COUNT(*) FROM get_orphan_profiles()) <= 2
    THEN '⚠️ 有少量孤儿用户'
    ELSE '❌ 孤儿用户较多'
  END as status;

-- ========================================
-- 验证完成
-- ========================================

-- 显示验证摘要
SELECT 
  '验证完成' as message,
  NOW() as verified_at;
