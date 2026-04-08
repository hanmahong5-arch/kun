import {supabase} from '@/client/supabase'
import type {Permission, Role, RolePermission} from './types'

/**
 * 权限管理API
 * 提供权限查询、角色管理、权限验证等功能
 */

// ========== 权限查询 ==========

/**
 * 获取所有权限列表
 */
export async function getAllPermissions(): Promise<Permission[]> {
  const {data, error} = await supabase
    .from('permissions')
    .select('*')
    .order('module')
    .order('code')

  if (error) {
    console.error('获取权限列表失败:', error)
    return []
  }

  return Array.isArray(data) ? data : []
}

/**
 * 按模块获取权限列表
 */
export async function getPermissionsByModule(module: string): Promise<Permission[]> {
  const {data, error} = await supabase
    .from('permissions')
    .select('*')
    .eq('module', module)
    .order('code')

  if (error) {
    console.error('获取模块权限失败:', error)
    return []
  }

  return Array.isArray(data) ? data : []
}

/**
 * 获取用户的所有权限
 */
export async function getUserPermissions(userId: string): Promise<Permission[]> {
  const {data, error} = await supabase.rpc('get_user_permissions', {
    user_id_param: userId
  })

  if (error) {
    console.error('获取用户权限失败:', error)
    return []
  }

  return Array.isArray(data) ? data : []
}

/**
 * 检查用户是否有某个权限
 */
export async function hasPermission(userId: string, permissionCode: string): Promise<boolean> {
  const {data, error} = await supabase.rpc('has_permission', {
    user_id_param: userId,
    permission_code_param: permissionCode
  })

  if (error) {
    console.error('检查权限失败:', error)
    return false
  }

  return data === true
}

/**
 * 批量检查用户权限
 */
export async function hasPermissions(
  userId: string,
  permissionCodes: string[]
): Promise<Record<string, boolean>> {
  const result: Record<string, boolean> = {}

  // 并发检查所有权限
  const checks = permissionCodes.map(async (code) => {
    const has = await hasPermission(userId, code)
    result[code] = has
  })

  await Promise.all(checks)
  return result
}

// ========== 角色管理 ==========

/**
 * 获取所有角色列表
 */
export async function getAllRoles(): Promise<Role[]> {
  const {data, error} = await supabase
    .from('roles')
    .select('*')
    .eq('is_active', true)
    .order('code')

  if (error) {
    console.error('获取角色列表失败:', error)
    return []
  }

  return Array.isArray(data) ? data : []
}

/**
 * 根据代码获取角色
 */
export async function getRoleByCode(code: string): Promise<Role | null> {
  const {data, error} = await supabase
    .from('roles')
    .select('*')
    .eq('code', code)
    .maybeSingle()

  if (error) {
    console.error('获取角色失败:', error)
    return null
  }

  return data
}

/**
 * 创建自定义角色
 */
export async function createCustomRole(roleData: {
  code: string
  name: string
  description?: string
}): Promise<Role | null> {
  const {data, error} = await supabase
    .from('roles')
    .insert({
      code: roleData.code,
      name: roleData.name,
      description: roleData.description || null,
      is_system: false,
      is_active: true
    })
    .select()
    .maybeSingle()

  if (error) {
    console.error('创建角色失败:', error)
    return null
  }

  return data
}

/**
 * 获取角色的所有权限
 */
export async function getRolePermissions(roleCode: string): Promise<Permission[]> {
  const {data, error} = await supabase.rpc('get_role_permissions', {
    role_code_param: roleCode
  })

  if (error) {
    console.error('获取角色权限失败:', error)
    return []
  }

  return Array.isArray(data) ? data : []
}

/**
 * 获取角色的权限ID列表
 */
export async function getRolePermissionIds(roleId: string): Promise<string[]> {
  const {data, error} = await supabase
    .from('role_permissions')
    .select('permission_id')
    .eq('role_id', roleId)

  if (error) {
    console.error('获取角色权限ID失败:', error)
    return []
  }

  return Array.isArray(data) ? data.map((item: any) => item.permission_id) : []
}

/**
 * 设置角色权限（批量更新）
 */
