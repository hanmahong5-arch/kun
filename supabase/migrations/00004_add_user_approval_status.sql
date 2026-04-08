
-- 添加用户审核状态枚举类型
CREATE TYPE user_status AS ENUM ('pending', 'approved', 'rejected');

-- 为profiles表添加审核状态字段
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS status user_status DEFAULT 'pending';

-- 将现有用户设置为已审核状态
UPDATE profiles SET status = 'approved' WHERE status IS NULL OR status = 'pending';

-- 添加审核相关字段
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES profiles(id);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- 添加注释
COMMENT ON COLUMN profiles.status IS '用户审核状态：pending-待审核，approved-已通过，rejected-已拒绝';
COMMENT ON COLUMN profiles.approved_by IS '审核人ID';
COMMENT ON COLUMN profiles.approved_at IS '审核时间';
COMMENT ON COLUMN profiles.rejection_reason IS '拒绝原因';
