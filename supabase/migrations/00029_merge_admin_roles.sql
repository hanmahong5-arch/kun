-- 合并超级管理员和系统管理员角色

-- 1. 更新profiles表：将super_admin改为system_admin
UPDATE profiles
SET role = 'system_admin'
WHERE role = 'super_admin';

-- 2. 更新user_roles表：将super_admin角色关联改为system_admin
UPDATE user_roles
SET role_id = (SELECT id FROM roles WHERE code = 'system_admin')
WHERE role_id = (SELECT id FROM roles WHERE code = 'super_admin');

-- 3. 更新role_permissions表：将super_admin权限迁移到system_admin
INSERT INTO role_permissions (role_id, permission_code)
SELECT 
  (SELECT id FROM roles WHERE code = 'system_admin'),
  permission_code
FROM role_permissions
WHERE role_id = (SELECT id FROM roles WHERE code = 'super_admin')
ON CONFLICT (role_id, permission_code) DO NOTHING;

-- 4. 删除super_admin角色的权限
DELETE FROM role_permissions
WHERE role_id = (SELECT id FROM roles WHERE code = 'super_admin');

-- 5. 删除super_admin角色
DELETE FROM roles WHERE code = 'super_admin';

-- 6. 更新system_admin角色描述
UPDATE roles
SET 
  name = '系统管理员',
  description = '拥有系统所有权限，可管理所有功能和用户'
WHERE code = 'system_admin';