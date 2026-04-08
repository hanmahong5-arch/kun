
-- 创建任务通知表
CREATE TABLE IF NOT EXISTS task_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES profiles(id),
  notification_type TEXT NOT NULL CHECK (notification_type IN ('assigned', 'progress_update', 'confirmed', 'deadline_reminder')),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 通知表的RLS策略
ALTER TABLE task_notifications ENABLE ROW LEVEL SECURITY;

-- 用户只能查看自己的通知
CREATE POLICY "users_can_view_own_notifications"
ON task_notifications
FOR SELECT
TO authenticated
USING (recipient_id = auth.uid());

-- 系统可以创建通知（通过Edge Function）
CREATE POLICY "system_can_create_notifications"
ON task_notifications
FOR INSERT
TO authenticated
WITH CHECK (true);

-- 用户可以更新自己的通知（标记已读）
CREATE POLICY "users_can_update_own_notifications"
ON task_notifications
FOR UPDATE
TO authenticated
USING (recipient_id = auth.uid());

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_task_notifications_recipient ON task_notifications(recipient_id);
CREATE INDEX IF NOT EXISTS idx_task_notifications_created_at ON task_notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_task_notifications_is_read ON task_notifications(is_read);

-- 创建通知触发器函数
CREATE OR REPLACE FUNCTION notify_task_assigned()
RETURNS TRIGGER AS $$
BEGIN
  -- 当任务被创建时，通知责任人
  INSERT INTO task_notifications (task_id, recipient_id, notification_type, title, content)
  VALUES (
    NEW.id,
    NEW.responsible_person_id::uuid,
    'assigned',
    '新任务指派',
    '您有一个新任务：' || NEW.name
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 创建进度更新通知触发器函数
CREATE OR REPLACE FUNCTION notify_task_progress_update()
RETURNS TRIGGER AS $$
DECLARE
  task_record RECORD;
BEGIN
  -- 获取任务信息
  SELECT * INTO task_record FROM tasks WHERE id = NEW.task_id;
  
  -- 通知指派人
  INSERT INTO task_notifications (task_id, recipient_id, notification_type, title, content)
  VALUES (
    NEW.task_id,
    task_record.assigned_by::uuid,
    'progress_update',
    '任务进度更新',
    '任务"' || task_record.name || '"进度已更新至' || NEW.progress || '%'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 创建任务确认通知触发器函数
CREATE OR REPLACE FUNCTION notify_task_confirmed()
RETURNS TRIGGER AS $$
BEGIN
  -- 当任务被确认完成时，通知责任人
  IF NEW.confirmed_completed = true AND OLD.confirmed_completed = false THEN
    INSERT INTO task_notifications (task_id, recipient_id, notification_type, title, content)
    VALUES (
      NEW.id,
      NEW.responsible_person_id::uuid,
      'confirmed',
      '任务已确认完成',
      '您的任务"' || NEW.name || '"已被确认完成'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 绑定触发器
DROP TRIGGER IF EXISTS trigger_notify_task_assigned ON tasks;
CREATE TRIGGER trigger_notify_task_assigned
AFTER INSERT ON tasks
FOR EACH ROW
EXECUTE FUNCTION notify_task_assigned();

DROP TRIGGER IF EXISTS trigger_notify_task_progress_update ON task_progress_updates;
CREATE TRIGGER trigger_notify_task_progress_update
AFTER INSERT ON task_progress_updates
FOR EACH ROW
EXECUTE FUNCTION notify_task_progress_update();

DROP TRIGGER IF EXISTS trigger_notify_task_confirmed ON tasks;
CREATE TRIGGER trigger_notify_task_confirmed
AFTER UPDATE ON tasks
FOR EACH ROW
EXECUTE FUNCTION notify_task_confirmed();

COMMENT ON TABLE task_notifications IS '任务通知表';
COMMENT ON COLUMN task_notifications.notification_type IS '通知类型：assigned=任务指派, progress_update=进度更新, confirmed=确认完成, deadline_reminder=截止提醒';
