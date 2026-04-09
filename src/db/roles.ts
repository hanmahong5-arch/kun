import {supabase} from '@/client/supabase'
import type {CustomRole, UserRoleAssignment, AuditLog} from './types'

// ==================== 角色管理 ====================

// 获取所有角色
export async function getAllRoles(): Promise<CustomRole[]> {
  const {data, error} = await supabase
    .from('roles')
    .select('*')
    .order('created_at', {ascending: true})

  if (error) {
    console.error('获取角色列表失败:', error)
    return []
  }

  return Array.isArray(data) ? data : []
}

// 根据ID获取角色
export async function getRoleById(id: string): Promise<CustomRole | null> {
  const {data, error} = await supabase.from('roles').select('*').eq('id', id).single()

  if (error) {
    console.error('获取角色失败:', error)
    return null
  }

  return data
}

// 根据code获取角色
export async function getRoleByCode(code: string): Promise<CustomRole | null> {
  const {data, error} = await supabase.from('roles').select('*').eq('code', code).single()

  if (error) {
    console.error('获取角色失败:', error)
    return null
  }

  return data
}

// 创建角色
export async function createRole(
  role: Omit<CustomRole, 'id' | 'created_at' | 'updated_at'>
): Promise<{success: boolean; data?: CustomRole; error?: string}> {
  const {data, error} = await supabase.from('roles').insert(role).select().single()

  if (error) {
    console.error('创建角色失败:', error)
    return {success: false, error: error.message}
  }

  return {success: true, data}
}

// 更新角色
export async function updateRole(
  id: string,
  updates: Partial<Omit<CustomRole, 'id' | 'created_at' | 'updated_at'>>
): Promise<{success: boolean; error?: string}> {
  const {error} = await supabase
    .from('roles')
    .update({...updates, updated_at: new Date().toISOString()})
    .eq('id', id)

  if (error) {
    console.error('更新角色失败:', error)
    return {success: false, error: error.message}
  }

  return {success: true}
}

// 删除角色
export async function deleteRole(id: string): Promise<{success: boolean; error?: string}> {
  // 检查是否为系统角色
  const role = await getRoleById(id)
  if (role?.is_system) {
    return {success: false, error: '系统角色不可删除'}
  }

  // 检查是否有用户使用该角色
  const {data: userRoles, error: checkError} = await supabase
    .from('user_roles')
    .select('id')
    .eq('role_id', id)
    .limit(1)

  if (checkError) {
    return {success: false, error: checkError.message}
  }

  if (userRoles && userRoles.length > 0) {
    return {success: false, error: '该角色已被用户关联，无法删除'}
  }

  const {error} = await supabase.from('roles').delete().eq('id', id)

  if (error) {
    console.error('删除角色失败:', error)
    return {success: false, error: error.message}
  }

  return {success: true}
}

// 获取角色的用户数量
export async function getRoleUserCount(roleId: string): Promise<number> {
  const {count, error} = await supabase
    .from('user_roles')
    .select('*', {count: 'exact', head: true})
    .eq('role_id', roleId)

  if (error) {
    console.error('获取角色用户数量失败:', error)
    return 0
  }

  return count || 0
}

// 获取角色的权限数量
export async function getRolePermissionCount(roleId: string): Promise<number> {
  const {count, error} = await supabase
    .from('role_permissions')
    .select('*', {count: 'exact', head: true})
    .eq('role_id', roleId)

  if (error) {
    console.error('获取角色权限数量失败:', error)
    return 0
  }

  return count || 0
}

// ==================== 用户-角色关联管理 ====================

// 获取用户的所有角色
export async function getUserRoles(userId: string): Promise<CustomRole[]> {
  const {data, error} = await supabase
    .from('user_roles')
    .select('role_id, roles(*)')
    .eq('user_id', userId)

  if (error) {
    console.error('获取用户角色失败:', error)
    return []
  }

  if (!Array.isArray(data)) return []

  return data
    .map((item) => {
      const typedItem = item as unknown as {roles: CustomRole}
      return typedItem.roles
    })
    .filter((r) => r !== null)
}

// 为用户分配角色
export async function assignRoleToUser(
  userId: string,
  roleId: string,
  assignedBy: string
): Promise<{success: boolean; error?: string}> {
  const {error} = await supabase.from('user_roles').insert({
    user_id: userId,
    role_id: roleId,
    assigned_by: assignedBy
  })

  if (error) {
    console.error('分配角色失败:', error)
    return {success: false, error: error.message}
  }

  return {success: true}
}

// 移除用户的角色
export async function removeRoleFromUser(
  userId: string,
  roleId: string
): Promise<{success: boolean; error?: string}> {
  const {error} = await supabase
    .from('user_roles')
    .delete()
    .eq('user_id', userId)
    .eq('role_id', roleId)

  if (error) {
    console.error('移除角色失败:', error)
    return {success: false, error: error.message}
  }

  return {success: true}
}

