-- 模板版本历史表
CREATE TABLE IF NOT EXISTS template_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES weekly_report_templates(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  version_name TEXT,
  change_description TEXT NOT NULL,
  template_snapshot JSONB NOT NULL, -- 存储模板快照（name, description等）
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(template_id, version_number)
);

-- 模板版本字段表
CREATE TABLE IF NOT EXISTS template_version_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id UUID REFERENCES template_versions(id) ON DELETE CASCADE,
  field_name TEXT NOT NULL,
  field_label TEXT NOT NULL,
  field_type TEXT NOT NULL CHECK (field_type IN ('text', 'textarea', 'number', 'date', 'file')),
  is_required BOOLEAN DEFAULT FALSE,
  display_order INTEGER NOT NULL,
  placeholder TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_template_versions_template_id ON template_versions(template_id);
CREATE INDEX IF NOT EXISTS idx_template_versions_number ON template_versions(template_id, version_number DESC);
CREATE INDEX IF NOT EXISTS idx_version_fields_version_id ON template_version_fields(version_id);
CREATE INDEX IF NOT EXISTS idx_version_fields_order ON template_version_fields(version_id, display_order);

-- RLS策略
ALTER TABLE template_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_version_fields ENABLE ROW LEVEL SECURITY;

-- 版本历史：所有人可查看，仅管理员可创建
CREATE POLICY "Everyone can view template versions" ON template_versions FOR SELECT USING (true);
CREATE POLICY "Admins can create template versions" ON template_versions FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin', 'system_admin')
  )
);

-- 版本字段：所有人可查看，仅管理员可创建
CREATE POLICY "Everyone can view version fields" ON template_version_fields FOR SELECT USING (true);
CREATE POLICY "Admins can create version fields" ON template_version_fields FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin', 'system_admin')
  )
);

-- 为现有模板创建初始版本（v1.0）
DO $$
DECLARE
  template_record RECORD;
  new_version_id UUID;
BEGIN
  FOR template_record IN SELECT * FROM weekly_report_templates LOOP
    -- 创建版本记录
    INSERT INTO template_versions (
      template_id,
      version_number,
      version_name,
      change_description,
      template_snapshot,
      created_by
    ) VALUES (
      template_record.id,
      1,
      'v1.0',
      '初始版本',
      jsonb_build_object(
        'name', template_record.name,
        'description', template_record.description,
        'is_default', template_record.is_default
      ),
      template_record.created_by
    ) RETURNING id INTO new_version_id;

    -- 复制字段到版本字段表
    INSERT INTO template_version_fields (
      version_id,
      field_name,
      field_label,
      field_type,
      is_required,
      display_order,
      placeholder
    )
    SELECT
      new_version_id,
      field_name,
      field_label,
      field_type,
      is_required,
      display_order,
      placeholder
    FROM weekly_report_template_fields
    WHERE template_id = template_record.id;
  END LOOP;
END $$;

-- 添加当前版本号字段到模板表
ALTER TABLE weekly_report_templates ADD COLUMN IF NOT EXISTS current_version INTEGER DEFAULT 1;

-- 更新现有模板的当前版本号
UPDATE weekly_report_templates SET current_version = 1 WHERE current_version IS NULL;
