-- 创建审阅历史表
CREATE TABLE IF NOT EXISTS review_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES weekly_reports(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES profiles(id),
  review_status VARCHAR(20) NOT NULL CHECK (review_status IN ('approved', 'rejected')),
  review_comment TEXT,
  reviewed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 创建周报-任务关联表
CREATE TABLE IF NOT EXISTS report_task_relations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES weekly_reports(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE(report_id, task_id)
);

-- 添加注释
COMMENT ON TABLE review_history IS '周报审阅历史记录表';
COMMENT ON COLUMN review_history.report_id IS '周报ID';
COMMENT ON COLUMN review_history.reviewer_id IS '审阅人ID';
COMMENT ON COLUMN review_history.review_status IS '审阅状态: approved-通过, rejected-需修改';
COMMENT ON COLUMN review_history.review_comment IS '审阅批注';
COMMENT ON COLUMN review_history.reviewed_at IS '审阅时间';

COMMENT ON TABLE report_task_relations IS '周报-任务关联表';
COMMENT ON COLUMN report_task_relations.report_id IS '周报ID';
COMMENT ON COLUMN report_task_relations.task_id IS '任务ID';
COMMENT ON COLUMN report_task_relations.created_by IS '创建关联的用户ID';

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_review_history_report_id ON review_history(report_id);
CREATE INDEX IF NOT EXISTS idx_review_history_reviewer_id ON review_history(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_review_history_reviewed_at ON review_history(reviewed_at DESC);

CREATE INDEX IF NOT EXISTS idx_report_task_relations_report_id ON report_task_relations(report_id);
CREATE INDEX IF NOT EXISTS idx_report_task_relations_task_id ON report_task_relations(task_id);

-- RLS策略
ALTER TABLE review_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_task_relations ENABLE ROW LEVEL SECURITY;

-- 审阅历史：所有人可查看
CREATE POLICY "Anyone can view review history" ON review_history
  FOR SELECT USING (true);

-- 审阅历史：领导和管理员可插入
CREATE POLICY "Leaders and admins can insert review history" ON review_history
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('super_admin', 'system_admin', 'leader')
    )
  );

-- 周报-任务关联：所有人可查看
CREATE POLICY "Anyone can view report task relations" ON report_task_relations
  FOR SELECT USING (true);

-- 周报-任务关联：周报作者可插入
CREATE POLICY "Report authors can insert relations" ON report_task_relations
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM weekly_reports
      WHERE id = report_id AND user_id = auth.uid()
    )
  );

-- 周报-任务关联：周报作者可删除
CREATE POLICY "Report authors can delete relations" ON report_task_relations
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM weekly_reports
      WHERE id = report_id AND user_id = auth.uid()
    )
  );