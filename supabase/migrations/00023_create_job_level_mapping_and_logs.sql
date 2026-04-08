-- 创建职级-角色映射表
CREATE TABLE IF NOT EXISTS job_level_role_mapping (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_level VARCHAR(50) NOT NULL,
  role VARCHAR(50) NOT NULL,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(job_level, role)
);

-- 创建权限变更日志表
CREATE TABLE IF NOT EXISTS permission_change_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id),
  old_role VARCHAR(50),
  new_role VARCHAR(50),
  old_job_level VARCHAR(50),
  new_job_level VARCHAR(50),
  changed_by UUID REFERENCES profiles(id),
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 添加索引
CREATE INDEX IF NOT EXISTS idx_job_level_mapping_job_level ON job_level_role_mapping(job_level);
CREATE INDEX IF NOT EXISTS idx_job_level_mapping_role ON job_level_role_mapping(role);
CREATE INDEX IF NOT EXISTS idx_permission_logs_user_id ON permission_change_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_permission_logs_created_at ON permission_change_logs(created_at DESC);

-- 添加注释
COMMENT ON TABLE job_level_role_mapping IS '职级与角色映射关系表';
COMMENT ON TABLE permission_change_logs IS '权限变更日志表';

-- RLS策略：职级-角色映射表（仅管理员可操作）
ALTER TABLE job_level_role_mapping ENABLE ROW LEVEL SECURITY;

CREATE POLICY "管理员可查看所有映射" ON job_level_role_mapping
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('super_admin', 'system_admin')
    )
  );

CREATE POLICY "管理员可插入映射" ON job_level_role_mapping
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('super_admin', 'system_admin')
    )
  );

CREATE POLICY "管理员可更新映射" ON job_level_role_mapping
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('super_admin', 'system_admin')
    )
  );

CREATE POLICY "管理员可删除映射" ON job_level_role_mapping
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('super_admin', 'system_admin')
    )
  );

-- RLS策略：权限变更日志表
ALTER TABLE permission_change_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "管理员可查看所有日志" ON permission_change_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('super_admin', 'system_admin')
    )
  );

CREATE POLICY "用户可查看自己的日志" ON permission_change_logs
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "管理员可插入日志" ON permission_change_logs
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('super_admin', 'system_admin')
    )
  );

-- 插入默认映射关系
INSERT INTO job_level_role_mapping (job_level, role) VALUES
  ('主要领导', 'leader'),
  ('分管领导', 'leader'),
  ('总经理助理', 'leader'),
  ('主任', 'market_staff'),
  ('高级经理', 'market_staff'),
  ('一级职员', 'market_staff'),
  ('二级职员', 'market_staff'),
  ('三级职员', 'market_staff'),
  ('资料员', 'data_clerk')
ON CONFLICT (job_level, role) DO NOTHING;