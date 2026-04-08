-- 强制创建超级管理员账号 15610496919
-- 使用Supabase Auth扩展直接创建用户

DO $$
DECLARE
  v_user_id UUID;
  v_role_id UUID;
  v_encrypted_password TEXT;
BEGIN
  -- 生成UUID
  v_user_id := gen_random_uuid();
  
  -- 获取超级管理员角色ID
  SELECT id INTO v_role_id FROM roles WHERE code = 'super_admin';
  
  -- 使用crypt函数加密密码（密码：123456）
  v_encrypted_password := crypt('123456', gen_salt('bf'));
  
  -- 在auth.users表中创建用户
  INSERT INTO auth.users (
    id,
    instance_id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    phone,
    phone_confirmed_at,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
  ) VALUES (
    v_user_id,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    '15610496919@phone.com',
    v_encrypted_password,
    NOW(),
    '15610496919',
    NOW(),
    NOW(),
    NOW(),
    '',
    '',
    '',
    ''
  );
  
  -- 在profiles表中创建用户档案
  INSERT INTO profiles (
    id,
    phone,
    name,
    role,
    status,
    approved_at,
    created_at,
    updated_at
  ) VALUES (
    v_user_id,
    '15610496919',
    '超级管理员',
    'super_admin',
    'approved',
    NOW(),
    NOW(),
    NOW()
  );
  
  -- 分配超级管理员角色
  INSERT INTO user_roles (
    user_id,
    role_id,
    assigned_at
  ) VALUES (
    v_user_id,
    v_role_id,
    NOW()
  );
  
  RAISE NOTICE '超级管理员账号创建成功';
  RAISE NOTICE '手机号: 15610496919';
  RAISE NOTICE '密码: 123456';
  RAISE NOTICE '用户ID: %', v_user_id;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '创建失败: %', SQLERRM;
    RAISE;
END $$;