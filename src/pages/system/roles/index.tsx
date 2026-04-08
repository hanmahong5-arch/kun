import {useState, useCallback, useEffect} from 'react'
import Taro, {useDidShow} from '@tarojs/taro'
import {withRouteGuard} from '@/components/RouteGuard'
import {getAllRoles, deleteRole, getRoleUserCount, getRolePermissionCount} from '@/db/roles'
import type {CustomRole} from '@/db/types'
import {useAuth} from '@/contexts/AuthContext'

interface RoleWithStats extends CustomRole {
  userCount?: number
  permissionCount?: number
}

function RoleManagementPage() {
  const {profile} = useAuth()
  const [roles, setRoles] = useState<RoleWithStats[]>([])
  const [loading, setLoading] = useState(true)

  const loadRoles = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getAllRoles()

      // 加载每个角色的统计信息
      const rolesWithStats = await Promise.all(
        data.map(async (role) => {
          const userCount = await getRoleUserCount(role.id)
          const permissionCount = await getRolePermissionCount(role.id)
          return {...role, userCount, permissionCount}
        })
      )

      setRoles(rolesWithStats)
    } catch (error) {
      console.error('加载角色列表失败:', error)
      Taro.showToast({title: '加载失败', icon: 'none'})
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadRoles()
  }, [loadRoles])

  useDidShow(() => {
    loadRoles()
  })

  const handleAddRole = () => {
    Taro.navigateTo({url: '/pages/system/roles/add/index'})
  }

  const handleEditRole = (roleCode: string) => {
    Taro.navigateTo({url: `/pages/system/roles/edit/index?role=${roleCode}`})
  }

  const handleDeleteRole = async (role: CustomRole) => {
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
      loadRoles()
    } catch (error) {
      console.error('删除角色失败:', error)
      const err = error as Error
      Taro.showToast({title: err.message || '删除失败', icon: 'none'})
    } finally {
      Taro.hideLoading()
    }
  }

  // 检查权限
  if (!profile || !['system_admin'].includes(profile.role as string)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6">
        <div className="text-center">
          <div className="i-mdi-lock text-6xl text-muted-foreground mb-4" />
          <div className="text-2xl text-foreground mb-2">无权限访问</div>
          <div className="text-base text-muted-foreground">仅管理员可访问此页面</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* 头部 */}
      <div className="bg-gradient-primary px-6 py-8">
        <div className="text-3xl text-primary-foreground font-bold mb-2">角色管理</div>
        <div className="text-base text-primary-foreground/80">管理系统角色和权限</div>
      </div>

      {/* 添加角色按钮 */}
      <div className="px-6 py-4">
        <button
          type="button"
          onClick={handleAddRole}
          className="w-full py-4 bg-primary text-primary-foreground text-xl rounded flex items-center justify-center leading-none gap-2">
          <div className="i-mdi-plus text-2xl" />
          <span>添加角色</span>
        </button>
      </div>

      {/* 角色列表 */}
      <div className="px-6 pb-6">
        {loading ? (
          <div className="text-center py-12">
            <div className="text-base text-muted-foreground">加载中...</div>
          </div>
        ) : roles.length === 0 ? (
          <div className="text-center py-12">
            <div className="i-mdi-shield-off text-6xl text-muted-foreground mb-4" />
            <div className="text-base text-muted-foreground">暂无角色</div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {roles.map((role) => (
              <div key={role.id} className="bg-card rounded p-4 border border-border">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="text-xl text-foreground font-bold">{role.name}</div>
                      {role.is_system && (
                        <div className="px-2 py-0.5 bg-primary/10 text-primary text-sm rounded">
                          系统
                        </div>
                      )}
                      {!role.is_active && (
                        <div className="px-2 py-0.5 bg-muted text-muted-foreground text-sm rounded">
                          已禁用
                        </div>
                      )}
                    </div>
                    <div className="text-base text-muted-foreground mb-2">{role.code}</div>
                    {role.description && (
                      <div className="text-base text-muted-foreground">{role.description}</div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleEditRole(role.code)}
                      className="px-3 py-1 bg-primary/10 text-primary text-base rounded flex items-center justify-center leading-none">
                      <div className="i-mdi-pencil text-xl mr-1" />
                      编辑
                    </button>
                    {!role.is_system && (
                      <button
                        type="button"
                        onClick={() => handleDeleteRole(role)}
                        className="px-3 py-1 bg-destructive/10 text-destructive text-base rounded flex items-center justify-center leading-none">
                        <div className="i-mdi-delete text-xl mr-1" />
                        删除
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-4 text-base text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <div className="i-mdi-account-group text-xl" />
                    <span>{role.userCount || 0} 个用户</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="i-mdi-shield-check text-xl" />
                    <span>{role.permissionCount || 0} 个权限</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default withRouteGuard(RoleManagementPage)
