-- ========================================
-- 创建用户创建日志表
-- ========================================
-- 
-- 功能：记录每次用户创建的详细信息，包括成功和失败的记录
-- 用途：
-- 1. 审计追踪：记录谁在什么时候创建了哪些用户
-- 2. 问题排查：记录失败原因，便于排查问题
-- 3. 数据分析：统计用户创建成功率、失败原因分布等
-- 
-- ========================================

-- 创建user_creation_logs表
CREATE TABLE IF NOT EXISTS user_creation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- 创建结果
  success BOOLEAN NOT NULL,
  
  -- 用户信息
  user_id UUID,  -- 创建成功时的用户ID
  phone TEXT NOT NULL,
  name TEXT NOT NULL,
  role_ids TEXT[] NOT NULL,  -- 角色ID数组
  job_level TEXT,
  department TEXT,
  team_ids TEXT[],  -- 小组ID数组
  
  -- 密码类型
  password_type TEXT NOT NULL CHECK (password_type IN ('default', 'custom', 'random')),
  
  -- 执行步骤
  completed_steps TEXT[] DEFAULT ARRAY[]::TEXT[],  -- 已完成的步骤
  failed_step TEXT,  -- 失败的步骤
  
  -- 错误信息
  error_message TEXT,
  error_details JSONB,
  
  -- 回滚信息
  rollback_attempted BOOLEAN DEFAULT FALSE,
  rollback_success BOOLEAN,
  rollback_details TEXT,
  
  -- 执行时间
  execution_time_ms INTEGER,
  
  -- 操作人信息
  created_by UUID,  -- 操作人ID
  created_by_name TEXT,  -- 操作人姓名
  
  -- 时间戳
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_user_creation_logs_created_at ON user_creation_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_creation_logs_success ON user_creation_logs(success);
CREATE INDEX IF NOT EXISTS idx_user_creation_logs_user_id ON user_creation_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_user_creation_logs_phone ON user_creation_logs(phone);
CREATE INDEX IF NOT EXISTS idx_user_creation_logs_created_by ON user_creation_logs(created_by);

-- 添加注释
COMMENT ON TABLE user_creation_logs IS '用户创建日志表，记录每次用户创建的详细信息';
COMMENT ON COLUMN user_creation_logs.success IS '创建是否成功';
COMMENT ON COLUMN user_creation_logs.user_id IS '创建成功时的用户ID';
COMMENT ON COLUMN user_creation_logs.phone IS '手机号';
COMMENT ON COLUMN user_creation_logs.name IS '姓名';
COMMENT ON COLUMN user_creation_logs.role_ids IS '角色ID数组';
COMMENT ON COLUMN user_creation_logs.password_type IS '密码类型：default-默认密码，custom-自定义密码，random-随机密码';
COMMENT ON COLUMN user_creation_logs.completed_steps IS '已完成的步骤数组';
COMMENT ON COLUMN user_creation_logs.failed_step IS '失败的步骤';
COMMENT ON COLUMN user_creation_logs.error_message IS '错误信息';
COMMENT ON COLUMN user_creation_logs.rollback_attempted IS '是否尝试回滚';
COMMENT ON COLUMN user_creation_logs.rollback_success IS '回滚是否成功';
COMMENT ON COLUMN user_creation_logs.execution_time_ms IS '执行耗时（毫秒）';
COMMENT ON COLUMN user_creation_logs.created_by IS '操作人ID';
COMMENT ON COLUMN user_creation_logs.created_by_name IS '操作人姓名';

-- 启用RLS
ALTER TABLE user_creation_logs ENABLE ROW LEVEL SECURITY;

-- 创建RLS策略：系统管理员可以查看所有日志
CREATE POLICY "system_admin_can_view_user_creation_logs"
  ON user_creation_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'system_admin'
    )
  );

-- 创建RLS策略：Edge Function可以插入日志（使用service_role）
CREATE POLICY "service_role_can_insert_user_creation_logs"
  ON user_creation_logs
  FOR INSERT
  TO service_role
  WITH CHECK (true);
