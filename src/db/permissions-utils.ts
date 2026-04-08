/**
 * 权限判断工具函数
 * 统一处理角色权限判断逻辑
 */

import type {Profile} from './types'

/**
 * 检查用户是否是管理员（超级管理员或系统管理员）
 */
export function isAdmin(profile: Profile | null | undefined): boolean {
  if (!profile || !profile.role) return false
  return profile.role === 'super_admin' || profile.role === 'system_admin'
}

/**
 * 检查用户是否是超级管理员
 */
export function isSuperAdmin(profile: Profile | null | undefined): boolean {
  if (!profile || !profile.role) return false
  return profile.role === 'super_admin'
}

/**
 * 检查用户是否是系统管理员
 */
export function isSystemAdmin(profile: Profile | null | undefined): boolean {
  if (!profile || !profile.role) return false
  return profile.role === 'system_admin'
}

/**
 * 检查用户是否是公司领导
 */
export function isLeader(profile: Profile | null | undefined): boolean {
  if (!profile || !profile.role) return false
  return profile.role === 'leader'
}

/**
 * 检查用户是否是领导或管理员
 */
export function isLeaderOrAdmin(profile: Profile | null | undefined): boolean {
  return isLeader(profile) || isAdmin(profile)
}

/**
 * 检查用户是否是经营中心人员
 */
export function isBusinessStaff(profile: Profile | null | undefined): boolean {
  if (!profile || !profile.role) return false
  return profile.role === 'market_staff' || profile.role === 'business_center_staff'
}

/**
 * 检查用户是否是资料员
 */
export function isDataClerk(profile: Profile | null | undefined): boolean {
  if (!profile || !profile.role) return false
  return profile.role === 'data_clerk'
}

/**
 * 检查用户是否有编辑权限（管理员、经营中心人员、资料员）
 */
export function canEdit(profile: Profile | null | undefined): boolean {
  return isAdmin(profile) || isBusinessStaff(profile) || isDataClerk(profile)
}

/**
 * 检查用户是否有删除权限（仅管理员）
 */
export function canDelete(profile: Profile | null | undefined): boolean {
  return isAdmin(profile)
}

/**
 * 检查用户是否有审核权限（领导或管理员）
 */
export function canReview(profile: Profile | null | undefined): boolean {
  return isLeaderOrAdmin(profile)
}

/**
 * 检查用户是否是资源的所有者或管理员
 */
export function isOwnerOrAdmin(
  profile: Profile | null | undefined,
  ownerId: string | null | undefined
): boolean {
  if (!profile || !profile.id) return false
  if (isAdmin(profile)) return true
  return profile.id === ownerId
}
