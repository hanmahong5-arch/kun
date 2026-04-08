-- 1. 更新projects表：增加工程概况、小组字段
ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS project_overview TEXT,
ADD COLUMN IF NOT EXISTS team_group TEXT;

-- 修改stage字段为枚举类型
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'project_stage_enum') THEN
    CREATE TYPE project_stage_enum AS ENUM (
      '方案设计',
      '立项',
      '可研',
      '初步设计',
      '施工图设计',
      '招标控制价编制',
      '招标文件编制',
      '投标阶段',
      '已中标',
      '放弃跟踪'
    );
  END IF;
END $$;

-- 如果stage字段已存在，先删除再添加新的枚举类型字段
ALTER TABLE projects DROP COLUMN IF EXISTS stage CASCADE;
ALTER TABLE projects ADD COLUMN stage project_stage_enum;

-- 2. 创建年度目标配置表
CREATE TABLE IF NOT EXISTS annual_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year INTEGER NOT NULL,
  target_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
  description TEXT,
  created_by UUID REFERENCES profiles(id),
  updated_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(year)
);

-- 插入2026年度默认目标
INSERT INTO annual_targets (year, target_amount, description)
VALUES (2026, 100000000, '2026年度经营目标')
ON CONFLICT (year) DO NOTHING;

-- 3. 创建客户表
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL, -- 政府单位、国有企业、民营企业、其他
  classification TEXT NOT NULL, -- A类、B类、C类
  credit_code TEXT,
  address TEXT,
  contact_name TEXT,
  contact_position TEXT,
  contact_phone TEXT,
  cooperation_history TEXT,
  responsible_person_id UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. 创建客户跟进记录表
CREATE TABLE IF NOT EXISTS customer_follow_ups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  follow_up_date DATE NOT NULL,
  follow_up_method TEXT, -- 电话、拜访、会议等
  content TEXT NOT NULL,
  next_plan TEXT,
  attachments JSONB,
  user_id UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. 为新表创建RLS策略
ALTER TABLE annual_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_follow_ups ENABLE ROW LEVEL SECURITY;

-- 年度目标表策略：所有人可查看，仅系统管理员可修改
DROP POLICY IF EXISTS "所有人可查看年度目标" ON annual_targets;
CREATE POLICY "所有人可查看年度目标" ON annual_targets FOR SELECT USING (true);

DROP POLICY IF EXISTS "系统管理员可修改年度目标" ON annual_targets;
CREATE POLICY "系统管理员可修改年度目标" ON annual_targets FOR ALL 
  USING (auth.uid() IS NOT NULL);

-- 客户表策略：所有人可查看，所有登录用户可编辑
DROP POLICY IF EXISTS "所有人可查看客户" ON customers;
CREATE POLICY "所有人可查看客户" ON customers FOR SELECT USING (true);

DROP POLICY IF EXISTS "登录用户可管理客户" ON customers;
CREATE POLICY "登录用户可管理客户" ON customers FOR ALL 
  USING (auth.uid() IS NOT NULL);

-- 客户跟进记录策略：所有人可查看，创建人可编辑
DROP POLICY IF EXISTS "所有人可查看客户跟进记录" ON customer_follow_ups;
CREATE POLICY "所有人可查看客户跟进记录" ON customer_follow_ups FOR SELECT USING (true);

DROP POLICY IF EXISTS "创建人可管理自己的跟进记录" ON customer_follow_ups;
CREATE POLICY "创建人可管理自己的跟进记录" ON customer_follow_ups FOR ALL 
  USING (user_id = auth.uid());

-- 6. 创建触发器自动更新updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_annual_targets_updated_at ON annual_targets;
CREATE TRIGGER update_annual_targets_updated_at BEFORE UPDATE ON annual_targets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_customers_updated_at ON customers;
CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_customer_follow_ups_updated_at ON customer_follow_ups;
CREATE TRIGGER update_customer_follow_ups_updated_at BEFORE UPDATE ON customer_follow_ups
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();