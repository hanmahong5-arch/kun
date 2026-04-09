import {useState, useCallback, useEffect} from 'react'
import Taro, {useDidShow} from '@tarojs/taro'
import {withRouteGuard} from '@/components/RouteGuard'
import {useAuth} from '@/contexts/AuthContext'
import {RoleDisplayNames} from '@/db/types'
import {getUnreadNotificationCount} from '@/db/api'
import {supabase} from '@/client/supabase'
import type {Team} from '@/db/types'

function Profile() {
  const {profile, signOut} = useAuth()
  const [unreadCount, setUnreadCount] = useState(0)
  const [userTeams, setUserTeams] = useState<Team[]>([])

  const loadUnreadCount = useCallback(async () => {
    if (!profile) return
    try {
      const count = await getUnreadNotificationCount(profile.id as string)
      setUnreadCount(count)
    } catch (error) {
      console.error('加载未读数量失败:', error)
    }
  }, [profile])

  const loadUserTeams = useCallback(async () => {
    if (!profile) return
    try {
      const {data: userTeamsData} = await supabase
        .from('user_teams')
        .select('team_id')
        .eq('user_id', profile.id)

      if (userTeamsData && userTeamsData.length > 0) {
        const teamIds = userTeamsData.map((ut) => ut.team_id)
        const {data: teamsData} = await supabase
          .from('teams')
          .select('*')
          .in('id', teamIds)
          .order('display_order')

        setUserTeams(Array.isArray(teamsData) ? teamsData : [])
      } else {
        setUserTeams([])
      }
    } catch (error) {
      console.error('加载小组信息失败:', error)
    }
  }, [profile])

  useDidShow(() => {
    loadUnreadCount()
    loadUserTeams()
  })

  useEffect(() => {
    loadUnreadCount()
    loadUserTeams()
  }, [loadUnreadCount, loadUserTeams])

  const handleLogout = async () => {
    const res = await Taro.showModal({
      title: '确认退出',
      content: '确定要退出登录吗？'
    })

    if (res.confirm) {
      await signOut()
      Taro.reLaunch({url: '/pages/login/index'})
    }
  }

  if (!profile) {
    return null
  }

  const getRoleLabel = (role: string) => {
    return RoleDisplayNames[role as keyof typeof RoleDisplayNames] || role
  }

  const menuItems = [
    {
      icon: 'i-mdi-account-edit',
      title: '个人信息',
      url: '/pages/profile/edit/index' as string,
      badge: 0
    },
    {
      icon: 'i-mdi-shield-lock',
      title: '账号安全',
      url: '/pages/profile/security/index' as string,
      badge: 0
    },
    {
      icon: 'i-mdi-bell',
      title: '消息通知',
      url: '/pages/notifications/index' as string,
      badge: unreadCount
    }
  ]

  // 管理员菜单 - 超级管理员和系统管理员都可以看到
  const isAdmin = profile.role === 'super_admin' || profile.role === 'system_admin'
  
  const adminMenuItems = isAdmin
    ? [
        {
          icon: 'i-mdi-account-multiple',
          title: '用户管理',
          url: '/pages/system/users/index' as string
        },
        {
          icon: 'i-mdi-shield-account',
          title: '角色权限',
          url: '/pages/system/roles/index' as string
        },
        {
          icon: 'i-mdi-cog',
          title: '系统设置',
          url: '/pages/system/settings/index' as string
        }
      ]
    : []

  return (
    <div className="min-h-screen bg-background pb-6">
      {/* 用户信息卡片 */}
      <div className="bg-gradient-primary px-6 py-8 mb-6">
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 rounded-full bg-primary-foreground/20 flex items-center justify-center">
            <div className="i-mdi-account text-[50px] text-primary-foreground" />
          </div>
          <div className="flex-1">
            <div className="text-2xl text-primary-foreground font-bold mb-1">{profile.name as string}</div>
            <div className="text-xl text-primary-foreground/80">{getRoleLabel(profile.role as string)}</div>
            {profile.position ? (
              <div className="text-base text-primary-foreground/70 mt-1">{profile.position as string}</div>
            ) : null}
          </div>
        </div>
      </div>

      {/* 基本信息 */}
      <div className="px-6 mb-6">
        <div className="bg-card rounded shadow-card p-4">
          <div className="flex items-center justify-between py-3 border-b border-border">
            <div className="text-xl text-muted-foreground">手机号</div>
            <div className="text-xl text-foreground">{(profile.phone as string) || '未设置'}</div>
          </div>
          {profile.department ? (
            <div className="flex items-center justify-between py-3 border-b border-border">
              <div className="text-xl text-muted-foreground">部门</div>
              <div className="text-xl text-foreground">{profile.department as string}</div>
            </div>
          ) : null}
          <div className="flex items-center justify-between py-3">
            <div className="text-xl text-muted-foreground">角色</div>
            <div className="text-xl text-foreground">{getRoleLabel(profile.role as string)}</div>
          </div>
        </div>
      </div>

      {/* 我的小组 */}
      <div className="px-6 mb-6">
        <div className="text-xl text-foreground font-bold mb-3">我的小组</div>
        {userTeams.length > 0 ? (
          <div className="flex flex-col gap-3">
            {userTeams.map((team) => (
              <div key={team.id} className="bg-card rounded shadow-card p-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                    <div className="i-mdi-account-group text-3xl text-primary" />
                  </div>
                  <div className="flex-1">
                    <div className="text-xl text-foreground font-bold">{team.name}</div>
                    {team.description && (
                      <div className="text-base text-muted-foreground mt-1">{team.description}</div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-card rounded shadow-card p-6 text-center">
            <div className="i-mdi-account-group-outline text-6xl text-muted-foreground mb-2" />
            <div className="text-base text-muted-foreground">您还未加入任何小组</div>
          </div>
        )}
      </div>

      {/* 功能菜单 */}
      <div className="px-6 mb-6">
        <div className="bg-card rounded shadow-card">
          {menuItems.map((item, index) => (
            <div
              key={item.url}
              className={`flex items-center justify-between px-4 py-4 ${
                index < menuItems.length - 1 ? 'border-b border-border' : ''
              }`}
              onClick={() => Taro.navigateTo({url: item.url})}>
              <div className="flex items-center gap-3">
                <div className={`${item.icon} text-2xl text-primary`} />
                <div className="text-xl text-foreground">{item.title}</div>
                {item.badge > 0 && (
                  <div className="px-2 py-1 bg-destructive text-destructive-foreground text-sm rounded-full min-w-6 text-center">
                    {item.badge}
                  </div>
                )}
              </div>
              <div className="i-mdi-chevron-right text-2xl text-muted-foreground" />
            </div>
          ))}
        </div>
      </div>

      {/* 管理员菜单 */}
      {adminMenuItems.length > 0 && (
        <div className="px-6 mb-6">
          <div className="text-xl text-muted-foreground mb-3">管理功能</div>
          <div className="bg-card rounded shadow-card">
            {adminMenuItems.map((item, index) => (
              <div
                key={item.url}
                className={`flex items-center justify-between px-4 py-4 ${
                  index < adminMenuItems.length - 1 ? 'border-b border-border' : ''
                }`}
                onClick={() => Taro.navigateTo({url: item.url})}>
                <div className="flex items-center gap-3">
                  <div className={`${item.icon} text-2xl text-primary`} />
                  <div className="text-xl text-foreground">{item.title}</div>
                </div>
                <div className="i-mdi-chevron-right text-2xl text-muted-foreground" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 退出登录 */}
      <div className="px-6">
        <button
          type="button"
          onClick={handleLogout}
          className="w-full py-4 bg-card text-destructive text-xl rounded shadow-card flex items-center justify-center leading-none gap-2">
          <div className="i-mdi-logout text-2xl" />
          <span>退出登录</span>
        </button>
      </div>
    </div>
  )
}

export default withRouteGuard(Profile)
