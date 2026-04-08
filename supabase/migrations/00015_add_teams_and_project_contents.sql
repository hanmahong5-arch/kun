-- 创建小组表
CREATE TABLE IF NOT EXISTS teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 创建小组目标表
CREATE TABLE IF NOT EXISTS team_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  goal_content TEXT NOT NULL,
  progress DECIMAL(5,2) DEFAULT 0,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(team_id, year)
);

-- 创建项目内容模板表
CREATE TABLE IF NOT EXISTS project_content_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  fields_config JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 创建项目内容表
CREATE TABLE IF NOT EXISTS project_contents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  template_id UUID REFERENCES project_content_templates(id) ON DELETE SET NULL,
  content_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  attachments JSONB DEFAULT '[]'::jsonb,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 创建用户小组关联表
CREATE TABLE IF NOT EXISTS user_teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, team_id)
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_teams_display_order ON teams(display_order);
CREATE INDEX IF NOT EXISTS idx_team_goals_team_id ON team_goals(team_id);
CREATE INDEX IF NOT EXISTS idx_team_goals_year ON team_goals(year);
CREATE INDEX IF NOT EXISTS idx_project_contents_project_id ON project_contents(project_id);
CREATE INDEX IF NOT EXISTS idx_project_contents_template_id ON project_contents(template_id);
CREATE INDEX IF NOT EXISTS idx_user_teams_user_id ON user_teams(user_id);
CREATE INDEX IF NOT EXISTS idx_user_teams_team_id ON user_teams(team_id);

-- RLS策略：小组表
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "所有人可查看小组"
  ON teams FOR SELECT
  USING (true);

CREATE POLICY "管理员可管理小组"
  ON teams FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('super_admin', 'system_admin')
    )
  );

-- RLS策略：小组目标表
ALTER TABLE team_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "所有人可查看小组目标"
  ON team_goals FOR SELECT
  USING (true);

CREATE POLICY "管理员可管理小组目标"
  ON team_goals FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('super_admin', 'system_admin')
    )
  );

-- RLS策略：项目内容模板表
ALTER TABLE project_content_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "所有人可查看项目内容模板"
  ON project_content_templates FOR SELECT
  USING (true);

CREATE POLICY "管理员可管理项目内容模板"
  ON project_content_templates FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('super_admin', 'system_admin')
    )
  );

-- RLS策略：项目内容表
ALTER TABLE project_contents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "所有人可查看项目内容"
  ON project_contents FOR SELECT
  USING (true);

CREATE POLICY "用户可创建项目内容"
  ON project_contents FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "用户可更新自己的项目内容"
  ON project_contents FOR UPDATE
  USING (auth.uid() = created_by);

CREATE POLICY "管理员可管理所有项目内容"
  ON project_contents FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('super_admin', 'system_admin')
    )
  );

-- RLS策略：用户小组关联表
ALTER TABLE user_teams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "所有人可查看用户小组关联"
  ON user_teams FOR SELECT
  USING (true);

CREATE POLICY "管理员可管理用户小组关联"
  ON user_teams FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('super_admin', 'system_admin')
    )
  );

-- 插入初始数据：默认小组
INSERT INTO teams (name, description, display_order) VALUES
  ('市场开发组', '负责市场开拓和客户关系维护', 1),
  ('项目执行组', '负责项目实施和进度管理', 2),
  ('技术支持组', '负责技术支持和问题解决', 3)
ON CONFLICT DO NOTHING;

-- 插入初始数据：当前年度小组目标
INSERT INTO team_goals (team_id, year, goal_content, progress)
SELECT 
  t.id,
  EXTRACT(YEAR FROM NOW())::INTEGER,
  '待设置年度目标',
  0
FROM teams t
ON CONFLICT (team_id, year) DO NOTHING;

-- 插入初始数据：默认项目内容模板
INSERT INTO project_content_templates (name, description, fields_config, is_default) VALUES
  (
    '标准项目内容模板',
    '适用于大多数项目的标准内容模板',
    '[
      {"name": "content_summary", "label": "内容摘要", "type": "textarea", "required": true, "placeholder": "请简要描述项目内容"},
      {"name": "key_points", "label": "关键要点", "type": "textarea", "required": false, "placeholder": "列出项目的关键要点"},
      {"name": "remarks", "label": "备注说明", "type": "textarea", "required": false, "placeholder": "其他需要说明的内容"}
    ]'::jsonb,
    true
  ),
  (
    '简化项目内容模板',
    '仅包含基本内容说明的简化模板',
    '[
      {"name": "content", "label": "内容说明", "type": "textarea", "required": true, "placeholder": "请填写项目内容说明"}
    ]'::jsonb,
    false
  )
ON CONFLICT DO NOTHING;
