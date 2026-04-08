-- 为weekly_reports表添加用户回复字段
ALTER TABLE weekly_reports ADD COLUMN IF NOT EXISTS user_reply TEXT;
ALTER TABLE weekly_reports ADD COLUMN IF NOT EXISTS replied_at TIMESTAMPTZ;

-- 添加注释
COMMENT ON COLUMN weekly_reports.user_reply IS '用户对审阅意见的回复';
COMMENT ON COLUMN weekly_reports.replied_at IS '用户回复时间';
