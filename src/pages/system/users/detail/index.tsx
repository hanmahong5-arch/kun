import {useState, useEffect, useCallback, useMemo} from 'react'
import Taro, {useDidShow} from '@tarojs/taro'
import {withRouteGuard} from '@/components/RouteGuard'
import {useAuth} from '@/contexts/AuthContext'
import {getProfile} from '@/db/api'
import {maskPhone} from '@/utils/format'
import type {Profile} from '@/db/types'
import {RoleDisplayNames} from '@/db/types'

function UserDetail() {
  const {profile: currentUser} = useAuth()
  const userId = useMemo(() => Taro.getCurrentInstance().router?.params?.id || '', [])
  const [user, setUser] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  const loadUser = useCallback(async () => {
    if (!userId) return
    try {
      setLoading(true)
      const data = await getProfile(userId)
      setUser(data)
    } catch (error) {
      console.error('加载用户信息失败:', error)
      Taro.showToast({title: '加载失败', icon: 'none'})
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    loadUser()
  }, [loadUser])

  useDidShow(() => {
    loadUser()
  })

  const getRoleLabel = (role: string) => {
    return RoleDisplayNames[role as keyof typeof RoleDisplayNames] || role
  }

  const getStaffLevelLabel = (level: string | null) => {
    if (!level) return '-'
    const labels: Record<string, string> = {
      senior_manager: '高级经理',
      level_1: '一级职员',
      level_2: '二级职员',
      level_3: '三级职员'
    }
    return labels[level] || level
  }

  // 检查权限
  if (!currentUser || currentUser.role !== 'system_admin') {
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

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-base text-muted-foreground">加载中...</div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6">
        <div className="text-center">
          <div className="i-mdi-account-off text-6xl text-muted-foreground mb-4" />
          <div className="text-2xl text-foreground mb-2">用户不存在</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* 头部 */}
      <div className="bg-gradient-primary px-6 py-8">
        <div className="text-3xl text-primary-foreground font-bold mb-2">用户详情</div>
        <div className="text-base text-primary-foreground/80">查看用户信息</div>
      </div>

      {/* 用户信息 */}
      <div className="px-6 py-6">
        <div className="bg-card rounded-lg p-6 border border-border mb-6">
          {/* 用户名称 */}
          <div className="mb-6">
            <div className="text-2xl text-foreground font-bold">{user.name}</div>
          </div>

          {/* 基本信息 */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="i-mdi-phone text-2xl text-primary" />
              <div className="flex-1">
                <div className="text-base text-muted-foreground mb-1">手机号</div>
                <div className="text-xl text-foreground">{maskPhone(user.phone)}</div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="i-mdi-shield-account text-2xl text-primary" />
              <div className="flex-1">
                <div className="text-base text-muted-foreground mb-1">角色</div>
                <div className="text-xl text-foreground">{getRoleLabel(user.role)}</div>
              </div>
            </div>

            {user.position && (
              <div className="flex items-center gap-3">
                <div className="i-mdi-briefcase text-2xl text-primary" />
                <div className="flex-1">
                  <div className="text-base text-muted-foreground mb-1">职务</div>
                  <div className="text-xl text-foreground">{user.position}</div>
                </div>
              </div>
            )}

            {user.department && (
              <div className="flex items-center gap-3">
                <div className="i-mdi-office-building text-2xl text-primary" />
                <div className="flex-1">
                  <div className="text-base text-muted-foreground mb-1">部门</div>
                  <div className="text-xl text-foreground">{user.department}</div>
                </div>
              </div>
            )}

            {user.position && (
              <div className="flex items-center gap-3">
                <div className="i-mdi-star text-2xl text-primary" />
                <div className="flex-1">
                  <div className="text-base text-muted-foreground mb-1">职级</div>
                  <div className="text-xl text-foreground">{user.position}</div>
                </div>
              </div>
            )}

            <div className="flex items-center gap-3">
              <div className="i-mdi-calendar text-2xl text-primary" />
              <div className="flex-1">
                <div className="text-base text-muted-foreground mb-1">创建时间</div>
                <div className="text-xl text-foreground">
                  {new Date(user.created_at).toLocaleString('zh-CN')}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default withRouteGuard(UserDetail)
