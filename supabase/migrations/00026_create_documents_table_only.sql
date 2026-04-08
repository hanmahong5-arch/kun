-- 创建文档表
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  category VARCHAR(50) NOT NULL,
  file_size BIGINT NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  file_type VARCHAR(50) NOT NULL,
  uploaded_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 添加索引
CREATE INDEX IF NOT EXISTS idx_documents_category ON documents(category);
CREATE INDEX IF NOT EXISTS idx_documents_uploaded_by ON documents(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_documents_created_at ON documents(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_documents_name ON documents USING gin(to_tsvector('simple', name));

-- 添加注释
COMMENT ON TABLE documents IS '知识库文档表';
COMMENT ON COLUMN documents.category IS '文档分类: standard-标准规范, template-模板文档, manual-操作手册, other-其他';

-- RLS策略
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- 所有人可查看
CREATE POLICY "所有人可查看文档" ON documents
  FOR SELECT
  USING (true);

-- 资料员、管理员可创建
CREATE POLICY "资料员和管理员可创建文档" ON documents
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('super_admin', 'system_admin', 'data_clerk')
    )
  );

-- 资料员、管理员可更新
CREATE POLICY "资料员和管理员可更新文档" ON documents
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('super_admin', 'system_admin', 'data_clerk')
    )
  );

-- 管理员可删除
CREATE POLICY "管理员可删除文档" ON documents
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('super_admin', 'system_admin')
    )
  );