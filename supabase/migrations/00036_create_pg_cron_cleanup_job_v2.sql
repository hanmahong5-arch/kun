
-- ========================================
-- 启用pg_cron扩展
-- ========================================

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- ========================================
-- 创建定时任务：每天凌晨2点（UTC）清理孤儿用户
-- ========================================

-- 创建定时任务
SELECT cron.schedule(
  'auto-cleanup-orphan-users',  -- 任务名称
  '0 2 * * *',  -- Cron表达式：每天凌晨2点（UTC）
  $$
    SELECT auto_cleanup_orphan_users();
  $$
);
