import {useState, useCallback, useEffect, useMemo} from 'react'
import Taro, {useDidShow} from '@tarojs/taro'
import {withRouteGuard} from '@/components/RouteGuard'
import {useAuth} from '@/contexts/AuthContext'
import {getRoleByCode, getRolePermissionCodes, setRolePermissions, deleteRole} from '@/db/roles'
import {hasAdminAccess} from '@/db/permissions-utils'
import type {CustomRole} from '@/db/types'

// 权限树结构定义
interface PermissionNode {
  code: string
  name: string
  children?: PermissionNode[]
}

// 权限树数据
const PERMISSION_TREE: PermissionNode[] = [
  {
    code: 'home',
    name: '首页',
    children: [
      {code: 'home.annual_target', name: '年度经营目标'},
      {code: 'home.team_target', name: '小组年度目标'},
      {code: 'home.quick_entry', name: '快捷入口'},
      {code: 'home.won_projects', name: '已中标项目'},
      {code: 'home.bidding_projects', name: '投标阶段项目'},
      {code: 'home.contract_dashboard', name: '小组合同额看板'}
    ]
  },
  {
    code: 'report',
    name: '工作汇报',
    children: [
      {code: 'report.list', name: '周报列表'},
      {code: 'report.detail', name: '周报详情'},
      {code: 'report.create', name: '创建周报'},
      {code: 'report.edit', name: '编辑周报'},
      {code: 'report.delete', name: '删除周报'},
      {code: 'report.review', name: '审阅周报'},
      {code: 'report.comment', name: '批注周报'},
      {code: 'report.task', name: '任务管理'},
      {code: 'report.task_assign', name: '指派任务'}
    ]
  },
  {
    code: 'project',
    name: '项目管理',
    children: [
      {code: 'project.list', name: '项目列表'},
      {code: 'project.detail', name: '项目详情'},
      {code: 'project.create', name: '创建项目'},
      {code: 'project.edit', name: '编辑项目'},
      {code: 'project.delete', name: '删除项目'}
    ]
  },
  {
    code: 'customer',
    name: '客户管理',
    children: [
      {code: 'customer.list', name: '客户列表'},
      {code: 'customer.detail', name: '客户详情'},
      {code: 'customer.create', name: '创建客户'},
      {code: 'customer.edit', name: '编辑客户'},
      {code: 'customer.delete', name: '删除客户'}
    ]
  },
  {
    code: 'profile',
    name: '我的',
    children: [
      {code: 'profile.info', name: '个人资料'},
      {code: 'profile.edit', name: '编辑资料'},
      {code: 'profile.password', name: '修改密码'},
      {code: 'profile.team', name: '我的小组'}
    ]
  }
]

