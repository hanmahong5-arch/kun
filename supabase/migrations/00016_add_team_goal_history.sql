-- 创建小组目标历史表
CREATE TABLE IF NOT EXISTS team_goal_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
  progress DECIMAL(5,2) NOT NULL DEFAULT 0,
  goal_content TEXT,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_team_goal_history_team_id ON team_goal_history(team_id);
CREATE INDEX IF NOT EXISTS idx_team_goal_history_year_month ON team_goal_history(year, month);
CREATE INDEX IF NOT EXISTS idx_team_goal_history_recorded_at ON team_goal_history(recorded_at);

-- RLS策略
ALTER TABLE team_goal_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "所有人可查看小组目标历史"
  ON team_goal_history FOR SELECT
  USING (true);

CREATE POLICY "管理员可管理小组目标历史"
  ON team_goal_history FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('super_admin', 'system_admin')
    )
  );

-- 插入当前小组目标作为历史记录
INSERT INTO team_goal_history (team_id, year, month, progress, goal_content)
SELECT 
  tg.team_id,
  tg.year,
  EXTRACT(MONTH FROM NOW())::INTEGER,
  tg.progress,
  tg.goal_content
FROM team_goals tg
ON CONFLICT DO NOTHING;