-- 创建枚举类型
CREATE TYPE user_role AS ENUM ('super_admin', 'leader', 'market_staff', 'data_clerk', 'system_admin');
CREATE TYPE staff_level AS ENUM ('senior_manager', 'level_1', 'level_2', 'level_3');
CREATE TYPE report_status AS ENUM ('draft', 'pending_review', 'reviewed', 'rejected');
CREATE TYPE project_classification AS ENUM ('a_lock', 'a_compete', 'b_class', 'c_class', 'd_class');
CREATE TYPE bidding_status AS ENUM ('pending', 'won', 'lost', 'cooperation');
CREATE TYPE bidding_stage AS ENUM ('registration', 'document_preparation', 'internal_review', 'opening', 'result_announcement');
CREATE TYPE stage_status AS ENUM ('pending', 'in_progress', 'completed');
CREATE TYPE task_priority AS ENUM ('high', 'medium', 'low');
CREATE TYPE task_status AS ENUM ('pending', 'in_progress', 'completed', 'overdue');
CREATE TYPE chart_type AS ENUM ('bar', 'line', 'pie', 'table');

-- 1. profiles表
CREATE TABLE profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  phone text,
  name text NOT NULL,
  role user_role NOT NULL DEFAULT 'market_staff',
  position text,
  department text,
  staff_level staff_level,
  openid text,
  avatar_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. weekly_reports表
CREATE TABLE weekly_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  week_start_date date NOT NULL,
  week_end_date date NOT NULL,
  core_work text NOT NULL,
  project_progress text NOT NULL,
  bidding_work text NOT NULL,
  customer_contact text NOT NULL,
  next_week_plan text NOT NULL,
  issues text,
  attachments jsonb DEFAULT '[]'::jsonb,
  status report_status NOT NULL DEFAULT 'draft',
  review_comment text,
  reviewed_by uuid REFERENCES profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 3. projects表
CREATE TABLE projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  classification project_classification NOT NULL,
  construction_unit text NOT NULL,
  project_type text NOT NULL,
  investment_amount numeric(15, 2),
  responsible_person_id uuid NOT NULL REFERENCES profiles(id),
  stage text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 4. project_follow_ups表
CREATE TABLE project_follow_ups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id),
  content text NOT NULL,
  stage text,
  attachments jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- 5. bidding_info表
CREATE TABLE bidding_info (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  bidding_unit text NOT NULL,
  bidding_limit numeric(15, 2),
  opening_date date,
  project_type text,
  status bidding_status NOT NULL DEFAULT 'pending',
  result_amount numeric(15, 2),
  result_reason text,
  result_document text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 6. bidding_progress表
CREATE TABLE bidding_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bidding_id uuid NOT NULL REFERENCES bidding_info(id) ON DELETE CASCADE,
  stage bidding_stage NOT NULL,
  status stage_status NOT NULL DEFAULT 'pending',
  attachments jsonb DEFAULT '[]'::jsonb,
  updated_at timestamptz DEFAULT now()
);

-- 7. customers表
CREATE TABLE customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL,
  classification text NOT NULL,
  credit_code text,
  address text,
  contact_name text,
  contact_position text,
  contact_phone text,
  cooperation_history text,
  responsible_person_id uuid NOT NULL REFERENCES profiles(id),
  attachments jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 8. customer_follow_ups表
CREATE TABLE customer_follow_ups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id),
  follow_date date NOT NULL,
  follow_method text NOT NULL,
  content text NOT NULL,
  next_plan text,
  next_follow_date date,
  attachments jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- 9. tasks表
CREATE TABLE tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL,
  assigned_by uuid NOT NULL REFERENCES profiles(id),
  responsible_person_id uuid NOT NULL REFERENCES profiles(id),
  collaborators uuid[] DEFAULT ARRAY[]::uuid[],
  priority task_priority NOT NULL DEFAULT 'medium',
  deadline timestamptz NOT NULL,
  description text NOT NULL,
  related_project_id uuid REFERENCES projects(id),
  related_customer_id uuid REFERENCES customers(id),
  attachments jsonb DEFAULT '[]'::jsonb,
  status task_status NOT NULL DEFAULT 'pending',
  progress int DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  completion_note text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 10. documents表
CREATE TABLE documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL,
  file_path text NOT NULL,
  file_size bigint,
  file_type text,
  version int DEFAULT 1,
  parent_id uuid REFERENCES documents(id),
  uploaded_by uuid NOT NULL REFERENCES profiles(id),
  view_count int DEFAULT 0,
  download_count int DEFAULT 0,
  is_confidential boolean DEFAULT false,
  allowed_roles text[] DEFAULT ARRAY[]::text[],
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 11. notifications表
CREATE TABLE notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  content text NOT NULL,
  related_id uuid,
  related_type text,
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- 12. operation_logs表
CREATE TABLE operation_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id),
  action text NOT NULL,
  module text NOT NULL,
  details jsonb DEFAULT '{}'::jsonb,
  ip_address text,
  created_at timestamptz DEFAULT now()
);

-- 13. report_configs表
CREATE TABLE report_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  data_sources text[] NOT NULL,
  dimensions jsonb NOT NULL,
  metrics jsonb NOT NULL,
  chart_type chart_type NOT NULL,
  filters jsonb DEFAULT '{}'::jsonb,
  created_by uuid NOT NULL REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 14. field_configs表
CREATE TABLE field_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module text NOT NULL,
  field_name text NOT NULL,
  field_type text NOT NULL,
  is_required boolean DEFAULT false,
  sort_order int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(module, field_name)
);

-- 创建存储桶
INSERT INTO storage.buckets (id, name, public) VALUES ('app-aqrho2yuzfnl_documents', 'app-aqrho2yuzfnl_documents', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('app-aqrho2yuzfnl_attachments', 'app-aqrho2yuzfnl_attachments', true);

-- 创建触发器函数：自动更新updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 为需要的表添加updated_at触发器
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_weekly_reports_updated_at BEFORE UPDATE ON weekly_reports FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_bidding_info_updated_at BEFORE UPDATE ON bidding_info FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_documents_updated_at BEFORE UPDATE ON documents FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_report_configs_updated_at BEFORE UPDATE ON report_configs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_field_configs_updated_at BEFORE UPDATE ON field_configs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 创建handle_new_user函数
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  user_count int;
  user_phone text;
  user_openid text;
BEGIN
  SELECT COUNT(*) INTO user_count FROM profiles;
  
  -- 提取phone和openid
  user_phone := COALESCE(NEW.phone, (NEW.raw_user_meta_data->>'phone')::text);
  user_openid := COALESCE((NEW.raw_user_meta_data->>'openid')::text, NULL);
  
  -- 插入profile
  INSERT INTO public.profiles (id, phone, name, role, openid)
  VALUES (
    NEW.id,
    user_phone,
    COALESCE((NEW.raw_user_meta_data->>'name')::text, '未命名用户'),
    CASE WHEN user_count = 0 THEN 'super_admin'::public.user_role ELSE 'market_staff'::public.user_role END,
    user_openid
  );
  
  RETURN NEW;
END;
$$;

-- 创建触发器
DROP TRIGGER IF EXISTS on_auth_user_confirmed ON auth.users;
CREATE TRIGGER on_auth_user_confirmed
  AFTER UPDATE ON auth.users
  FOR EACH ROW
  WHEN (OLD.confirmed_at IS NULL AND NEW.confirmed_at IS NOT NULL)
  EXECUTE FUNCTION handle_new_user();