-- 为weekly_reports表添加审阅相关字段
ALTER TABLE weekly_reports
ADD COLUMN IF NOT EXISTS review_status VARCHAR(20) DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES profiles(id),
ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS review_comment TEXT;

-- 添加注释
COMMENT ON COLUMN weekly_reports.review_status IS '审阅状态: pending-待审阅, approved-已通过, rejected-需修改';
COMMENT ON COLUMN weekly_reports.reviewed_by IS '审阅人ID';
COMMENT ON COLUMN weekly_reports.reviewed_at IS '审阅时间';
COMMENT ON COLUMN weekly_reports.review_comment IS '审阅批注';

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_weekly_reports_review_status ON weekly_reports(review_status);
CREATE INDEX IF NOT EXISTS idx_weekly_reports_reviewed_by ON weekly_reports(reviewed_by);