function RoleEditPage() {
  const {profile} = useAuth()
  const roleCode = useMemo(() => Taro.getCurrentInstance().router?.params?.role || '', [])
  const [role, setRole] = useState<CustomRole | null>(null)
  const [roleName, setRoleName] = useState('')
  const [roleDisplayName, setRoleDisplayName] = useState('')
  const [selectedPermissions, setSelectedPermissions] = useState<Set<string>>(new Set())
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const hasAdminAccess = isAdmin(profile)

  // 加载角色数据
  const loadData = useCallback(async () => {
    if (!roleCode) return

    try {
      setLoading(true)

      // 加载角色信息
      const roleData = await getRoleByCode(roleCode)
      if (!roleData) {
        Taro.showToast({title: '角色不存在', icon: 'none'})
        setTimeout(() => Taro.navigateBack(), 1500)
        return
      }

      setRole(roleData)
      setRoleName(roleData.code)
      setRoleDisplayName(roleData.name)

      // 加载角色权限
      const permissionCodes = await getRolePermissionCodes(roleData.id)
      setSelectedPermissions(new Set(permissionCodes))
    } catch (error) {
      console.error('加载角色数据失败:', error)
      Taro.showToast({title: '加载失败', icon: 'none'})
    } finally {
      setLoading(false)
    }
  }, [roleCode])

  useEffect(() => {
    loadData()
  }, [loadData])

  useDidShow(() => {
    loadData()
  })

  // 获取所有权限代码
  const getAllPermissionCodes = () => {
    const codes: string[] = []
    PERMISSION_TREE.forEach((module) => {
      codes.push(module.code)
      if (module.children) {
        module.children.forEach((child) => {
          codes.push(child.code)
        })
      }
    })
    return codes
  }

  // 切换权限选中状态
  const togglePermission = (code: string) => {
    const newSet = new Set(selectedPermissions)
    if (newSet.has(code)) {
      newSet.delete(code)
      // 如果是模块，取消所有子权限
      const module = PERMISSION_TREE.find((m) => m.code === code)
      if (module?.children) {
        module.children.forEach((child) => {
          newSet.delete(child.code)
        })
      }
    } else {
      newSet.add(code)
    }
    setSelectedPermissions(newSet)
  }

  // 切换模块展开状态
  const toggleModule = (code: string) => {
    const newSet = new Set(expandedModules)
    if (newSet.has(code)) {
      newSet.delete(code)
    } else {
      newSet.add(code)
    }
    setExpandedModules(newSet)
  }

  // 模块全选
  const selectAllInModule = (module: PermissionNode) => {
    const newSet = new Set(selectedPermissions)
    newSet.add(module.code)
    if (module.children) {
      module.children.forEach((child) => {
        newSet.add(child.code)
      })
    }
    setSelectedPermissions(newSet)
  }

  // 模块反选
  const deselectAllInModule = (module: PermissionNode) => {
    const newSet = new Set(selectedPermissions)
    newSet.delete(module.code)
    if (module.children) {
      module.children.forEach((child) => {
        newSet.delete(child.code)
      })
    }
    setSelectedPermissions(newSet)
  }

  // 全局全选
  const selectAll = () => {
    setSelectedPermissions(new Set(getAllPermissionCodes()))
  }

  // 全局清空
  const clearAll = () => {
    setSelectedPermissions(new Set())
  }

  // 保存权限配置
  const handleSave = async () => {
    if (!role) {
      Taro.showToast({title: '角色信息未加载', icon: 'none'})
      return
    }

    // 验证输入
    if (!roleName.trim()) {
      Taro.showToast({title: '请输入角色代码', icon: 'none'})
      return
    }

    if (!roleDisplayName.trim()) {
      Taro.showToast({title: '请输入显示名称', icon: 'none'})
      return
    }

    try {
      setSaving(true)
      Taro.showLoading({title: '保存中...'})

      // 如果角色名称或显示名称有变化，先更新角色信息
      if (roleName !== role.code || roleDisplayName !== role.name) {
        const {updateRole} = await import('@/db/roles')
        const updateResult = await updateRole(role.id, {
          code: roleName,
          name: roleDisplayName
        })

        if (!updateResult.success) {
          throw new Error(updateResult.error || '更新角色信息失败')
        }
      }

      // 保存权限
      const result = await setRolePermissions(role.id, Array.from(selectedPermissions))

      if (!result.success) {
        throw new Error(result.error || '保存失败')
      }

      Taro.showToast({title: '保存成功', icon: 'success'})

      // 提示用户重新登录
      setTimeout(() => {
        Taro.showModal({
          title: '权限已更新',
          content: '角色权限已更新，相关用户需要重新登录以生效',
          showCancel: false
        })
      }, 1500)

      // 刷新数据
      setTimeout(() => {
        loadData()
      }, 2000)
    } catch (error) {
      console.error('保存权限失败:', error)
      const err = error as Error
      Taro.showToast({title: err.message || '保存失败', icon: 'none'})
    } finally {
      setSaving(false)
      Taro.hideLoading()
    }
  }

  // 删除角色
  const handleDelete = async () => {
    if (!role) {
      Taro.showToast({title: '角色信息未加载', icon: 'none'})
      return
    }

    if (role.is_system) {
      Taro.showToast({title: '系统角色不可删除', icon: 'none'})
      return
    }

    const res = await Taro.showModal({
      title: '确认删除',
      content: `确定要删除角色"${role.name}"吗？此操作不可恢复`,
      confirmText: '删除',
      confirmColor: '#ef4444'
    })

    if (!res.confirm) return

    try {
      Taro.showLoading({title: '删除中...'})

      const result = await deleteRole(role.id)

      if (!result.success) {
        throw new Error(result.error || '删除失败')
      }

      Taro.showToast({title: '删除成功', icon: 'success'})
      setTimeout(() => {
        Taro.navigateBack()
      }, 1500)
    } catch (error) {
      console.error('删除角色失败:', error)
      const err = error as Error
      Taro.showToast({title: err.message || '删除失败', icon: 'none'})
    } finally {
      Taro.hideLoading()
    }
  }

  // 检查模块是否全选
  const isModuleFullySelected = (module: PermissionNode) => {
    if (!selectedPermissions.has(module.code)) return false
    if (!module.children) return true
    return module.children.every((child) => selectedPermissions.has(child.code))
  }

  // 检查模块是否部分选中
  const isModulePartiallySelected = (module: PermissionNode) => {
    if (selectedPermissions.has(module.code)) return true
    if (!module.children) return false
    return module.children.some((child) => selectedPermissions.has(child.code))
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-xl text-muted-foreground">加载中...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background pb-32">
      {/* 头部 */}
      <div className="bg-gradient-primary px-6 py-6">
        <div className="text-2xl text-primary-foreground font-bold">编辑角色权限</div>
        <div className="text-base text-primary-foreground/80 mt-1">{roleDisplayName}</div>
      </div>

      {/* 角色信息 */}
      <div className="px-6 mt-4">
        <div className="bg-card rounded p-4 border border-border space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-xl text-foreground font-bold">角色信息</div>
            <div className="text-base text-primary">
              已选权限：{selectedPermissions.size} / {getAllPermissionCodes().length}
            </div>
          </div>

          <div>
            <div className="text-base text-muted-foreground mb-2">角色代码</div>
            <div className="border-2 border-input rounded px-4 py-3 bg-background overflow-hidden">
              <input
                type="text"
                value={roleName}
                onInput={(e) => {
                  const ev = e as unknown
                  setRoleName(
                    (ev as {detail?: {value?: string}}).detail?.value ??
                      (ev as {target?: {value?: string}}).target?.value ??
                      ''
                  )
                }}
                placeholder="请输入角色代码"
                className="w-full text-xl text-foreground bg-transparent outline-none"
                disabled={role?.is_system}
              />
            </div>
            {role?.is_system && (
              <div className="text-sm text-muted-foreground mt-1">系统角色代码不可修改</div>
            )}
          </div>

          <div>
            <div className="text-base text-muted-foreground mb-2">显示名称</div>
            <div className="border-2 border-input rounded px-4 py-3 bg-background overflow-hidden">
              <input
                type="text"
                value={roleDisplayName}
                onInput={(e) => {
                  const ev = e as unknown
                  setRoleDisplayName(
                    (ev as {detail?: {value?: string}}).detail?.value ??
                      (ev as {target?: {value?: string}}).target?.value ??
                      ''
                  )
                }}
                placeholder="请输入显示名称"
                className="w-full text-xl text-foreground bg-transparent outline-none"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 全局操作 */}
      <div className="px-6 mt-4">
        <div className="flex gap-3">
          <button
            type="button"
            onClick={selectAll}
            className="flex-1 py-3 bg-primary text-primary-foreground text-base rounded flex items-center justify-center leading-none">
            <div className="i-mdi-check-all text-xl mr-1" />
            全选
          </button>
          <button
            type="button"
            onClick={clearAll}
            className="flex-1 py-3 bg-muted text-foreground text-base rounded flex items-center justify-center leading-none border-2 border-border">
            <div className="i-mdi-close text-xl mr-1" />
            清空
          </button>
        </div>
      </div>

      {/* 权限树 */}
      <div className="px-6 mt-4">
        <div className="bg-card rounded p-4 border border-border">
          <div className="text-xl text-foreground font-bold mb-4">权限配置</div>

          <div className="space-y-3">
            {PERMISSION_TREE.map((module) => (
              <div key={module.code} className="border border-border rounded overflow-hidden">
                {/* 模块头部 */}
                <div className="bg-muted/30 px-4 py-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1">
                      <button
                        type="button"
                        onClick={() => togglePermission(module.code)}
                        className="flex items-center justify-center leading-none">
                        <div
                          className={`text-2xl ${
                            isModuleFullySelected(module)
                              ? 'i-mdi-checkbox-marked text-primary'
                              : isModulePartiallySelected(module)
                                ? 'i-mdi-checkbox-intermediate text-primary'
                                : 'i-mdi-checkbox-blank-outline text-muted-foreground'
                          }`}
                        />
                      </button>

                      <div
                        onClick={() => toggleModule(module.code)}
                        className="flex-1 flex items-center gap-2">
                        <div className="text-xl text-foreground font-bold">{module.name}</div>
                        <div
                          className={`text-xl text-muted-foreground transition-transform ${
                            expandedModules.has(module.code) ? 'rotate-180' : ''
                          } i-mdi-chevron-down`}
                        />
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => selectAllInModule(module)}
                        className="px-3 py-1 bg-primary/10 text-primary text-sm rounded">
                        全选
                      </button>
                      <button
                        type="button"
                        onClick={() => deselectAllInModule(module)}
                        className="px-3 py-1 bg-muted text-foreground text-sm rounded border border-border">
                        反选
                      </button>
                    </div>
                  </div>
                </div>

                {/* 子权限 */}
                {expandedModules.has(module.code) && module.children && (
                  <div className="px-4 py-3 space-y-2">
                    {module.children.map((child) => (
                      <div
                        key={child.code}
                        onClick={() => togglePermission(child.code)}
                        className="flex items-center gap-3 py-2">
                        <div
                          className={`text-2xl ${
                            selectedPermissions.has(child.code)
                              ? 'i-mdi-checkbox-marked text-primary'
                              : 'i-mdi-checkbox-blank-outline text-muted-foreground'
                          }`}
                        />
                        <div className="text-base text-foreground">{child.name}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 底部操作栏 */}
      <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border px-6 py-4">
        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-3 bg-primary text-primary-foreground text-xl rounded flex items-center justify-center leading-none">
            <div className="i-mdi-content-save text-2xl mr-2" />
            保存
          </button>

          {isAdmin && (
            <button
              type="button"
              onClick={handleDelete}
              className="px-6 py-3 bg-destructive text-destructive-foreground text-xl rounded flex items-center justify-center leading-none">
              <div className="i-mdi-delete text-2xl mr-2" />
              删除
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default withRouteGuard(RoleEditPage)
