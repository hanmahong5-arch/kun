
-- 创建超级管理员账号
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  phone,
  phone_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  recovery_token,
  email_change_token_new,
  email_change_token_current,
  email_change,
  phone_change,
  reauthentication_token
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  '33333333-3333-3333-3333-333333333333',
  'authenticated',
  'authenticated',
  '15610496919@phone.com',
  '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
  NOW(),
  '15610496919',
  NOW(),
  '{"provider":"phone","providers":["phone"]}',
  '{"phone":"15610496919"}',
  NOW(),
  NOW(),
  '',
  '',
  '',
  '',
  '',
  '',
  ''
);

-- 在 profiles 表中创建超级管理员资料
INSERT INTO profiles (id, name, phone, role, position, department, created_at, updated_at)
VALUES (
  '33333333-3333-3333-3333-333333333333',
  '超级管理员',
  '15610496919',
  'super_admin',
  '超级管理员',
  '管理部',
  NOW(),
  NOW()
);
