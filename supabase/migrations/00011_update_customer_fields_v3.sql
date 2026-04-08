
-- 先更新现有数据
UPDATE customers SET type = '政府' WHERE type IN ('政府机关', '政府单位');
UPDATE customers SET type = '央企' WHERE type = '国有企业';
UPDATE customers SET classification = '老客户' WHERE classification IN ('A类', 'B类', 'C类', 'A级', 'B级', 'C级');

-- 删除旧字段
ALTER TABLE customers DROP COLUMN IF EXISTS credit_code;
ALTER TABLE customers DROP COLUMN IF EXISTS address;
ALTER TABLE customers DROP COLUMN IF EXISTS contact_name;
ALTER TABLE customers DROP COLUMN IF EXISTS contact_position;
ALTER TABLE customers DROP COLUMN IF EXISTS contact_phone;

-- 更新客户类型约束
ALTER TABLE customers DROP CONSTRAINT IF EXISTS customers_type_check;
ALTER TABLE customers ADD CONSTRAINT customers_type_check 
  CHECK (type IN ('政府', '央企', '省属', '市属', '区属', '民企', '上市公司'));

-- 更新客户分级约束
ALTER TABLE customers DROP CONSTRAINT IF EXISTS customers_classification_check;
ALTER TABLE customers ADD CONSTRAINT customers_classification_check 
  CHECK (classification IN ('新客户', '老客户'));

-- 添加新字段
ALTER TABLE customers ADD COLUMN IF NOT EXISTS decision_contacts JSONB DEFAULT '[]';
ALTER TABLE customers ADD COLUMN IF NOT EXISTS influence_contacts JSONB DEFAULT '[]';
ALTER TABLE customers ADD COLUMN IF NOT EXISTS execution_contacts JSONB DEFAULT '[]';
ALTER TABLE customers ADD COLUMN IF NOT EXISTS supplier_info TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS company_development TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS cooperation_direction TEXT;

-- 添加注释
COMMENT ON COLUMN customers.decision_contacts IS '决策层联系人信息，JSON数组格式：[{name, position, phone}]';
COMMENT ON COLUMN customers.influence_contacts IS '影响层联系人信息，JSON数组格式：[{name, position, phone}]';
COMMENT ON COLUMN customers.execution_contacts IS '执行层联系人信息，JSON数组格式：[{name, position, phone}]';
COMMENT ON COLUMN customers.supplier_info IS '合作供应商信息';
COMMENT ON COLUMN customers.company_development IS '公司发展情况';
COMMENT ON COLUMN customers.cooperation_direction IS '合作方向';
