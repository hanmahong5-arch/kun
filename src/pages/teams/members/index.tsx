import {useState, useCallback, useEffect} from 'react'
import {isAdmin, isLeaderOrAdmin} from '@/db/permissions-utils'
import Taro, {useDidShow} from '@tarojs/taro'
import {withRouteGuard} from '@/components/RouteGuard'
import {useAuth} from '@/contexts/AuthContext'
import {supabase} from '@/client/supabase'
import type {Team, Profile} from '@/db/types'

interface TeamWithMembers extends Team {
  members: Profile[]
}

function TeamMembers() {
  const {profile} = useAuth()
  const [teams, setTeams] = useState<TeamWithMembers[]>([])
  const [allUsers, setAllUsers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null)
  const [selectedUsers, setSelectedUsers] = useState<string[]>([])

  const hasAdminAccess = isAdmin(profile)

  const loadData = useCallback(async () => {
    try {
      setLoading(true)

      // 加载所有小组
      const {data: teamsData, error: teamsError} = await supabase
        .from('teams')
        .select('*')
        .order('display_order')

      if (teamsError) throw teamsError

      if (!teamsData || teamsData.length === 0) {
        setTeams([])
        return
      }

      // 加载所有用户
      const {data: usersData, error: usersError} = await supabase
        .from('profiles')
        .select('*')
        .eq('status', 'approved')
        .order('name')

      if (usersError) throw usersError

      setAllUsers(Array.isArray(usersData) ? usersData : [])

      // 加载用户小组关联
      const {data: userTeamsData, error: userTeamsError} = await supabase
        .from('user_teams')
        .select('user_id, team_id')

      if (userTeamsError) throw userTeamsError

      // 组装数据
      const teamsWithMembers: TeamWithMembers[] = teamsData.map((team) => {
        const memberIds =
          userTeamsData?.filter((ut) => ut.team_id === team.id).map((ut) => ut.user_id) || []
        const members = usersData?.filter((u) => memberIds.includes(u.id)) || []
        return {...team, members}
      })

      setTeams(teamsWithMembers)
    } catch (error) {
      console.error('加载数据失败:', error)
      Taro.showToast({title: '加载失败', icon: 'none'})
    } finally {
      setLoading(false)
    }
  }, [])

  useDidShow(() => {
    loadData()
  })

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleAddMembers = (team: Team) => {
    setSelectedTeam(team)
    setSelectedUsers([])
    setShowAddDialog(true)
  }

  const toggleUserSelection = (userId: string) => {
    setSelectedUsers((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    )
  }

  const handleConfirmAdd = async () => {
    if (!selectedTeam || selectedUsers.length === 0) {
      Taro.showToast({title: '请选择用户', icon: 'none'})
      return
    }

    try {
      setLoading(true)

      // 批量添加用户到小组
      const insertData = selectedUsers.map((userId) => ({
        user_id: userId,
        team_id: selectedTeam.id
      }))

      const {error} = await supabase.from('user_teams').insert(insertData)

      if (error) throw error

      Taro.showToast({title: '添加成功', icon: 'success'})
      setShowAddDialog(false)
      loadData()
    } catch (error) {
      console.error('添加成员失败:', error)
      Taro.showToast({title: '添加失败', icon: 'none'})
    } finally {
      setLoading(false)
    }
  }

  const handleRemoveMember = async (teamId: string, userId: string, userName: string) => {
    const result = await Taro.showModal({
      title: '确认移除',
      content: `确定要将"${userName}"从小组中移除吗？`,
      confirmText: '移除',
      cancelText: '取消'
    })

    if (!result.confirm) return

    try {
      setLoading(true)

      const {error} = await supabase
        .from('user_teams')
        .delete()
        .eq('team_id', teamId)
        .eq('user_id', userId)

      if (error) throw error

      Taro.showToast({title: '移除成功', icon: 'success'})
      loadData()
    } catch (error) {
      console.error('移除成员失败:', error)
      Taro.showToast({title: '移除失败', icon: 'none'})
    } finally {
      setLoading(false)
    }
  }

  if (!hasAdminAccess) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6">
        <div className="text-center">
          <div className="i-mdi-lock text-6xl text-muted-foreground mb-4" />
          <div className="text-xl text-foreground font-bold mb-2">无权限访问</div>
          <div className="text-base text-muted-foreground">仅管理员可管理小组成员</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background pb-6">
      {/* 页面标题 */}
      <div className="px-6 py-6 bg-gradient-primary">
        <div className="text-2xl text-primary-foreground font-bold mb-2">小组成员管理</div>
        <div className="text-xl text-primary-foreground/80">管理各小组的成员分配</div>
      </div>

      {/* 小组列表 */}
      <div className="px-6 mt-4">
        {loading ? (
          <div className="text-center py-8">
            <div className="text-base text-muted-foreground">加载中...</div>
          </div>
        ) : teams.length === 0 ? (
          <div className="bg-card rounded p-8 text-center border border-border">
            <div className="i-mdi-account-group text-6xl text-muted-foreground mb-2" />
            <div className="text-base text-muted-foreground">暂无小组</div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {teams.map((team) => (
              <div key={team.id} className="bg-card rounded p-4 border border-border">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="text-xl text-foreground font-bold mb-1">{team.name}</div>
                    {team.description && (
                      <div className="text-sm text-muted-foreground mb-2">{team.description}</div>
                    )}
                    <div className="text-base text-muted-foreground">
                      成员数量：{team.members.length} 人
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleAddMembers(team)}
                    className="ml-3 px-4 py-2 bg-primary text-primary-foreground text-base rounded flex items-center justify-center leading-none">
                    <div className="i-mdi-account-plus text-xl mr-1" />
                    添加成员
                  </button>
                </div>

                {/* 成员列表 */}
                {team.members.length > 0 ? (
                  <div className="flex flex-col gap-2">
                    {team.members.map((member) => (
                      <div
                        key={member.id}
                        className="flex items-center justify-between p-3 bg-muted/30 rounded">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                            <div className="i-mdi-account text-2xl text-primary" />
                          </div>
                          <div>
                            <div className="text-xl text-foreground font-bold">{member.name}</div>
                            <div className="text-sm text-muted-foreground">
                              {member.department || '未设置部门'}
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveMember(team.id, member.id, member.name)}
                          className="px-3 py-2 bg-destructive/10 text-destructive text-base rounded flex items-center justify-center leading-none">
                          <div className="i-mdi-account-remove text-xl mr-1" />
                          移除
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-4 bg-muted/30 rounded">
                    <div className="text-base text-muted-foreground">暂无成员</div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 添加成员对话框 */}
      {showAddDialog && selectedTeam && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-6">
          <div className="bg-card rounded p-6 w-full max-w-md max-h-[80vh] flex flex-col">
            <div className="text-xl text-foreground font-bold mb-4">
              添加成员到 {selectedTeam.name}
            </div>

            <div className="flex-1 overflow-y-auto mb-4">
              {allUsers
                .filter(
                  (user) =>
                    !teams
                      .find((t) => t.id === selectedTeam.id)
                      ?.members.some((m) => m.id === user.id)
                )
                .map((user) => (
                  <div
                    key={user.id}
                    onClick={() => toggleUserSelection(user.id)}
                    className="flex items-center gap-3 p-3 mb-2 bg-muted/30 rounded">
                    <div
                      className={`w-6 h-6 rounded border-2 flex items-center justify-center ${
                        selectedUsers.includes(user.id)
                          ? 'bg-primary border-primary'
                          : 'border-input'
                      }`}>
                      {selectedUsers.includes(user.id) && (
                        <div className="i-mdi-check text-base text-primary-foreground" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="text-xl text-foreground font-bold">{user.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {user.department || '未设置部门'}
                      </div>
                    </div>
                  </div>
                ))}
            </div>

            <div className="text-base text-muted-foreground mb-3">
              已选择 {selectedUsers.length} 人
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowAddDialog(false)}
                className="flex-1 py-3 bg-card border-2 border-border text-foreground text-xl rounded flex items-center justify-center leading-none">
                取消
              </button>
              <button
                type="button"
                onClick={handleConfirmAdd}
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

export default withRouteGuard(TeamMembers)
