-- 为projects表添加预计开标时间字段
ALTER TABLE projects ADD COLUMN IF NOT EXISTS expected_opening_date DATE;