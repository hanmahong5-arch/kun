import {useAuth} from '@/contexts/AuthContext'
import {
  evaluatePermission,
  parsePermissionExpression,
  checkPermissions,
  type PermissionExpression
} from '@/utils/permissions'

/**
 * 权限检查 Hook
 * 提供多种权限检查方式
 */
export function usePermission() {
  const {permissions} = useAuth()

  const permissionSet = new Set(permissions || [])

  /**
   * 检查单个权限
   */
  const hasPermission = (permission: string): boolean => {
    return permissionSet.has(permission)
  }

  /**
   * 检查多个权限（OR逻辑）
   */
  const hasAnyPermission = (permissions: string[]): boolean => {
    return checkPermissions(permissions, permissionSet, false)
  }

  /**
   * 检查多个权限（AND逻辑）
   */
  const hasAllPermissions = (permissions: string[]): boolean => {
    return checkPermissions(permissions, permissionSet, true)
  }

  /**
   * 检查权限表达式
   * 支持字符串表达式或对象表达式
   */
  const checkPermissionExpression = (expression: string | PermissionExpression): boolean => {
    if (typeof expression === 'string') {
      // 如果包含逻辑运算符，解析表达式
      if (expression.includes('&&') || expression.includes('||') || expression.includes('!')) {
        const parsed = parsePermissionExpression(expression)
        return evaluatePermission(parsed, permissionSet)
      }
      // 否则直接检查权限
      return hasPermission(expression)
    }

    // 对象表达式
    return evaluatePermission(expression, permissionSet)
  }

  return {
    permissions: Array.from(permissionSet),
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    checkPermissionExpression
  }
}
