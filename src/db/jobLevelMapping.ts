import {supabase} from '@/client/supabase'
import type {JobLevelRoleMapping, PermissionChangeLog, JobLevel, UserRole} from './types'

// 获取所有职级-角色映射
export async function getJobLevelMappings(): Promise<JobLevelRoleMapping[]> {
  const {data, error} = await supabase
    .from('job_level_role_mapping')
    .select('*')
    .order('created_at', {ascending: false})

  if (error) {
    console.error('获取职级映射失败:', error)
    throw error
  }

  return Array.isArray(data) ? data : []
}

// 根据职级获取对应的角色
export async function getRolesByJobLevel(jobLevel: JobLevel): Promise<UserRole[]> {
  const {data, error} = await supabase
    .from('job_level_role_mapping')
    .select('role')
    .eq('job_level', jobLevel)

  if (error) {
    console.error('获取职级对应角色失败:', error)
    throw error
  }

  return Array.isArray(data) ? data.map((item) => item.role) : []
}

// 创建职级-角色映射
export async function createJobLevelMapping(
  jobLevel: JobLevel,
  role: UserRole
): Promise<JobLevelRoleMapping | null> {
  const {data, error} = await supabase
    .from('job_level_role_mapping')
    .insert({
      job_level: jobLevel,
      role,
      created_by: (await supabase.auth.getUser()).data.user?.id
    })
    .select()
    .maybeSingle()

  if (error) {
    console.error('创建职级映射失败:', error)
    throw error
  }

  return data
}

// 删除职级-角色映射
export async function deleteJobLevelMapping(id: string): Promise<void> {
  const {error} = await supabase.from('job_level_role_mapping').delete().eq('id', id)

  if (error) {
    console.error('删除职级映射失败:', error)
    throw error
  }
}

// 批量更新职级映射（用于导入）
export async function batchUpdateJobLevelMappings(
  mappings: Array<{job_level: JobLevel; role: UserRole}>
): Promise<void> {
  // 先删除所有现有映射
  const {error: deleteError} = await supabase.from('job_level_role_mapping').delete().neq('id', '')

  if (deleteError) {
    console.error('删除现有映射失败:', deleteError)
    throw deleteError
  }

  // 插入新映射
  const userId = (await supabase.auth.getUser()).data.user?.id
  const {error: insertError} = await supabase.from('job_level_role_mapping').insert(
    mappings.map((m) => ({
      job_level: m.job_level,
      role: m.role,
      created_by: userId
    }))
  )

  if (insertError) {
    console.error('插入新映射失败:', insertError)
    throw insertError
  }
}

// 记录权限变更日志
export async function logPermissionChange(log: {
  user_id: string
  old_role?: UserRole
  new_role?: UserRole
  old_job_level?: JobLevel
  new_job_level?: JobLevel
  reason?: string
}): Promise<void> {
  const userId = (await supabase.auth.getUser()).data.user?.id

  const {error} = await supabase.from('permission_change_logs').insert({
    user_id: log.user_id,
    old_role: log.old_role || null,
    new_role: log.new_role || null,
    old_job_level: log.old_job_level || null,
    new_job_level: log.new_job_level || null,
    changed_by: userId,
    reason: log.reason || null
  })

  if (error) {
    console.error('记录权限变更日志失败:', error)
    throw error
  }
}

// 获取用户的权限变更日志
export async function getUserPermissionLogs(userId: string): Promise<PermissionChangeLog[]> {
  const {data, error} = await supabase
    .from('permission_change_logs')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', {ascending: false})
    .limit(50)

  if (error) {
    console.error('获取权限变更日志失败:', error)
    throw error
  }

  return Array.isArray(data) ? data : []
}

// 获取所有权限变更日志（管理员）
export async function getAllPermissionLogs(limit = 100): Promise<PermissionChangeLog[]> {
  const {data, error} = await supabase
    .from('permission_change_logs')
    .select('*')
    .order('created_at', {ascending: false})
    .limit(limit)

  if (error) {
    console.error('获取所有权限变更日志失败:', error)
    throw error
  }

  return Array.isArray(data) ? data : []
}
