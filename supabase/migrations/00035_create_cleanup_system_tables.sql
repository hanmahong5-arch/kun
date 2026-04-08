
-- ========================================
-- 清理日志表
-- ========================================

-- 创建cleanup_logs表，用于记录孤儿用户清理历史
CREATE TABLE IF NOT EXISTS cleanup_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cleaned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  orphan_count INTEGER NOT NULL DEFAULT 0,
  cleaned_user_ids TEXT[] NOT NULL DEFAULT '{}',
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('auto', 'manual')),
  status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'partial')),
  error_message TEXT,
  execution_time_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_cleanup_logs_cleaned_at ON cleanup_logs(cleaned_at DESC);
CREATE INDEX IF NOT EXISTS idx_cleanup_logs_trigger_type ON cleanup_logs(trigger_type);
CREATE INDEX IF NOT EXISTS idx_cleanup_logs_status ON cleanup_logs(status);

-- 添加注释
COMMENT ON TABLE cleanup_logs IS '孤儿用户清理日志表';
COMMENT ON COLUMN cleanup_logs.cleaned_at IS '清理时间';
COMMENT ON COLUMN cleanup_logs.orphan_count IS '清理的孤儿用户数量';
COMMENT ON COLUMN cleanup_logs.cleaned_user_ids IS '被清理的用户ID列表';
COMMENT ON COLUMN cleanup_logs.trigger_type IS '触发类型：auto-自动定时任务，manual-手动触发';
COMMENT ON COLUMN cleanup_logs.status IS '执行状态：success-成功，failed-失败，partial-部分成功';
COMMENT ON COLUMN cleanup_logs.error_message IS '错误信息（如果有）';
COMMENT ON COLUMN cleanup_logs.execution_time_ms IS '执行耗时（毫秒）';

-- ========================================
-- 数据一致性检查日志表
-- ========================================

-- 创建consistency_check_logs表，用于记录数据一致性检查历史
CREATE TABLE IF NOT EXISTS consistency_check_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  operator_id UUID REFERENCES auth.users(id),
  operator_name TEXT,
  orphan_auth_count INTEGER NOT NULL DEFAULT 0,
  orphan_profile_count INTEGER NOT NULL DEFAULT 0,
  orphan_auth_ids TEXT[] NOT NULL DEFAULT '{}',
  orphan_profile_ids TEXT[] NOT NULL DEFAULT '{}',
  fixed BOOLEAN NOT NULL DEFAULT FALSE,
  fix_result JSONB,
  execution_time_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_consistency_check_logs_checked_at ON consistency_check_logs(checked_at DESC);
CREATE INDEX IF NOT EXISTS idx_consistency_check_logs_operator_id ON consistency_check_logs(operator_id);
CREATE INDEX IF NOT EXISTS idx_consistency_check_logs_fixed ON consistency_check_logs(fixed);

-- 添加注释
COMMENT ON TABLE consistency_check_logs IS '数据一致性检查日志表';
COMMENT ON COLUMN consistency_check_logs.checked_at IS '检查时间';
COMMENT ON COLUMN consistency_check_logs.operator_id IS '操作人ID';
COMMENT ON COLUMN consistency_check_logs.operator_name IS '操作人姓名';
COMMENT ON COLUMN consistency_check_logs.orphan_auth_count IS '孤儿Auth用户数量';
COMMENT ON COLUMN consistency_check_logs.orphan_profile_count IS '孤儿Profile记录数量';
COMMENT ON COLUMN consistency_check_logs.orphan_auth_ids IS '孤儿Auth用户ID列表';
COMMENT ON COLUMN consistency_check_logs.orphan_profile_ids IS '孤儿Profile记录ID列表';
COMMENT ON COLUMN consistency_check_logs.fixed IS '是否已修复';
COMMENT ON COLUMN consistency_check_logs.fix_result IS '修复结果详情';
COMMENT ON COLUMN consistency_check_logs.execution_time_ms IS '执行耗时（毫秒）';