// 批量设置用户角色
export async function setUserRoles(
  userId: string,
  roleIds: string[],
  assignedBy: string
): Promise<{success: boolean; error?: string}> {
  // 1. 删除现有角色
  const {error: deleteError} = await supabase.from('user_roles').delete().eq('user_id', userId)

  if (deleteError) {
    console.error('删除现有角色失败:', deleteError)
    return {success: false, error: deleteError.message}
  }

  // 2. 插入新角色
  if (roleIds.length > 0) {
    const userRoles = roleIds.map((roleId) => ({
      user_id: userId,
      role_id: roleId,
      assigned_by: assignedBy
    }))

    const {error: insertError} = await supabase.from('user_roles').insert(userRoles)

    if (insertError) {
      console.error('插入新角色失败:', insertError)
      return {success: false, error: insertError.message}
    }
  }

  return {success: true}
}

// ==================== 角色权限管理 ====================

// 获取角色的权限代码列表
export async function getRolePermissionCodes(roleId: string): Promise<string[]> {
  const {data, error} = await supabase
    .from('role_permissions')
    .select('permission_id, permissions(code)')
    .eq('role_id', roleId)

  if (error) {
    console.error('获取角色权限失败:', error)
    return []
  }

  if (!Array.isArray(data)) return []

  return data
    .map((item: any) => item.permissions?.code)
    .filter((code: string | undefined) => !!code)
}

// 批量设置角色权限（使用permission_id）
export async function setRolePermissions(
  roleId: string,
  permissionIds: string[]
): Promise<{success: boolean; error?: string}> {
  // 1. 删除现有权限
  const {error: deleteError} = await supabase
    .from('role_permissions')
    .delete()
    .eq('role_id', roleId)

  if (deleteError) {
    console.error('删除现有权限失败:', deleteError)
    return {success: false, error: deleteError.message}
  }

  // 2. 插入新权限
  if (permissionIds.length > 0) {
    const rolePermissions = permissionIds.map((permissionId) => ({
      role_id: roleId,
      permission_id: permissionId
    }))

    const {error: insertError} = await supabase.from('role_permissions').insert(rolePermissions)

    if (insertError) {
      console.error('插入新权限失败:', insertError)
      return {success: false, error: insertError.message}
    }
  }

  return {success: true}
}

// 获取用户的所有权限代码（合并所有角色的权限）
export async function getUserPermissionCodes(userId: string): Promise<string[]> {
  // 1. 获取用户的所有角色ID
  const {data: userRoles, error: rolesError} = await supabase
    .from('user_roles')
    .select('role_id')
    .eq('user_id', userId)

  if (rolesError || !userRoles) {
    return []
  }

  const roleIds = userRoles.map((ur) => ur.role_id)

  if (roleIds.length === 0) {
    return []
  }

  // 2. 获取所有角色的权限（通过 join permissions 表获取 code）
  const {data: permissions, error: permError} = await supabase
    .from('role_permissions')
    .select('permission_id, permissions(code)')
    .in('role_id', roleIds)

  if (permError || !permissions) {
    return []
  }

  // 3. 去重并返回
  const codes = permissions
    .map((p: any) => p.permissions?.code)
    .filter((code: string | undefined) => !!code)
  const uniquePermissions = [...new Set(codes)]
  return uniquePermissions
}

// 检查用户是否有某个权限
export async function checkUserPermission(
  userId: string,
  permissionCode: string
): Promise<boolean> {
  const permissions = await getUserPermissionCodes(userId)
  return permissions.includes(permissionCode)
}

// ==================== 审计日志 ====================

// 创建审计日志
export async function createAuditLog(
  log: Omit<AuditLog, 'id' | 'created_at'>
): Promise<{success: boolean; error?: string}> {
  const {error} = await supabase.from('audit_logs').insert(log)

  if (error) {
    console.error('创建审计日志失败:', error)
    return {success: false, error: error.message}
  }

  return {success: true}
}

// 获取审计日志
export async function getAuditLogs(
  filters?: {
    userId?: string
    entityType?: string
    entityId?: string
    limit?: number
  }
): Promise<AuditLog[]> {
  let query = supabase.from('audit_logs').select('*').order('created_at', {ascending: false})

  if (filters?.userId) {
    query = query.eq('user_id', filters.userId)
  }

  if (filters?.entityType) {
    query = query.eq('entity_type', filters.entityType)
  }

  if (filters?.entityId) {
    query = query.eq('entity_id', filters.entityId)
  }

  if (filters?.limit) {
    query = query.limit(filters.limit)
  }

  const {data, error} = await query

  if (error) {
    console.error('获取审计日志失败:', error)
    return []
  }

  return Array.isArray(data) ? data : []
}
