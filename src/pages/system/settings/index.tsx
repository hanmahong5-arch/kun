import Taro from '@tarojs/taro'
import {withRouteGuard} from '@/components/RouteGuard'
import {useAuth} from '@/contexts/AuthContext'
import {isAdmin} from '@/db/permissions-utils'

function SystemSettingsPage() {
  const {profile} = useAuth()

  const hasAdminAccess = isAdmin(profile)

  const settingsSections = [
    {
      title: '用户与权限',
      items: [
        {
          icon: 'i-mdi-account-multiple',
          title: '用户管理',
          description: '管理系统用户账号',
          url: '/pages/system/users/index',
          roles: ['super_admin', 'system_admin']
        },
        {
          icon: 'i-mdi-shield-account',
          title: '角色权限',
          description: '配置角色权限',
          url: '/pages/system/roles/index',
          roles: ['super_admin', 'system_admin']
        },
        {
          icon: 'i-mdi-account-key',
          title: '职级权限配置',
          description: '管理职级与角色映射',
          url: '/pages/system/job-level-mapping/index',
          roles: ['super_admin', 'system_admin']
        }
      ]
    },
    {
      title: '组织架构',
      items: [
        {
          icon: 'i-mdi-account-group',
          title: '小组管理',
          description: '管理小组和成员',
          url: '/pages/teams/index',
          roles: ['super_admin', 'system_admin']
        }
      ]
    },
    {
      title: '系统管理',
      items: [
        {
          icon: 'i-mdi-file-document',
          title: '系统日志',
          description: '查看系统操作日志',
          url: '/pages/system/logs/index',
          roles: ['super_admin', 'system_admin']
        },
        {
          icon: 'i-mdi-account-cog',
          title: '账号管理',
          description: '账号安全设置',
          url: '/pages/system/accounts/index',
          roles: ['super_admin', 'system_admin']
        }
      ]
    }
  ]

  // 过滤用户有权限的设置项
  const filteredSections = settingsSections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => item.roles.includes((profile?.role as string) || ''))
    }))
    .filter((section) => section.items.length > 0)

  if (!hasAdminAccess) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6">
        <div className="text-center">
          <div className="i-mdi-lock text-6xl text-muted-foreground mb-4" />
          <div className="text-xl text-foreground">暂无权限访问</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background pb-6">
      {/* 头部 */}
      <div className="bg-gradient-primary px-6 py-6">
        <div className="text-2xl text-primary-foreground font-bold">系统设置</div>
        <div className="text-base text-primary-foreground/80 mt-1">管理系统配置和权限</div>
      </div>

      {/* 设置列表 */}
      <div className="px-6 mt-4 space-y-6">
        {filteredSections.map((section) => (
          <div key={section.title}>
            <div className="text-xl text-foreground font-bold mb-3">{section.title}</div>

            <div className="space-y-3">
              {section.items.map((item) => (
                <div
                  key={item.url}
                  onClick={() => Taro.navigateTo({url: item.url})}
                  className="bg-card rounded p-4 border border-border flex items-center gap-4">
                  <div className={`${item.icon} text-4xl text-primary`} />

                  <div className="flex-1">
                    <div className="text-xl text-foreground font-bold">{item.title}</div>
                    <div className="text-base text-muted-foreground mt-1">{item.description}</div>
                  </div>

                  <div className="i-mdi-chevron-right text-2xl text-muted-foreground" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* 系统信息 */}
      <div className="px-6 mt-6">
        <div className="bg-muted/30 rounded p-4">
          <div className="text-base text-muted-foreground text-center">
            智通经纬 v1.0.0
          </div>
          <div className="text-sm text-muted-foreground text-center mt-2">
            © 2026 All Rights Reserved
          </div>
        </div>
      </div>
    </div>
  )
}

export default withRouteGuard(SystemSettingsPage)
