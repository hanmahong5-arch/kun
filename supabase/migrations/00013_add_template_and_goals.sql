-- 周报模板主表
CREATE TABLE IF NOT EXISTS weekly_report_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  is_default BOOLEAN DEFAULT FALSE,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 周报模板字段表
CREATE TABLE IF NOT EXISTS weekly_report_template_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES weekly_report_templates(id) ON DELETE CASCADE,
  field_name TEXT NOT NULL,
  field_label TEXT NOT NULL,
  field_type TEXT NOT NULL CHECK (field_type IN ('text', 'textarea', 'number', 'date', 'file')),
  is_required BOOLEAN DEFAULT FALSE,
  display_order INTEGER NOT NULL,
  placeholder TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 部门模板映射表
CREATE TABLE IF NOT EXISTS department_template_mapping (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department TEXT NOT NULL,
  template_id UUID REFERENCES weekly_report_templates(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(department)
);

-- 年度目标表
CREATE TABLE IF NOT EXISTS annual_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year INTEGER NOT NULL,
  goal_type TEXT NOT NULL,
  goal_content TEXT NOT NULL,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(year, goal_type)
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_template_fields_template_id ON weekly_report_template_fields(template_id);
CREATE INDEX IF NOT EXISTS idx_template_fields_order ON weekly_report_template_fields(template_id, display_order);
CREATE INDEX IF NOT EXISTS idx_department_mapping_dept ON department_template_mapping(department);
CREATE INDEX IF NOT EXISTS idx_annual_goals_year ON annual_goals(year);

-- RLS策略
ALTER TABLE weekly_report_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_report_template_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE department_template_mapping ENABLE ROW LEVEL SECURITY;
ALTER TABLE annual_goals ENABLE ROW LEVEL SECURITY;

-- 周报模板：所有人可查看，仅管理员可编辑
CREATE POLICY "Everyone can view templates" ON weekly_report_templates FOR SELECT USING (true);
CREATE POLICY "Admins can manage templates" ON weekly_report_templates FOR ALL USING (
  EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin', 'system_admin')
  )
);

-- 模板字段：所有人可查看，仅管理员可编辑
CREATE POLICY "Everyone can view template fields" ON weekly_report_template_fields FOR SELECT USING (true);
CREATE POLICY "Admins can manage template fields" ON weekly_report_template_fields FOR ALL USING (
  EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin', 'system_admin')
  )
);

-- 部门映射：所有人可查看，仅管理员可编辑
CREATE POLICY "Everyone can view department mapping" ON department_template_mapping FOR SELECT USING (true);
CREATE POLICY "Admins can manage department mapping" ON department_template_mapping FOR ALL USING (
  EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin', 'system_admin')
  )
);

-- 年度目标：所有人可查看，仅管理员可编辑
CREATE POLICY "Everyone can view annual goals" ON annual_goals FOR SELECT USING (true);
CREATE POLICY "Admins can manage annual goals" ON annual_goals FOR ALL USING (
  EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin', 'system_admin')
  )
);

-- 修改weekly_reports表，添加custom_fields字段存储自定义字段数据
ALTER TABLE weekly_reports ADD COLUMN IF NOT EXISTS custom_fields JSONB DEFAULT '{}'::jsonb;
ALTER TABLE weekly_reports ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES weekly_report_templates(id);

-- 插入默认模板
INSERT INTO weekly_report_templates (name, description, is_default) 
VALUES ('默认周报模板', '系统默认的周报模板', true)
ON CONFLICT DO NOTHING;

-- 获取默认模板ID并插入默认字段
DO $$
DECLARE
  default_template_id UUID;
BEGIN
  SELECT id INTO default_template_id FROM weekly_report_templates WHERE is_default = true LIMIT 1;
  
  IF default_template_id IS NOT NULL THEN
    INSERT INTO weekly_report_template_fields (template_id, field_name, field_label, field_type, is_required, display_order, placeholder)
    VALUES 
      (default_template_id, 'work_completed', '本周核心工作完成情况', 'textarea', true, 1, '请详细描述本周完成的主要工作内容'),
      (default_template_id, 'project_progress', '项目跟踪进展', 'textarea', true, 2, '请说明项目推进情况'),
      (default_template_id, 'bidding_work', '投标工作推进', 'textarea', true, 3, '请说明投标相关工作'),
      (default_template_id, 'customer_contact', '客户对接情况', 'textarea', true, 4, '请说明客户沟通情况'),
      (default_template_id, 'next_week_plan', '下周工作计划', 'textarea', true, 5, '请列出下周计划开展的工作'),
      (default_template_id, 'issues', '存在问题与协调需求', 'textarea', false, 6, '如有问题或需要协调的事项，请在此说明')
    ON CONFLICT DO NOTHING;
  END IF;
END $$;
