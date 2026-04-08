-- 为teams表添加合同额目标和已完成合同额字段
ALTER TABLE teams
ADD COLUMN IF NOT EXISTS contract_target DECIMAL(15, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS contract_completed DECIMAL(15, 2) DEFAULT 0;

-- 添加注释
COMMENT ON COLUMN teams.contract_target IS '合同额目标（万元）';
COMMENT ON COLUMN teams.contract_completed IS '已完成合同额（万元）';