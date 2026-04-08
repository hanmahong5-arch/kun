-- 添加负责人权限字段（包含user_id和role）
ALTER TABLE customers ADD COLUMN IF NOT EXISTS responsible_persons jsonb DEFAULT '[]'::jsonb;

-- 迁移现有数据：将responsible_person_ids转换为带权限的格式
-- 第一个设为主负责人，其余设为协助负责人
UPDATE customers 
SET responsible_persons = (
  SELECT jsonb_agg(
    jsonb_build_object(
      'user_id', elem::text,
      'role', CASE WHEN idx = 0 THEN 'primary' ELSE 'assistant' END
    )
  )
  FROM jsonb_array_elements_text(responsible_person_ids) WITH ORDINALITY AS t(elem, idx)
)
WHERE responsible_person_ids IS NOT NULL 
  AND jsonb_array_length(responsible_person_ids) > 0;

-- 创建客户转移历史表
CREATE TABLE IF NOT EXISTS customer_transfer_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  from_user_id UUID REFERENCES profiles(id),
  to_user_id UUID NOT NULL REFERENCES profiles(id),
  reason TEXT,
  transferred_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 为转移历史表创建索引
CREATE INDEX IF NOT EXISTS idx_customer_transfer_history_customer_id ON customer_transfer_history(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_transfer_history_created_at ON customer_transfer_history(created_at DESC);

-- 为转移历史表添加RLS策略
ALTER TABLE customer_transfer_history ENABLE ROW LEVEL SECURITY;

-- 所有认证用户可以查看转移历史
CREATE POLICY "authenticated_users_can_view_transfer_history" ON customer_transfer_history
  FOR SELECT
  TO authenticated
  USING (true);

-- 只有管理员可以插入转移历史
CREATE POLICY "admins_can_insert_transfer_history" ON customer_transfer_history
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('super_admin', 'system_admin')
    )
  );

-- 注释
COMMENT ON COLUMN customers.responsible_persons IS '负责人列表，包含user_id和role（primary/assistant）';
COMMENT ON TABLE customer_transfer_history IS '客户转移历史记录表';