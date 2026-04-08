import {useState, useCallback, useEffect, useMemo} from 'react'
import Taro from '@tarojs/taro'
import {withRouteGuard} from '@/components/RouteGuard'
import {supabase} from '@/client/supabase'
import type {UserRole, Profile, Team} from '@/db/types'
import {RoleDisplayNames} from '@/db/types'

function EditUser() {
  const userId = useMemo(() => Taro.getCurrentInstance().router?.params?.id || '', [])
  const [user, setUser] = useState<Profile | null>(null)
  const [name, setName] = useState('')
  const [role, setRole] = useState<UserRole>('market_staff')
  const [department, setDepartment] = useState('')
  const [selectedTeams, setSelectedTeams] = useState<string[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showTeamSelector, setShowTeamSelector] = useState(false)

  const loadData = useCallback(async () => {
    if (!userId) return

    try {
      setLoading(true)

      // 加载用户信息
      const {data: userData, error: userError} = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (userError) throw userError

      setUser(userData)
      setName(userData.name)
      setRole(userData.role)
      setDepartment(userData.department || '')

      // 加载所有小组
      const {data: teamsData} = await supabase.from('teams').select('*').order('display_order')

      setTeams(Array.isArray(teamsData) ? teamsData : [])

      // 加载用户所属小组
      const {data: userTeamsData} = await supabase
        .from('user_teams')
        .select('team_id')
        .eq('user_id', userId)

      if (userTeamsData) {
        setSelectedTeams(userTeamsData.map((ut) => ut.team_id))
      }
    } catch (error) {
      console.error('加载用户信息失败:', error)
      Taro.showToast({title: '加载失败', icon: 'none'})
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleSubmit = async () => {
    if (!name) {
      Taro.showToast({title: '请输入姓名', icon: 'none'})
      return
    }

    setSaving(true)
    try {
      // 1. 更新用户基本信息
      const {error: updateError} = await supabase
        .from('profiles')
        .update({
          name,
          role,
          department: department || null
        })
        .eq('id', userId)

      if (updateError) throw updateError

      // 2. 更新用户小组关联
      // 先删除所有现有关联
      await supabase.from('user_teams').delete().eq('user_id', userId)

      // 再添加新的关联
      if (selectedTeams.length > 0) {
        const userTeamsData = selectedTeams.map((teamId) => ({
          user_id: userId,
          team_id: teamId
        }))

        const {error: teamError} = await supabase.from('user_teams').insert(userTeamsData)

        if (teamError) {
          console.error('更新用户小组失败:', teamError)
        }
      }

      Taro.showToast({title: '修改成功', icon: 'success'})
      setTimeout(() => {
        Taro.navigateBack()
      }, 1500)
    } catch (error) {
      console.error('修改用户失败:', error)
      Taro.showToast({title: '修改失败', icon: 'none'})
    } finally {
      setSaving(false)
    }
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
          <div className="text-xl text-foreground font-bold mb-2">用户不存在</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background pb-6">
      {/* 页面标题 */}
      <div className="px-6 py-6 bg-gradient-primary">
        <div className="text-3xl text-primary-foreground font-bold mb-2">修改用户</div>
        <div className="text-xl text-primary-foreground/80">编辑用户基本信息</div>
      </div>

      {/* 表单 */}
      <div className="px-6 mt-4">
        <div className="bg-card rounded p-5 border border-border flex flex-col gap-4">
          {/* 手机号（只读） */}
          <div>
            <div className="text-xl text-foreground mb-2">手机号</div>
            <div className="border-2 border-input rounded px-4 py-3 bg-muted">
              <div className="text-xl text-muted-foreground">{user.phone}</div>
            </div>
            <div className="text-sm text-muted-foreground mt-1">手机号不可修改</div>
          </div>

          {/* 姓名 */}
          <div>
            <div className="text-xl text-foreground mb-2">姓名</div>
            <div className="border-2 border-input rounded px-4 py-3 bg-card overflow-hidden">
              <input
                type="text"
                value={name}
                onInput={(e) => {
                  const ev = e as unknown
                  setName(
                    (ev as {detail?: {value?: string}}).detail?.value ??
                      (ev as {target?: {value?: string}}).target?.value ??
                      ''
                  )
                }}
                placeholder="请输入姓名"
                className="w-full text-xl text-foreground bg-transparent outline-none"
              />
            </div>
          </div>

          {/* 角色 */}
          <div>
            <div className="text-xl text-foreground mb-2">角色</div>
            <div className="border-2 border-input rounded px-4 py-3 bg-card overflow-hidden">
              <select
                value={role}
                onChange={(e) => {
                  const ev = e as unknown
                  setRole(
                    ((ev as {detail?: {value?: string}}).detail?.value ??
                      (ev as {target?: {value?: string}}).target?.value ??
                      'market_staff') as UserRole
                  )
                }}
                className="w-full text-xl text-foreground bg-transparent outline-none">
                {Object.entries(RoleDisplayNames).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 部门 */}
          <div>
            <div className="text-xl text-foreground mb-2">部门</div>
            <div className="border-2 border-input rounded px-4 py-3 bg-card overflow-hidden">
              <input
                type="text"
                value={department}
                onInput={(e) => {
                  const ev = e as unknown
                  setDepartment(
                    (ev as {detail?: {value?: string}}).detail?.value ??
                      (ev as {target?: {value?: string}}).target?.value ??
                      ''
                  )
                }}
                placeholder="请输入部门"
                className="w-full text-xl text-foreground bg-transparent outline-none"
              />
            </div>
          </div>

          {/* 小组选择 */}
          <div>
            <div className="text-xl text-foreground mb-2">所属小组（可多选）</div>
            <button
              type="button"
              onClick={() => setShowTeamSelector(true)}
              className="w-full border-2 border-input rounded px-4 py-3 bg-card text-left flex items-center justify-between">
              <span className="text-xl text-foreground">
                {selectedTeams.length > 0
                  ? `已选择 ${selectedTeams.length} 个小组`
                  : '点击选择小组'}
              </span>
              <div className="i-mdi-chevron-down text-2xl text-muted-foreground" />
            </button>
            {selectedTeams.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {selectedTeams.map((teamId) => {
                  const team = teams.find((t) => t.id === teamId)
                  return team ? (
                    <div
                      key={teamId}
                      className="px-3 py-1 bg-primary/10 text-primary rounded-full text-base flex items-center gap-2">
                      {team.name}
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedTeams((prev) => prev.filter((id) => id !== teamId))
                        }
                        className="i-mdi-close text-base"
                      />
                    </div>
                  ) : null
                })}
              </div>
            )}
          </div>

          {/* 提交按钮 */}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className={`w-full py-4 bg-primary text-primary-foreground text-xl rounded flex items-center justify-center leading-none ${
              saving ? 'opacity-50' : ''
            }`}>
            {saving ? '保存中...' : '保存修改'}
          </button>
        </div>
      </div>

      {/* 小组选择对话框 */}
      {showTeamSelector && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-6">
          <div className="bg-card rounded p-6 w-full max-w-md max-h-[80vh] flex flex-col">
            <div className="text-xl text-foreground font-bold mb-4">选择小组</div>

            <div className="flex-1 overflow-y-auto mb-4">
              {teams.map((team) => (
                <div
                  key={team.id}
                  onClick={() => {
                    setSelectedTeams((prev) =>
                      prev.includes(team.id)
                        ? prev.filter((id) => id !== team.id)
                        : [...prev, team.id]
                    )
                  }}
                  className="flex items-center gap-3 p-3 mb-2 bg-muted/30 rounded">
                  <div
                    className={`w-6 h-6 rounded border-2 flex items-center justify-center ${
                      selectedTeams.includes(team.id)
                        ? 'bg-primary border-primary'
                        : 'border-input'
                    }`}>
                    {selectedTeams.includes(team.id) && (
                      <div className="i-mdi-check text-base text-primary-foreground" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="text-xl text-foreground font-bold">{team.name}</div>
                    {team.description && (
                      <div className="text-sm text-muted-foreground">{team.description}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="text-base text-muted-foreground mb-3">
              已选择 {selectedTeams.length} 个小组
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowTeamSelector(false)}
                className="flex-1 py-3 bg-card border-2 border-border text-foreground text-xl rounded flex items-center justify-center leading-none">
                取消
              </button>
              <button
                type="button"
                onClick={() => setShowTeamSelector(false)}
                className="flex-1 py-3 bg-primary text-primary-foreground text-xl rounded flex items-center justify-center leading-none">
                确定
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default withRouteGuard(EditUser)
