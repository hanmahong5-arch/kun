-- 修改weekly_reports表，将字段改为可空，并添加项目关联字段
ALTER TABLE weekly_reports 
  ALTER COLUMN core_work DROP NOT NULL,
  ALTER COLUMN project_progress DROP NOT NULL,
  ALTER COLUMN bidding_work DROP NOT NULL,
  ALTER COLUMN customer_contact DROP NOT NULL,
  ALTER COLUMN next_week_plan DROP NOT NULL;

-- 添加关联项目字段（存储项目ID数组）
ALTER TABLE weekly_reports 
  ADD COLUMN IF NOT EXISTS related_projects jsonb DEFAULT '[]'::jsonb;

-- 添加注释
COMMENT ON COLUMN weekly_reports.related_projects IS '关联的项目ID数组';
COMMENT ON COLUMN weekly_reports.core_work IS '工作完成情况';
COMMENT ON COLUMN weekly_reports.project_progress IS '主要项目推进进展';
COMMENT ON COLUMN weekly_reports.next_week_plan IS '下周工作计划';
COMMENT ON COLUMN weekly_reports.issues IS '存在问题及协调需求';