import {useState, useCallback, useEffect} from 'react'
import {isAdmin, isLeaderOrAdmin} from '@/db/permissions-utils'
import Taro, {useDidShow} from '@tarojs/taro'
import {withRouteGuard} from '@/components/RouteGuard'
import {useAuth} from '@/contexts/AuthContext'
import {supabase} from '@/client/supabase'
import type {Team} from '@/db/types'

interface Profile {
  id: string
  name: string
  department: string | null
  position: string | null
}

function TeamManagement() {
  const {profile} = useAuth()
  const [teams, setTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState(true)
  const [showDialog, setShowDialog] = useState(false)
  const [editingTeam, setEditingTeam] = useState<Team | null>(null)
  const [teamName, setTeamName] = useState('')
  const [teamDescription, setTeamDescription] = useState('')
  const [contractTarget, setContractTarget] = useState('')
  const [contractCompleted, setContractCompleted] = useState('')
  
  // 用户选择相关状态
  const [allUsers, setAllUsers] = useState<Profile[]>([])
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([])
  const [showUserSelector, setShowUserSelector] = useState(false)

  const hasAdminAccess = isAdmin(profile)

  const loadData = useCallback(async () => {
    try {
      setLoading(true)

      const {data, error} = await supabase
        .from('teams')
        .select('*')
        .order('display_order')

      if (error) throw error

      setTeams(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('加载小组失败:', error)
      Taro.showToast({title: '加载失败', icon: 'none'})
    } finally {
      setLoading(false)
    }
  }, [])

  // 加载所有用户
  const loadUsers = useCallback(async () => {
    try {
      const {data, error} = await supabase
        .from('profiles')
        .select('id, name, department, position')
        .eq('status', 'approved')
        .order('name')

      if (error) throw error

      setAllUsers(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('加载用户失败:', error)
    }
  }, [])

  useDidShow(() => {
    loadData()
  })

  useEffect(() => {
    loadData()
    loadUsers()
  }, [loadData, loadUsers])

  const handleCreate = () => {
    setEditingTeam(null)
    setTeamName('')
    setTeamDescription('')
    setContractTarget('')
    setContractCompleted('')
    setSelectedUserIds([])
    setShowDialog(true)
  }

  const handleEdit = async (team: Team) => {
    setEditingTeam(team)
    setTeamName(team.name)
    setTeamDescription(team.description || '')
    setContractTarget(team.contract_target?.toString() || '0')
    setContractCompleted(team.contract_completed?.toString() || '0')
    
    // 加载该小组的成员
    try {
      const {data, error} = await supabase
        .from('user_teams')
        .select('user_id')
        .eq('team_id', team.id)
      
      if (error) throw error
      
      setSelectedUserIds(Array.isArray(data) ? data.map(ut => ut.user_id) : [])
    } catch (error) {
      console.error('加载小组成员失败:', error)
      setSelectedUserIds([])
    }
    
    setShowDialog(true)
  }

  const handleSave = async () => {
    if (!teamName.trim()) {
      Taro.showToast({title: '请填写小组名称', icon: 'none'})
      return
    }

    try {
      setLoading(true)

      const targetValue = parseFloat(contractTarget) || 0
      const completedValue = parseFloat(contractCompleted) || 0

      let teamId: string

      if (editingTeam) {
        // 更新小组
        const {error} = await supabase
          .from('teams')
          .update({
            name: teamName,
            description: teamDescription || null,
            contract_target: targetValue,
            contract_completed: completedValue,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingTeam.id)

        if (error) throw error
        
        teamId = editingTeam.id
        
        // 删除原有成员关联
        await supabase
          .from('user_teams')
          .delete()
          .eq('team_id', teamId)
      } else {
        // 创建小组
        const maxOrder = teams.length > 0 ? Math.max(...teams.map((t) => t.display_order)) : 0

        const {data: newTeam, error} = await supabase
          .from('teams')
          .insert({
            name: teamName,
            description: teamDescription || null,
            contract_target: targetValue,
            contract_completed: completedValue,
            display_order: maxOrder + 1,
            created_by: profile?.id
          })
          .select()
          .single()

        if (error) throw error
        if (!newTeam) throw new Error('创建小组失败')

        teamId = newTeam.id

        // 为新小组创建当前年度目标
        const currentYear = new Date().getFullYear()
        await supabase.from('team_goals').insert({
          team_id: teamId,
          year: currentYear,
          goal_content: '待设置年度目标',
          progress: 0,
          created_by: profile?.id
        })
      }

      // 添加新的成员关联
      if (selectedUserIds.length > 0) {
        const userTeamRecords = selectedUserIds.map(userId => ({
          team_id: teamId,
          user_id: userId
        }))
        
        const {error: userTeamError} = await supabase
          .from('user_teams')
          .insert(userTeamRecords)
        
        if (userTeamError) throw userTeamError
      }

      Taro.showToast({title: '保存成功', icon: 'success'})
      setShowDialog(false)
      loadData()
    } catch (error) {
      console.error('保存失败:', error)
      Taro.showToast({title: '保存失败', icon: 'none'})
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (team: Team) => {
    const result = await Taro.showModal({
      title: '确认删除',
      content: `确定要删除小组"${team.name}"吗？这将同时删除该小组的所有目标数据和成员关联。`,
      confirmText: '删除',
      cancelText: '取消'
    })

    if (!result.confirm) return

    try {
      setLoading(true)

      const {error} = await supabase.from('teams').delete().eq('id', team.id)

      if (error) throw error

      Taro.showToast({title: '删除成功', icon: 'success'})
      loadData()
    } catch (error) {
      console.error('删除失败:', error)
      Taro.showToast({title: '删除失败', icon: 'none'})
    } finally {
      setLoading(false)
    }
  }

  // 切换用户选择
  const toggleUserSelection = (userId: string) => {
    setSelectedUserIds(prev => {
      if (prev.includes(userId)) {
        return prev.filter(id => id !== userId)
      } else {
        return [...prev, userId]
      }
    })
  }

  // 打开用户选择器
  const handleOpenUserSelector = () => {
    setShowUserSelector(true)
  }

  // 关闭用户选择器
  const handleCloseUserSelector = () => {
    setShowUserSelector(false)
  }

  const handleMoveUp = async (team: Team, index: number) => {
    if (index === 0) return

    const prevTeam = teams[index - 1]

    try {
      setLoading(true)

      // 交换display_order
      await supabase.from('teams').update({display_order: prevTeam.display_order}).eq('id', team.id)

      await supabase.from('teams').update({display_order: team.display_order}).eq('id', prevTeam.id)

      loadData()
    } catch (error) {
      console.error('移动失败:', error)
      Taro.showToast({title: '移动失败', icon: 'none'})
    } finally {
      setLoading(false)
    }
  }

  const handleMoveDown = async (team: Team, index: number) => {
    if (index === teams.length - 1) return

    const nextTeam = teams[index + 1]

    try {
      setLoading(true)

      // 交换display_order
      await supabase.from('teams').update({display_order: nextTeam.display_order}).eq('id', team.id)

      await supabase.from('teams').update({display_order: team.display_order}).eq('id', nextTeam.id)

      loadData()
    } catch (error) {
      console.error('移动失败:', error)
      Taro.showToast({title: '移动失败', icon: 'none'})
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
          <div className="text-base text-muted-foreground">仅管理员可管理小组</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background pb-6">
      {/* 页面标题 */}
      <div className="px-6 py-6 bg-gradient-primary">
        <div className="text-2xl text-primary-foreground font-bold mb-2">小组管理</div>
        <div className="text-xl text-primary-foreground/80">管理小组信息和排序</div>
      </div>

      {/* 快捷入口 */}
      <div className="px-6 mt-4">
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => Taro.navigateTo({url: '/pages/teams/members/index'})}
            className="py-4 bg-card border-2 border-primary text-primary text-xl rounded flex items-center justify-center leading-none">
            <div className="i-mdi-account-group text-2xl mr-2" />
            成员管理
          </button>
          <button
            type="button"
            onClick={() => Taro.navigateTo({url: '/pages/teams/analytics/index'})}
            className="py-4 bg-card border-2 border-primary text-primary text-xl rounded flex items-center justify-center leading-none">
            <div className="i-mdi-chart-line text-2xl mr-2" />
            统计分析
          </button>
        </div>
      </div>

      {/* 创建按钮 */}
      <div className="px-6 mt-4">
        <button
          type="button"
          onClick={handleCreate}
          className="w-full py-4 bg-primary text-primary-foreground text-xl rounded flex items-center justify-center leading-none">
          <div className="i-mdi-plus-circle text-2xl mr-2" />
          创建小组
        </button>
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
          <div className="flex flex-col gap-3">
            {teams.map((team, index) => {
              const target = team.contract_target || 0
              const completed = team.contract_completed || 0
              const percentage = target > 0 ? Math.round((completed / target) * 100) : 0

              return (
                <div key={team.id} className="bg-card rounded p-4 border border-border">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="text-xl text-foreground font-bold mb-1">{team.name}</div>
                      {team.description && (
                        <div className="text-base text-muted-foreground mb-2">
                          {team.description}
                        </div>
                      )}

                      {/* 合同额信息 */}
                      <div className="mt-3 p-3 bg-muted/30 rounded">
                        <div className="flex items-center justify-between mb-2">
                          <div className="text-base text-muted-foreground">合同额完成情况</div>
                          <div className="text-xl text-primary font-bold">{percentage}%</div>
                        </div>

                        {/* 进度条 */}
                        <div className="w-full h-3 bg-muted rounded-full overflow-hidden mb-2">
                          <div
                            className="h-full bg-gradient-primary transition-all duration-300"
                            style={{width: `${Math.min(percentage, 100)}%`}}
                          />
                        </div>

                        <div className="flex items-center justify-between text-sm">
                          <div className="text-muted-foreground">
                            已完成: <span className="text-foreground font-bold">{completed}</span>{' '}
                            万元
                          </div>
                          <div className="text-muted-foreground">
                            目标: <span className="text-foreground font-bold">{target}</span> 万元
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 ml-3">
                      <button
                        type="button"
                        onClick={() => handleMoveUp(team, index)}
                        disabled={index === 0}
                        className="p-2 bg-card border-2 border-border text-foreground rounded flex items-center justify-center leading-none disabled:opacity-30">
                        <div className="i-mdi-arrow-up text-2xl" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveDown(team, index)}
                        disabled={index === teams.length - 1}
                        className="p-2 bg-card border-2 border-border text-foreground rounded flex items-center justify-center leading-none disabled:opacity-30">
                        <div className="i-mdi-arrow-down text-2xl" />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleEdit(team)}
                      className="flex-1 py-3 bg-card border-2 border-primary text-primary text-xl rounded flex items-center justify-center leading-none">
                      <div className="i-mdi-pencil text-2xl mr-2" />
                      编辑
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(team)}
                      className="flex-1 py-3 bg-destructive text-destructive-foreground text-xl rounded flex items-center justify-center leading-none">
                      <div className="i-mdi-delete text-2xl mr-2" />
                      删除
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 编辑对话框 */}
      {showDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-6">
          <div className="bg-card rounded p-6 w-full max-w-md">
            <div className="text-xl text-foreground font-bold mb-4">
              {editingTeam ? '编辑小组' : '创建小组'}
            </div>

            <div className="mb-4">
              <div className="flex items-center gap-1 mb-2">
                <div className="text-xl text-foreground font-bold">小组名称</div>
                <span className="text-destructive text-xl">*</span>
              </div>
              <div className="border-2 border-input rounded px-4 py-3 bg-background overflow-hidden">
                <input
                  type="text"
                  value={teamName}
                  onInput={(e) => {
                    const ev = e as unknown
                    setTeamName(
                      (ev as {detail?: {value?: string}}).detail?.value ??
                        (ev as {target?: {value?: string}}).target?.value ??
                        ''
                    )
                  }}
                  placeholder="请输入小组名称"
                  className="w-full text-xl text-foreground bg-transparent outline-none"
                />
              </div>
            </div>

            <div className="mb-4">
              <div className="text-xl text-foreground font-bold mb-2">小组描述</div>
              <div className="border-2 border-input rounded px-4 py-3 bg-background overflow-hidden">
                <textarea
                  value={teamDescription}
                  onInput={(e) => {
                    const ev = e as unknown
                    setTeamDescription(
                      (ev as {detail?: {value?: string}}).detail?.value ??
                        (ev as {target?: {value?: string}}).target?.value ??
                        ''
                    )
                  }}
                  placeholder="请输入小组描述（可选）"
                  className="w-full text-xl text-foreground bg-transparent outline-none"
                  style={{minHeight: '100px'}}
                />
              </div>
            </div>

            <div className="mb-4">
              <div className="text-xl text-foreground font-bold mb-2">合同额目标（万元）</div>
              <div className="border-2 border-input rounded px-4 py-3 bg-background overflow-hidden">
                <input
                  type="number"
                  value={contractTarget}
                  onInput={(e) => {
                    const ev = e as unknown
                    setContractTarget(
                      (ev as {detail?: {value?: string}}).detail?.value ??
                        (ev as {target?: {value?: string}}).target?.value ??
                        ''
                    )
                  }}
                  placeholder="请输入合同额目标"
                  className="w-full text-xl text-foreground bg-transparent outline-none"
                />
              </div>
            </div>

            <div className="mb-4">
              <div className="text-xl text-foreground font-bold mb-2">已完成合同额（万元）</div>
              <div className="border-2 border-input rounded px-4 py-3 bg-background overflow-hidden">
                <input
                  type="number"
                  value={contractCompleted}
                  onInput={(e) => {
                    const ev = e as unknown
                    setContractCompleted(
                      (ev as {detail?: {value?: string}}).detail?.value ??
                        (ev as {target?: {value?: string}}).target?.value ??
                        ''
                    )
                  }}
                  placeholder="请输入已完成合同额"
                  className="w-full text-xl text-foreground bg-transparent outline-none"
                />
              </div>
            </div>

            {/* 小组成员选择 */}
            <div className="mb-4">
              <div className="text-xl text-foreground font-bold mb-2">小组成员</div>
              <button
                type="button"
                onClick={handleOpenUserSelector}
                className="w-full border-2 border-input rounded px-4 py-3 bg-background flex items-center justify-between">
                <span className="text-xl text-foreground">
                  {selectedUserIds.length > 0 
                    ? `已选择 ${selectedUserIds.length} 人` 
                    : '点击选择成员'}
                </span>
                <div className="i-mdi-chevron-right text-2xl text-muted-foreground" />
              </button>
              
              {/* 已选择的用户列表 */}
              {selectedUserIds.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {selectedUserIds.map(userId => {
                    const user = allUsers.find(u => u.id === userId)
                    if (!user) return null
                    return (
                      <div 
                        key={userId}
                        className="px-3 py-1 bg-primary/10 text-primary rounded-full text-base flex items-center gap-1">
                        {user.name}
                        <button
                          type="button"
                          onClick={() => toggleUserSelection(userId)}
                          className="i-mdi-close text-lg"
                        />
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowDialog(false)}
                className="flex-1 py-3 bg-card border-2 border-border text-foreground text-xl rounded flex items-center justify-center leading-none">
                取消
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="flex-1 py-3 bg-primary text-primary-foreground text-xl rounded flex items-center justify-center leading-none">
                确定
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 用户选择器弹窗 */}
      {showUserSelector && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-6">
          <div className="bg-card rounded p-6 w-full max-w-md max-h-[80vh] flex flex-col">
            <div className="text-xl text-foreground font-bold mb-4">选择小组成员</div>
            
            {/* 用户列表 */}
            <div className="flex-1 overflow-y-auto">
              {allUsers.length === 0 ? (
                <div className="text-center py-8 text-base text-muted-foreground">
                  暂无可选用户
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {allUsers.map(user => {
                    const isSelected = selectedUserIds.includes(user.id)
                    return (
                      <div
                        key={user.id}
                        onClick={() => toggleUserSelection(user.id)}
                        className={`p-4 rounded border-2 cursor-pointer transition-colors ${
                          isSelected 
                            ? 'border-primary bg-primary/10' 
                            : 'border-border bg-background'
                        }`}>
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="text-xl text-foreground font-bold">{user.name}</div>
                            {(user.department || user.position) && (
                              <div className="text-base text-muted-foreground mt-1">
                                {[user.department, user.position].filter(Boolean).join(' · ')}
                              </div>
                            )}
                          </div>
                          <div className={`text-3xl ${isSelected ? 'i-mdi-checkbox-marked text-primary' : 'i-mdi-checkbox-blank-outline text-muted-foreground'}`} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* 底部按钮 */}
            <div className="mt-4 pt-4 border-t border-border">
              <button
                type="button"
                onClick={handleCloseUserSelector}
                className="w-full py-3 bg-primary text-primary-foreground text-xl rounded flex items-center justify-center leading-none">
                确定（已选 {selectedUserIds.length} 人）
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default withRouteGuard(TeamManagement)
