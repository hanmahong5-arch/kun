import {useState, useCallback, useEffect, useMemo} from 'react'
import Taro from '@tarojs/taro'
import {withRouteGuard} from '@/components/RouteGuard'
import {
  getAllPermissions,
  getRolePermissionIds,
  setRolePermissions
} from '@/db/permissions'
import type {Permission} from '@/db/types'

function RolePermissionsPage() {
  const roleId = useMemo(() => Taro.getCurrentInstance().router?.params?.roleId || '', [])
  const roleName = useMemo(
    () => decodeURIComponent(Taro.getCurrentInstance().router?.params?.roleName || ''),
    []
  )

  const [permissions, setPermissions] = useState<Permission[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [allPerms, rolePermIds] = await Promise.all([
        getAllPermissions(),
        getRolePermissionIds(roleId)
      ])

      setPermissions(allPerms)
      setSelectedIds(new Set(rolePermIds))
    } catch (error) {
      console.error('加载权限数据失败:', error)
      Taro.showToast({title: '加载失败', icon: 'none'})
    } finally {
      setLoading(false)
    }
  }, [roleId])

  useEffect(() => {
    loadData()
  }, [loadData])

  // 按类型分组权限
  const groupedPermissions = useMemo(() => {
    const groups: Record<string, Permission[]> = {
      menu: [],
      operation: [],
      data: []
    }

    permissions.forEach((perm) => {
      if (groups[perm.type]) {
        groups[perm.type].push(perm)
      }
    })

    return groups
  }, [permissions])

  const handleTogglePermission = (permissionId: string) => {
    const newSelected = new Set(selectedIds)
    if (newSelected.has(permissionId)) {
      newSelected.delete(permissionId)
    } else {
      newSelected.add(permissionId)
    }
    setSelectedIds(newSelected)
  }

  const handleSelectAll = (type: string) => {
    const typePermissions = groupedPermissions[type] || []
    const typeIds = typePermissions.map((p) => p.id)
    const allSelected = typeIds.every((id) => selectedIds.has(id))

    const newSelected = new Set(selectedIds)
    if (allSelected) {
      // 取消全选
      typeIds.forEach((id) => {
        newSelected.delete(id)
      })
    } else {
      // 全选
      typeIds.forEach((id) => {
        newSelected.add(id)
      })
    }
    setSelectedIds(newSelected)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const result = await setRolePermissions(roleId, Array.from(selectedIds))

      if (result.success) {
        Taro.showToast({title: '保存成功', icon: 'success'})
        setTimeout(() => {
          Taro.navigateBack()
        }, 1500)
      } else {
        Taro.showToast({title: result.error || '保存失败', icon: 'none'})
      }
    } catch (error) {
      console.error('保存权限失败:', error)
      Taro.showToast({title: '保存失败', icon: 'none'})
    } finally {
      setSaving(false)
    }
  }

  const typeNames: Record<string, string> = {
    menu: '菜单权限',
    operation: '操作权限',
    data: '数据权限'
  }

  const typeIcons: Record<string, string> = {
    menu: 'i-mdi-menu',
    operation: 'i-mdi-cog',
    data: 'i-mdi-database'
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-xl text-muted-foreground">加载中...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background pb-6">
      {/* 页面标题 */}
      <div className="px-6 py-6 bg-gradient-primary">
        <div className="text-3xl text-primary-foreground font-bold mb-2">配置权限</div>
        <div className="text-xl text-primary-foreground/80">为"{roleName}"分配权限</div>
      </div>

      {/* 统计信息 */}
      <div className="px-6 mt-4">
        <div className="bg-card rounded p-4 border border-border">
          <div className="flex items-center justify-between">
            <div className="text-base text-muted-foreground">已选择权限</div>
            <div className="text-2xl text-primary font-bold">
              {selectedIds.size} / {permissions.length}
            </div>
          </div>
        </div>
      </div>

      {/* 权限列表 */}
      <div className="px-6 mt-4 flex flex-col gap-4">
        {Object.entries(groupedPermissions).map(([type, perms]) => {
          if (perms.length === 0) return null

          const allSelected = perms.every((p) => selectedIds.has(p.id))

          return (
            <div key={type} className="bg-card rounded border border-border">
              {/* 分类标题 */}
              <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`${typeIcons[type]} text-2xl text-primary`} />
                  <div className="text-xl text-foreground font-bold">{typeNames[type]}</div>
                  <div className="text-base text-muted-foreground">({perms.length})</div>
                </div>
                <button
                  type="button"
                  onClick={() => handleSelectAll(type)}
                  className="px-3 py-1 bg-primary/10 text-primary text-base rounded">
                  {allSelected ? '取消全选' : '全选'}
                </button>
              </div>

              {/* 权限项列表 */}
              <div className="p-2">
                {perms.map((perm) => {
                  const isSelected = selectedIds.has(perm.id)

                  return (
                    <div
                      key={perm.id}
                      onClick={() => handleTogglePermission(perm.id)}
                      className="flex items-center gap-3 p-3 rounded hover:bg-muted/50">
                      {/* 复选框 */}
                      <div
                        className={`w-6 h-6 rounded border-2 flex items-center justify-center ${
                          isSelected
                            ? 'bg-primary border-primary'
                            : 'bg-card border-input'
                        }`}>
                        {isSelected && (
                          <div className="i-mdi-check text-xl text-primary-foreground" />
                        )}
                      </div>

                      {/* 权限信息 */}
                      <div className="flex-1">
                        <div className="text-xl text-foreground">{perm.name}</div>
                        {perm.description && (
                          <div className="text-sm text-muted-foreground mt-1">
                            {perm.description}
                          </div>
                        )}
                        <div className="text-xs text-muted-foreground mt-1">
                          代码: {perm.code}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* 保存按钮 */}
      <div className="px-6 mt-4">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className={`w-full py-4 bg-primary text-primary-foreground text-xl rounded flex items-center justify-center leading-none ${
            saving ? 'opacity-50' : ''
          }`}>
          {saving ? '保存中...' : '保存权限配置'}
        </button>
      </div>
    </div>
  )
}

export default withRouteGuard(RolePermissionsPage)
