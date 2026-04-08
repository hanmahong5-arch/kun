-- 清理"孤儿"Auth用户脚本
-- 
-- 问题说明：
-- 当Auth用户创建成功但Profile创建失败时，会产生"孤儿"Auth用户
-- 这些用户在auth.users表中存在，但在profiles表中不存在
-- 导致后续无法使用相同手机号创建用户
--
-- 使用方法：
-- 1. 先查询"孤儿"用户（只查询，不删除）
-- 2. 确认后再执行清理操作

-- ========== 步骤1：查询"孤儿"Auth用户 ==========

-- 查询在auth.users中存在但在profiles中不存在的用户
SELECT 
  u.id,
  u.email,
  u.phone,
  u.created_at,
  u.email_confirmed_at,
  u.phone_confirmed_at
FROM auth.users u
LEFT JOIN profiles p ON u.id = p.id
WHERE p.id IS NULL
ORDER BY u.created_at DESC;

-- 如果上面的查询返回了结果，说明存在"孤儿"用户
-- 记录这些用户的ID，然后继续下一步

-- ========== 步骤2：清理"孤儿"Auth用户 ==========

-- 注意：这个操作会永久删除数据，请谨慎执行！
-- 建议先在测试环境执行，确认无误后再在生产环境执行

-- 方法1：使用Supabase Admin API删除（推荐）
-- 在Edge Function或管理脚本中执行：
-- await supabaseAdmin.auth.admin.deleteUser(userId)

-- 方法2：直接删除auth.users记录（需要超级管理员权限）
-- 警告：这种方法可能会破坏数据完整性，不推荐使用
-- DELETE FROM auth.users 
-- WHERE id IN (
--   SELECT u.id
--   FROM auth.users u
--   LEFT JOIN profiles p ON u.id = p.id
--   WHERE p.id IS NULL
-- );

-- ========== 步骤3：验证清理结果 ==========

-- 再次查询，确认"孤儿"用户已被清理
SELECT 
  u.id,
  u.email,
  u.phone,
  u.created_at
FROM auth.users u
LEFT JOIN profiles p ON u.id = p.id
WHERE p.id IS NULL;

-- 如果返回0条记录，说明清理成功

-- ========== 步骤4：查询特定手机号的用户状态 ==========

-- 如果你知道具体的手机号，可以用这个查询检查状态
-- 替换 '13800138000' 为实际的手机号
SELECT 
  'auth.users' as table_name,
  u.id,
  u.email,
  u.phone,
  u.created_at,
  u.email_confirmed_at,
  u.phone_confirmed_at
FROM auth.users u
WHERE u.phone = '13800138000'

UNION ALL

SELECT 
  'profiles' as table_name,
  p.id,
  p.phone as email,
  p.name as phone,
  p.created_at,
  p.approved_at as email_confirmed_at,
  NULL as phone_confirmed_at
FROM profiles p
WHERE p.phone = '13800138000';

-- ========== 预防措施 ==========

-- 为了防止将来再次出现"孤儿"用户，建议：
-- 1. 确保Edge Function的错误处理逻辑正确（已在代码中实现）
-- 2. 定期运行清理脚本检查"孤儿"用户
-- 3. 监控Edge Function日志，及时发现问题

-- ========== 手动清理特定用户 ==========

-- 如果需要清理特定手机号的"孤儿"用户：
-- 1. 先查询该用户的ID
SELECT id FROM auth.users WHERE phone = '13800138000';

-- 2. 使用Supabase Admin API删除（在Edge Function或管理脚本中）
-- await supabaseAdmin.auth.admin.deleteUser('用户ID')

-- 或者在SQL中（需要超级管理员权限）：
-- DELETE FROM auth.users WHERE phone = '13800138000' AND id NOT IN (SELECT id FROM profiles);