-- ========================================
-- RLS策略
-- ========================================

-- cleanup_logs表的RLS策略
ALTER TABLE cleanup_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "System admins can view all cleanup logs"
  ON cleanup_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'system_admin'
    )
  );

-- consistency_check_logs表的RLS策略
ALTER TABLE consistency_check_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "System admins can view all consistency check logs"
  ON consistency_check_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'system_admin'
    )
  );

-- ========================================
-- 存储过程：检测孤儿用户
-- ========================================

-- 创建函数：获取孤儿Auth用户列表
CREATE OR REPLACE FUNCTION get_orphan_auth_users()
RETURNS TABLE (
  id UUID,
  email TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.id,
    u.email,
    u.phone,
    u.created_at
  FROM auth.users u
  LEFT JOIN profiles p ON u.id = p.id
  WHERE p.id IS NULL
  ORDER BY u.created_at DESC;
END;
$$;

COMMENT ON FUNCTION get_orphan_auth_users() IS '获取孤儿Auth用户列表（在auth.users中存在但在profiles中不存在）';

-- 创建函数：获取孤儿Profile记录列表
CREATE OR REPLACE FUNCTION get_orphan_profiles()
RETURNS TABLE (
  id UUID,
  phone TEXT,
  name TEXT,
  created_at TIMESTAMPTZ
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.phone,
    p.name,
    p.created_at
  FROM profiles p
  LEFT JOIN auth.users u ON p.id = u.id
  WHERE u.id IS NULL
  ORDER BY p.created_at DESC;
END;
$$;

COMMENT ON FUNCTION get_orphan_profiles() IS '获取孤儿Profile记录列表（在profiles中存在但在auth.users中不存在）';

-- ========================================
-- 存储过程：自动清理孤儿用户
-- ========================================

-- 创建函数：自动清理孤儿用户（由定时任务调用）
CREATE OR REPLACE FUNCTION auto_cleanup_orphan_users()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_start_time TIMESTAMPTZ;
  v_end_time TIMESTAMPTZ;
  v_execution_time_ms INTEGER;
  v_orphan_users RECORD;
  v_orphan_count INTEGER := 0;
  v_cleaned_ids TEXT[] := '{}';
  v_log_id UUID;
  v_result JSONB;
BEGIN
  -- 记录开始时间
  v_start_time := clock_timestamp();
  
  -- 获取孤儿用户列表
  SELECT 
    COUNT(*) as count,
    ARRAY_AGG(id::TEXT) as ids
  INTO v_orphan_users
  FROM get_orphan_auth_users();
  
  v_orphan_count := COALESCE(v_orphan_users.count, 0);
  v_cleaned_ids := COALESCE(v_orphan_users.ids, '{}');
  
  -- 记录结束时间
  v_end_time := clock_timestamp();
  v_execution_time_ms := EXTRACT(MILLISECONDS FROM (v_end_time - v_start_time))::INTEGER;
  
  -- 插入清理日志
  INSERT INTO cleanup_logs (
    cleaned_at,
    orphan_count,
    cleaned_user_ids,
    trigger_type,
    status,
    execution_time_ms
  ) VALUES (
    v_start_time,
    v_orphan_count,
    v_cleaned_ids,
    'auto',
    CASE 
      WHEN v_orphan_count = 0 THEN 'success'
      ELSE 'success'
    END,
    v_execution_time_ms
  ) RETURNING id INTO v_log_id;
  
  -- 构造返回结果
  v_result := jsonb_build_object(
    'log_id', v_log_id,
    'orphan_count', v_orphan_count,
    'cleaned_user_ids', v_cleaned_ids,
    'execution_time_ms', v_execution_time_ms,
    'should_alert', v_orphan_count > 2
  );
  
  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION auto_cleanup_orphan_users() IS '自动清理孤儿用户（由定时任务调用）';
