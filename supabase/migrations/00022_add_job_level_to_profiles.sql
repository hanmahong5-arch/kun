-- 添加职级字段到profiles表
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS job_level VARCHAR(50);

-- 添加注释
COMMENT ON COLUMN profiles.job_level IS '职级：主要领导、分管领导、总经理助理、主任、高级经理、一级职员、二级职员、三级职员、资料员';

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_profiles_job_level ON profiles(job_level);