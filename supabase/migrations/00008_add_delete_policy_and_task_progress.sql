
-- 添加周报删除策略（用户只能删除自己的草稿）
CREATE POLICY "users_can_delete_own_draft_reports"
ON weekly_reports
FOR DELETE
TO authenticated
USING (user_id = auth.uid() AND status = 'draft');

-- 创建任务进度更新表
CREATE TABLE IF NOT EXISTS task_progress_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  updated_by UUID NOT NULL REFERENCES profiles(id),
  progress INTEGER NOT NULL CHECK (progress >= 0 AND progress <= 100),
  is_completed BOOLEAN DEFAULT false,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 任务进度更新表的RLS策略
ALTER TABLE task_progress_updates ENABLE ROW LEVEL SECURITY;

-- 所有认证用户可以查看任务进度更新
CREATE POLICY "authenticated_users_can_view_task_progress"
ON task_progress_updates
FOR SELECT
TO authenticated
USING (true);

-- 任务责任人可以创建进度更新
CREATE POLICY "task_assignees_can_create_progress"
ON task_progress_updates
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM tasks
    WHERE tasks.id = task_progress_updates.task_id
    AND tasks.responsible_person_id = auth.uid()
  )
);

-- 创建索引提升查询性能
CREATE INDEX IF NOT EXISTS idx_task_progress_task_id ON task_progress_updates(task_id);
CREATE INDEX IF NOT EXISTS idx_task_progress_created_at ON task_progress_updates(created_at DESC);

-- 添加任务确认完成字段
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS confirmed_completed BOOLEAN DEFAULT false;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS confirmed_by UUID REFERENCES profiles(id);
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ;

COMMENT ON TABLE task_progress_updates IS '任务进度更新记录表';
COMMENT ON COLUMN task_progress_updates.task_id IS '关联的任务ID';
COMMENT ON COLUMN task_progress_updates.updated_by IS '更新人ID';
COMMENT ON COLUMN task_progress_updates.progress IS '进度百分比(0-100)';
COMMENT ON COLUMN task_progress_updates.is_completed IS '是否标记为完成';
COMMENT ON COLUMN task_progress_updates.note IS '进度备注';
COMMENT ON COLUMN tasks.confirmed_completed IS '指派人是否确认完成';
COMMENT ON COLUMN tasks.confirmed_by IS '确认人ID';
COMMENT ON COLUMN tasks.confirmed_at IS '确认时间';