export async function setRolePermissions(
  roleId: string,
  permissionIds: string[]
): Promise<boolean> {
  return updateRolePermissions(roleId, permissionIds)
}

/**
 * 获取用户的所有角色
 */
export async function getUserRoles(userId: string): Promise<Role[]> {
  const {data, error} = await supabase
    .from('user_roles')
    .select(`
      role_id,
      roles!inner (
        id,
        code,
        name,
        description,
        is_system,
        is_active,
        created_at,
        updated_at
      )
    `)
    .eq('user_id', userId)

  if (error) {
    console.error('获取用户角色失败:', error)
    return []
  }

  if (!Array.isArray(data)) return []

  // 提取roles数据
  return data
    .map((item: any) => item.roles)
    .filter((role: any) => role && role.is_active)
}

/**
 * 为用户分配角色
 */
export async function assignRoleToUser(
  userId: string,
  roleId: string,
  assignedBy?: string
): Promise<boolean> {
  const {error} = await supabase.from('user_roles').insert({
    user_id: userId,
    role_id: roleId,
    assigned_by: assignedBy || null,
    assigned_at: new Date().toISOString()
  })

  if (error) {
    console.error('分配角色失败:', error)
    return false
  }

  return true
}

/**
 * 移除用户的角色
 */
export async function removeRoleFromUser(userId: string, roleId: string): Promise<boolean> {
  const {error} = await supabase
    .from('user_roles')
    .delete()
    .eq('user_id', userId)
    .eq('role_id', roleId)

  if (error) {
    console.error('移除角色失败:', error)
    return false
  }

  return true
}

/**
 * 批量更新用户角色
 * 先删除所有现有角色，再添加新角色
 */
export async function updateUserRoles(
  userId: string,
  roleIds: string[],
  assignedBy?: string
): Promise<boolean> {
  try {
    // 删除现有角色
    const {error: deleteError} = await supabase
      .from('user_roles')
      .delete()
      .eq('user_id', userId)

    if (deleteError) {
      console.error('删除现有角色失败:', deleteError)
      return false
    }

    // 添加新角色
    if (roleIds.length > 0) {
      const userRoles = roleIds.map((roleId) => ({
        user_id: userId,
        role_id: roleId,
        assigned_by: assignedBy || null,
        assigned_at: new Date().toISOString()
      }))

      const {error: insertError} = await supabase.from('user_roles').insert(userRoles)

      if (insertError) {
        console.error('添加新角色失败:', insertError)
        return false
      }
    }

    return true
  } catch (error) {
    console.error('更新用户角色失败:', error)
    return false
  }
}

// ========== 角色权限管理 ==========

/**
 * 为角色添加权限
 */
export async function addPermissionToRole(roleId: string, permissionId: string): Promise<boolean> {
  const {error} = await supabase.from('role_permissions').insert({
    role_id: roleId,
    permission_id: permissionId
  })

  if (error) {
    console.error('添加角色权限失败:', error)
    return false
  }

  return true
}

/**
 * 移除角色的权限
 */
export async function removePermissionFromRole(
  roleId: string,
  permissionId: string
): Promise<boolean> {
  const {error} = await supabase
    .from('role_permissions')
    .delete()
    .eq('role_id', roleId)
    .eq('permission_id', permissionId)

  if (error) {
    console.error('移除角色权限失败:', error)
    return false
  }

  return true
}

/**
 * 批量更新角色权限
 */
export async function updateRolePermissions(
  roleId: string,
  permissionIds: string[]
): Promise<boolean> {
  try {
    // 删除现有权限
    const {error: deleteError} = await supabase
      .from('role_permissions')
      .delete()
      .eq('role_id', roleId)

    if (deleteError) {
      console.error('删除现有权限失败:', deleteError)
      return false
    }

    // 添加新权限
    if (permissionIds.length > 0) {
      const rolePermissions = permissionIds.map((permissionId) => ({
        role_id: roleId,
        permission_id: permissionId
      }))

      const {error: insertError} = await supabase.from('role_permissions').insert(rolePermissions)

      if (insertError) {
        console.error('添加新权限失败:', insertError)
        return false
      }
    }

    return true
  } catch (error) {
    console.error('更新角色权限失败:', error)
    return false
  }
}
