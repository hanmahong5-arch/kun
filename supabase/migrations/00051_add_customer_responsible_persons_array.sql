-- 添加新的负责人数组字段
ALTER TABLE customers ADD COLUMN IF NOT EXISTS responsible_person_ids jsonb DEFAULT '[]'::jsonb;

-- 将现有的单个负责人ID迁移到数组中
UPDATE customers 
SET responsible_person_ids = jsonb_build_array(responsible_person_id::text)
WHERE responsible_person_id IS NOT NULL;

-- 注释：保留原字段以保持向后兼容，但新代码将使用 responsible_person_ids 数组