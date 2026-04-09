import {useState, useEffect, useCallback} from 'react'
import Taro, {useDidShow} from '@tarojs/taro'
import {withRouteGuard} from '@/components/RouteGuard'
import {useAuth} from '@/contexts/AuthContext'
import {getAllProfiles} from '@/db/api'
import {maskPhone} from '@/utils/format'
import type {Profile} from '@/db/types'
import {RoleDisplayNames} from '@/db/types'
import {supabase} from '@/client/supabase'

function UserManagement() {
  const {profile} = useAuth()
  const [users, setUsers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [checking, setChecking] = useState(false)
  const [fixing, setFixing] = useState(false)
  const [checkResult, setCheckResult] = useState<{
    orphan_auth_count: number
    orphan_profile_count: number
    orphan_auth_users: Array<{id: string; email: string; phone: string; created_at: string}>
    orphan_profiles: Array<{id: string; phone: string; name: string; created_at: string}>
  } | null>(null)

  const loadUsers = useCallback(async () => {
    try {
      setLoading(true)
      const data = await getAllProfiles()
      setUsers(data)
    } catch (error) {
      console.error('加载用户列表失败:', error)
      Taro.showToast({title: '加载失败', icon: 'none'})
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadUsers()
  }, [loadUsers])

  useDidShow(() => {
    loadUsers()
  })

  const handleAddUser = () => {
    Taro.navigateTo({url: '/pages/system/users/add/index'})
  }

  const handleViewUser = (userId: string) => {
    Taro.navigateTo({url: `/pages/system/users/detail/index?id=${userId}`})
  }

  const handleDeleteUser = async (userId: string, userName: string) => {
    // Double confirmation for destructive action (国央企 safety requirement)
    const res = await Taro.showModal({
      title: '确认删除用户',
      content: `确定要删除用户"${userName}"吗？\n\n该用户的所有数据（周报、任务等）将一并删除，此操作不可恢复。`,
      confirmText: '确认删除',
      confirmColor: '#ef4444'
    })

    if (!res.confirm) return

    try {
      Taro.showLoading({title: '正在删除用户...'})

      // Safe deletion order: related data -> user_roles -> profile -> auth
      // Profile has ON DELETE CASCADE, so related data is cleaned automatically

      // 1. Delete user-role associations
      await supabase.from('user_roles').delete().eq('user_id', userId)

      // 2. Delete profile (CASCADE handles weekly_reports, tasks, etc.)
      const {error: profileError} = await supabase.from('profiles').delete().eq('id', userId)
      if (profileError) throw new Error(`删除用户档案失败: ${profileError.message}`)

      // 3. Auth user deletion is handled by CASCADE (profiles references auth.users with ON DELETE CASCADE)
      // If auth user remains, it's harmless (no profile = can't login)

      Taro.showToast({title: '用户已删除', icon: 'success'})
      loadUsers()
    } catch (error: unknown) {
      console.error('删除用户失败:', error)
      const msg = (error as Error)?.message || '请稍后重试'
      Taro.showModal({title: '删除失败', content: msg, showCancel: false, confirmText: '知道了'})
    } finally {
      Taro.hideLoading()
    }
  }

  const getRoleLabel = (role: string) => {
    return RoleDisplayNames[role as keyof typeof RoleDisplayNames] || role
  }

  /**
   * 数据一致性检查
   */
  const handleCheckConsistency = async () => {
    try {
      setChecking(true)
      setCheckResult(null)

      const {data, error} = await supabase.functions.invoke('check-data-consistency', {
        body: {
          action: 'check',
          operator_id: profile?.id,
          operator_name: profile?.name
        }
      })

      if (error) {
        const errorMsg = await error?.context?.text?.()
        throw new Error(errorMsg || error.message)
      }

      if (!data.success) {
        throw new Error(data.error || '检查失败')
      }

      setCheckResult(data)

      // 显示检查结果摘要
      const totalIssues = data.orphan_auth_count + data.orphan_profile_count
      if (totalIssues === 0) {
        Taro.showToast({
          title: '数据一致性正常',
          icon: 'success'
        })
      } else {
        Taro.showToast({
          title: `发现${totalIssues}条不一致数据`,
          icon: 'none'
        })
      }
    } catch (error) {
      console.error('数据一致性检查失败:', error)
      Taro.showToast({
        title: (error as Error).message || '检查失败',
        icon: 'none'
      })
    } finally {
      setChecking(false)
    }
  }

  /**
   * 一键修复
   */
  const handleFixConsistency = async () => {
    if (!checkResult) {
      Taro.showToast({
        title: '请先执行检查',
        icon: 'none'
      })
      return
    }

    const totalIssues = checkResult.orphan_auth_count + checkResult.orphan_profile_count
    if (totalIssues === 0) {
      Taro.showToast({
        title: '无需修复',
        icon: 'none'
      })
      return
    }

    const res = await Taro.showModal({
      title: '确认修复',
      content: `将删除${checkResult.orphan_auth_count}个孤儿Auth用户和${checkResult.orphan_profile_count}个孤儿Profile记录，此操作不可恢复，是否继续？`,
      confirmText: '确认修复',
      confirmColor: '#ef4444'
    })

    if (!res.confirm) return

    try {
      setFixing(true)

      const {data, error} = await supabase.functions.invoke('check-data-consistency', {
        body: {
          action: 'fix',
          operator_id: profile?.id,
          operator_name: profile?.name
        }
      })

      if (error) {
        const errorMsg = await error?.context?.text?.()
        throw new Error(errorMsg || error.message)
      }

      if (!data.success) {
        throw new Error(data.error || '修复失败')
      }

      const fixResult = data.fix_result
      const totalFixed = fixResult.auth_cleaned + fixResult.profile_cleaned
      const totalErrors = fixResult.auth_errors.length + fixResult.profile_errors.length

      if (totalErrors === 0) {
        Taro.showToast({
          title: `成功修复${totalFixed}条数据`,
          icon: 'success'
        })
      } else {
        Taro.showToast({
          title: `修复${totalFixed}条，失败${totalErrors}条`,
          icon: 'none'
        })
      }

      // 清空检查结果，提示重新检查
      setCheckResult(null)

      // 刷新用户列表
      loadUsers()
    } catch (error) {
      console.error('修复失败:', error)
      Taro.showToast({
        title: (error as Error).message || '修复失败',
        icon: 'none'
      })
    } finally {
      setFixing(false)
    }
  }

  /**
   * 查看清理历史
   */
  const handleViewCleanupHistory = () => {
    Taro.navigateTo({url: '/pages/system/cleanup-history/index'})
  }

  // 检查权限
  if (!profile || (profile.role !== 'system_admin' && profile.role !== 'super_admin')) {
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
        <div className="text-3xl text-primary-foreground font-bold mb-2">用户管理</div>
        <div className="text-base text-primary-foreground/80">管理系统用户账号</div>
      </div>
      {/* 筛选标签 */}

      {/* 添加用户按钮 */}
      <div className="px-6 py-4 flex gap-3">
        <button
          type="button"
          onClick={handleAddUser}
          className="flex-1 py-4 bg-primary text-primary-foreground text-xl rounded flex items-center justify-center leading-none gap-2">
          <div className="i-mdi-plus text-2xl" />
          <span>添加用户</span>
        </button>
        <button
          type="button"
          onClick={() => Taro.navigateTo({url: '/pages/system/users/import/index'})}
          className="flex-1 py-4 bg-card border-2 border-primary text-primary text-xl rounded flex items-center justify-center leading-none gap-2">
          <div className="i-mdi-file-upload text-2xl" />
          <span>批量导入</span>
        </button>
      </div>

      {/* 数据一致性检查模块 */}
      <div className="px-6 pb-4">
        <div className="bg-card rounded-lg p-4 border border-border">
          {/* 标题 */}
          <div className="flex items-center gap-2 mb-3">
            <div className="i-mdi-database-check text-2xl text-primary" />
            <div className="text-xl text-foreground font-bold">数据一致性检查</div>
          </div>

          {/* 说明 */}
          <div className="text-base text-muted-foreground mb-4">
            检查auth.users和profiles表的数据一致性，识别并修复孤儿数据
          </div>

          {/* 操作按钮 */}
          <div className="flex gap-3 mb-4">
            <button
              type="button"
              onClick={handleCheckConsistency}
              disabled={checking}
              className="flex-1 py-3 bg-primary text-primary-foreground text-base rounded flex items-center justify-center leading-none gap-2 disabled:opacity-50">
              <div className={`i-mdi-${checking ? 'loading' : 'magnify'} text-xl ${checking ? 'animate-spin' : ''}`} />
              <span>{checking ? '检查中...' : '立即检查'}</span>
            </button>
            <button
              type="button"
              onClick={handleViewCleanupHistory}
              className="flex-1 py-3 bg-card border-2 border-primary text-primary text-base rounded flex items-center justify-center leading-none gap-2">
              <div className="i-mdi-history text-xl" />
              <span>清理历史</span>
            </button>
          </div>

          {/* 检查结果 */}
          {checkResult && (
            <div className="border-t border-border pt-4">
              {/* 统计摘要 */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-red-50 rounded-lg p-3">
                  <div className="text-sm text-muted-foreground mb-1">孤儿Auth用户</div>
                  <div className="text-2xl text-red-600 font-bold">{checkResult.orphan_auth_count}</div>
                </div>
                <div className="bg-yellow-50 rounded-lg p-3">
                  <div className="text-sm text-muted-foreground mb-1">孤儿Profile记录</div>
                  <div className="text-2xl text-yellow-600 font-bold">{checkResult.orphan_profile_count}</div>
                </div>
              </div>

              {/* 孤儿Auth用户列表 */}
              {checkResult.orphan_auth_count > 0 && (
                <div className="mb-4">
                  <div className="text-base text-foreground font-bold mb-2">孤儿Auth用户列表</div>
                  <div className="bg-muted rounded-lg p-3 max-h-40 overflow-y-auto">
                    {checkResult.orphan_auth_users.map((user) => (
                      <div key={user.id} className="text-sm text-muted-foreground mb-1">
                        {user.phone || user.email || user.id}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 孤儿Profile记录列表 */}
              {checkResult.orphan_profile_count > 0 && (
                <div className="mb-4">
                  <div className="text-base text-foreground font-bold mb-2">孤儿Profile记录列表</div>
                  <div className="bg-muted rounded-lg p-3 max-h-40 overflow-y-auto">
                    {checkResult.orphan_profiles.map((profile) => (
                      <div key={profile.id} className="text-sm text-muted-foreground mb-1">
                        {profile.name} ({profile.phone})
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 修复按钮 */}
              {(checkResult.orphan_auth_count > 0 || checkResult.orphan_profile_count > 0) && (
                <button
                  type="button"
                  onClick={handleFixConsistency}
                  disabled={fixing}
                  className="w-full py-3 bg-destructive text-destructive-foreground text-base rounded flex items-center justify-center leading-none gap-2 disabled:opacity-50">
                  <div className={`i-mdi-${fixing ? 'loading' : 'auto-fix'} text-xl ${fixing ? 'animate-spin' : ''}`} />
                  <span>{fixing ? '修复中...' : '一键修复'}</span>
                </button>
              )}

              {/* 无问题提示 */}
              {checkResult.orphan_auth_count === 0 && checkResult.orphan_profile_count === 0 && (
                <div className="text-center py-4">
                  <div className="i-mdi-check-circle text-4xl text-green-600 mb-2" />
                  <div className="text-base text-green-600">数据一致性正常</div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 用户列表 */}
      <div className="px-6 pb-6">
        {loading ? (
          <div className="text-center py-12">
            <div className="text-base text-muted-foreground">加载中...</div>
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-12">
            <div className="i-mdi-account-off text-6xl text-muted-foreground mb-4" />
            <div className="text-base text-muted-foreground">暂无用户</div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {users.map((user) => (
              <div key={user.id} className="bg-card rounded-lg p-4 border border-border">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="text-xl text-foreground font-bold mb-1">{user.name}</div>
                    <div className="text-base text-muted-foreground">{maskPhone(user.phone)}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        Taro.navigateTo({url: `/pages/system/users/edit/index?id=${user.id}`})
                      }}
                      className="px-3 py-1 bg-primary/10 text-primary text-base rounded flex items-center justify-center leading-none">
                      <div className="i-mdi-pencil text-xl mr-1" />
                      修改
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDeleteUser(user.id, user.name)
                      }}
                      className="px-3 py-1 bg-destructive/10 text-destructive text-base rounded flex items-center justify-center leading-none">
                      <div className="i-mdi-delete text-xl mr-1" />
                      删除
                    </button>
                  </div>
                </div>
                <div
                  onClick={() => handleViewUser(user.id)}
                  className="flex items-center gap-4 text-base text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <div className="i-mdi-shield-account text-xl" />
                    <span>{getRoleLabel(user.role)}</span>
                  </div>
                  {user.department && (
                    <div className="flex items-center gap-1">
                      <div className="i-mdi-office-building text-xl" />
                      <span>{user.department}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default withRouteGuard(UserManagement)
