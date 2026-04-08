import {ReactNode} from 'react'
import {usePermission} from '@/hooks/usePermission'
import type {PermissionExpression} from '@/utils/permissions'

export interface PermissionGuardProps {
  // 需要的权限（单个权限、权限数组或权限表达式）
  permission?: string
  permissions?: string[]
  expression?: string | PermissionExpression

  // 权限检查模式
  requireAll?: boolean // 是否需要全部权限（仅当permissions为数组时有效）

  // 无权限时的回退内容
  fallback?: ReactNode

  // 子元素
  children: ReactNode

  // 是否显示loading状态
  loading?: boolean
  loadingFallback?: ReactNode
}

/**
 * 权限守卫组件
 * 根据权限显示或隐藏UI元素
 *
 * 使用示例：
 * 1. 单个权限：
 *    <PermissionGuard permission="project.create">
 *      <button>创建项目</button>
 *    </PermissionGuard>
 *
 * 2. 多个权限（OR逻辑）：
 *    <PermissionGuard permissions={['project.create', 'project.edit']}>
 *      <button>编辑项目</button>
 *    </PermissionGuard>
 *
 * 3. 多个权限（AND逻辑）：
 *    <PermissionGuard permissions={['project.create', 'project.edit']} requireAll>
 *      <button>创建并编辑</button>
 *    </PermissionGuard>
 *
 * 4. 权限表达式：
 *    <PermissionGuard expression="project.create && !project.delete">
 *      <button>创建项目</button>
 *    </PermissionGuard>
 *
 * 5. 带回退内容：
 *    <PermissionGuard permission="project.create" fallback={<div>无权限</div>}>
 *      <button>创建项目</button>
 *    </PermissionGuard>
 */
export function PermissionGuard({
  permission,
  permissions,
  expression,
  requireAll = false,
  fallback = null,
  children,
  loading = false,
  loadingFallback = null
}: PermissionGuardProps) {
  const {hasPermission, hasAnyPermission, hasAllPermissions, checkPermissionExpression} =
    usePermission()

  // Loading状态
  if (loading) {
    return <>{loadingFallback}</>
  }

  // 检查权限
  let hasAccess = false

  if (expression) {
    // 权限表达式
    hasAccess = checkPermissionExpression(expression)
  } else if (permissions && permissions.length > 0) {
    // 多个权限
    hasAccess = requireAll ? hasAllPermissions(permissions) : hasAnyPermission(permissions)
  } else if (permission) {
    // 单个权限
    hasAccess = hasPermission(permission)
  } else {
    // 没有指定权限，默认显示
    hasAccess = true
  }

  // 根据权限决定显示内容
  return <>{hasAccess ? children : fallback}</>
}
