-- 创建teams表
CREATE TABLE IF NOT EXISTS teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  contract_target NUMERIC DEFAULT 0,
  contract_completed NUMERIC DEFAULT 0,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 创建user_teams关联表
CREATE TABLE IF NOT EXISTS user_teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, team_id)
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_teams_display_order ON teams(display_order);
CREATE INDEX IF NOT EXISTS idx_user_teams_user_id ON user_teams(user_id);
CREATE INDEX IF NOT EXISTS idx_user_teams_team_id ON user_teams(team_id);

-- 启用RLS
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_teams ENABLE ROW LEVEL SECURITY;

-- teams表的RLS策略
CREATE POLICY "所有人可查看小组" ON teams FOR SELECT USING (true);
CREATE POLICY "管理员可创建小组" ON teams FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND role = 'system_admin'
  )
);
CREATE POLICY "管理员可更新小组" ON teams FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND role = 'system_admin'
  )
);
CREATE POLICY "管理员可删除小组" ON teams FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND role = 'system_admin'
  )
);

-- user_teams表的RLS策略
CREATE POLICY "所有人可查看小组成员" ON user_teams FOR SELECT USING (true);
CREATE POLICY "管理员可添加小组成员" ON user_teams FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND role = 'system_admin'
  )
);
CREATE POLICY "管理员可删除小组成员" ON user_teams FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND role = 'system_admin'
  )
);