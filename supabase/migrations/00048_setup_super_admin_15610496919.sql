-- 为15610496919创建超级管理员账号
-- 注意：此脚本仅创建profiles记录和角色关联
-- Auth用户需要通过create-user Edge Function创建

DO $$
DECLARE
  v_role_id UUID;
  v_existing_user_id UUID;
BEGIN
  -- 获取超级管理员角色ID
  SELECT id INTO v_role_id FROM roles WHERE code = 'super_admin';
  
  -- 检查是否已有该手机号的用户
  SELECT id INTO v_existing_user_id FROM profiles WHERE phone = '15610496919';
  
  IF v_existing_user_id IS NOT NULL THEN
    -- 用户已存在，更新角色为super_admin
    UPDATE profiles 
    SET role = 'super_admin',
        status = 'approved',
        approved_at = NOW(),
        updated_at = NOW()
    WHERE id = v_existing_user_id;
    
    -- 删除现有角色关联
    DELETE FROM user_roles WHERE user_id = v_existing_user_id;
    
    -- 分配超级管理员角色
    INSERT INTO user_roles (user_id, role_id, assigned_at)
    VALUES (v_existing_user_id, v_role_id, NOW());
    
    RAISE NOTICE '用户15610496919已更新为超级管理员';
  ELSE
    RAISE NOTICE '用户15610496919不存在';
    RAISE NOTICE '请使用系统的"添加用户"功能创建该用户';
    RAISE NOTICE '创建时选择"超级管理员"角色';
  END IF;
END $$;

-- 创建一个视图，方便查看超级管理员列表
CREATE OR REPLACE VIEW super_admins AS
SELECT 
  p.id,
  p.phone,
  p.name,
  p.role,
  p.status,
  p.created_at
FROM profiles p
JOIN user_roles ur ON p.id = ur.user_id
JOIN roles r ON ur.role_id = r.id
WHERE r.code = 'super_admin'
ORDER BY p.created_at;

COMMENT ON VIEW super_admins IS '超级管理员列表视图';