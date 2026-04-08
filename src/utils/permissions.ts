// 权限表达式解析器
// 支持 AND、OR、NOT 逻辑运算

export type PermissionExpression = string | PermissionExpressionObject

export interface PermissionExpressionObject {
  and?: PermissionExpression[]
  or?: PermissionExpression[]
  not?: PermissionExpression
}

/**
 * 解析权限表达式
 * @param expression 权限表达式
 * @param userPermissions 用户拥有的权限集合
 * @returns 是否有权限
 */
export function evaluatePermission(
  expression: PermissionExpression,
  userPermissions: Set<string>
): boolean {
  // 如果是字符串，直接检查权限
  if (typeof expression === 'string') {
    return userPermissions.has(expression)
  }

  // 如果是对象，解析逻辑表达式
  const expr = expression as PermissionExpressionObject

  // AND 逻辑：所有条件都必须满足
  if (expr.and) {
    return expr.and.every((subExpr) => evaluatePermission(subExpr, userPermissions))
  }

  // OR 逻辑：至少一个条件满足
  if (expr.or) {
    return expr.or.some((subExpr) => evaluatePermission(subExpr, userPermissions))
  }

  // NOT 逻辑：条件不满足
  if (expr.not) {
    return !evaluatePermission(expr.not, userPermissions)
  }

  return false
}

/**
 * 从字符串解析权限表达式
 * 支持的语法：
 * - 单个权限：'project.create'
 * - AND：'project.create && project.edit'
 * - OR：'project.create || project.edit'
 * - NOT：'!project.delete'
 * - 括号分组：'(project.create || project.edit) && !project.delete'
 */
export function parsePermissionExpression(expr: string): PermissionExpression {
  // 移除空格
  const trimmed = expr.trim()

  // 处理括号
  if (trimmed.startsWith('(') && trimmed.endsWith(')')) {
    return parsePermissionExpression(trimmed.slice(1, -1))
  }

  // 处理 OR（优先级最低）
  const orParts = splitByOperator(trimmed, '||')
  if (orParts.length > 1) {
    return {
      or: orParts.map((part) => parsePermissionExpression(part))
    }
  }

  // 处理 AND
  const andParts = splitByOperator(trimmed, '&&')
  if (andParts.length > 1) {
    return {
      and: andParts.map((part) => parsePermissionExpression(part))
    }
  }

  // 处理 NOT
  if (trimmed.startsWith('!')) {
    return {
      not: parsePermissionExpression(trimmed.slice(1))
    }
  }

  // 单个权限
  return trimmed
}

/**
 * 按操作符分割字符串（考虑括号）
 */
function splitByOperator(expr: string, operator: string): string[] {
  const parts: string[] = []
  let current = ''
  let depth = 0
  let i = 0

  while (i < expr.length) {
    const char = expr[i]

    if (char === '(') {
      depth++
      current += char
      i++
    } else if (char === ')') {
      depth--
      current += char
      i++
    } else if (depth === 0 && expr.slice(i, i + operator.length) === operator) {
      parts.push(current.trim())
      current = ''
      i += operator.length
    } else {
      current += char
      i++
    }
  }

  if (current.trim()) {
    parts.push(current.trim())
  }

  return parts.length > 1 ? parts : [expr]
}

/**
 * 简化的权限检查函数
 * @param permissions 需要的权限（字符串或数组）
 * @param userPermissions 用户拥有的权限集合
 * @param requireAll 是否需要全部权限（默认false，即OR逻辑）
 */
export function checkPermissions(
  permissions: string | string[],
  userPermissions: Set<string>,
  requireAll = false
): boolean {
  if (typeof permissions === 'string') {
    return userPermissions.has(permissions)
  }

  if (requireAll) {
    return permissions.every((p) => userPermissions.has(p))
  }

  return permissions.some((p) => userPermissions.has(p))
}
