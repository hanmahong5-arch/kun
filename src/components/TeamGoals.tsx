import {useState, useCallback, useEffect} from 'react'
import Taro from '@tarojs/taro'
import {supabase} from '@/client/supabase'
import type {Team, TeamGoal} from '@/db/types'

interface TeamGoalsProps {
  isAdmin: boolean
  userId?: string
}

interface TeamMember {
  id: string
  name: string
}

interface TeamWithGoal extends Team {
  goal?: TeamGoal
  members?: TeamMember[]
}

export default function TeamGoals({isAdmin, userId}: TeamGoalsProps) {
  const [teams, setTeams] = useState<TeamWithGoal[]>([])
  const [loading, setLoading] = useState(true)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [editingTeam, setEditingTeam] = useState<TeamWithGoal | null>(null)
  const [goalContent, setGoalContent] = useState('')
  const [goalProgress, setGoalProgress] = useState('0')

  const loadData = useCallback(async () => {
    try {
      setLoading(true)

      const currentYear = new Date().getFullYear()

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

      // 加载小组目标
      const {data: goalsData, error: goalsError} = await supabase
        .from('team_goals')
        .select('*')
        .eq('year', currentYear)
        .in(
          'team_id',
          teamsData.map((t) => t.id)
        )

      if (goalsError) throw goalsError

      // 加载小组成员信息
      const {data: userTeamsData, error: userTeamsError} = await supabase
        .from('user_teams')
        .select(`
          team_id,
          profiles!inner(id, name)
        `)
        .in('team_id', teamsData.map((t) => t.id))

      if (userTeamsError) throw userTeamsError

      // 组织成员数据：team_id -> members[]
      const teamMembersMap = new Map<string, TeamMember[]>()
      if (userTeamsData) {
        userTeamsData.forEach((ut: any) => {
          if (!teamMembersMap.has(ut.team_id)) {
            teamMembersMap.set(ut.team_id, [])
          }
          if (ut.profiles) {
            teamMembersMap.get(ut.team_id)!.push({
              id: ut.profiles.id,
              name: ut.profiles.name
            })
          }
        })
      }

      // 合并数据
      const teamsWithGoals: TeamWithGoal[] = teamsData.map((team) => ({
        ...team,
        goal: goalsData?.find((g) => g.team_id === team.id),
        members: teamMembersMap.get(team.id) || []
      }))

      // 如果不是管理员，只显示用户所属的小组
      if (!isAdmin && userId) {
        const {data: userTeams} = await supabase
          .from('user_teams')
          .select('team_id')
          .eq('user_id', userId)

        if (userTeams && userTeams.length > 0) {
          const userTeamIds = userTeams.map((ut) => ut.team_id)
          setTeams(teamsWithGoals.filter((t) => userTeamIds.includes(t.id)))
        } else {
          setTeams([])
        }
      } else {
        setTeams(teamsWithGoals)
      }
    } catch (error) {
      console.error('加载小组目标失败:', error)
    } finally {
      setLoading(false)
    }
  }, [isAdmin, userId])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleEdit = (team: TeamWithGoal) => {
    setEditingTeam(team)
    setGoalContent(team.goal?.goal_content || '')
    setGoalProgress(String(team.goal?.progress || 0))
    setShowEditDialog(true)
  }

  const handleSave = async () => {
    if (!editingTeam) return

    if (!goalContent.trim()) {
      Taro.showToast({title: '请填写目标内容', icon: 'none'})
      return
    }

    const progress = parseFloat(goalProgress)
    if (isNaN(progress) || progress < 0 || progress > 100) {
      Taro.showToast({title: '进度必须在0-100之间', icon: 'none'})
      return
    }

    try {
      const currentYear = new Date().getFullYear()

      if (editingTeam.goal) {
        // 更新目标
        const {error} = await supabase
          .from('team_goals')
          .update({
            goal_content: goalContent,
            progress,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingTeam.goal.id)

        if (error) throw error
      } else {
        // 创建目标
        const {error} = await supabase.from('team_goals').insert({
          team_id: editingTeam.id,
          year: currentYear,
          goal_content: goalContent,
          progress
        })

        if (error) throw error
      }

      Taro.showToast({title: '保存成功', icon: 'success'})
      setShowEditDialog(false)
      loadData()
    } catch (error) {
      console.error('保存失败:', error)
      Taro.showToast({title: '保存失败', icon: 'none'})
    }
  }

  if (loading) {
    return (
      <div className="text-center py-4">
        <div className="text-base text-muted-foreground">加载中...</div>
      </div>
    )
  }

  if (teams.length === 0) {
    return (
      <div className="bg-card rounded p-6 text-center border border-border">
        <div className="i-mdi-account-group text-4xl text-muted-foreground mb-2" />
        <div className="text-base text-muted-foreground">
          {isAdmin ? '暂无小组，请先创建小组' : '您还未加入任何小组'}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {teams.map((team) => {
        const contractTarget = team.contract_target || 0
        const contractCompleted = team.contract_completed || 0
        const contractPercentage =
          contractTarget > 0 ? Math.round((contractCompleted / contractTarget) * 100) : 0

        return (
          <div key={team.id} className="bg-card rounded p-4 border border-border">
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <div className="text-xl text-foreground font-bold mb-1">{team.name}</div>
                {/* 显示小组成员 */}
                {team.members && team.members.length > 0 && (
                  <div className="text-sm text-muted-foreground mb-2">
                    {team.members.map((member) => member.name).join('、')}
                  </div>
                )}
                {team.description && (
                  <div className="text-sm text-muted-foreground">{team.description}</div>
                )}
              </div>
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => handleEdit(team)}
                  className="ml-3 p-2 bg-primary/10 text-primary rounded flex items-center justify-center leading-none">
                  <div className="i-mdi-pencil text-xl" />
                </button>
              )}
            </div>

            {/* 合同额完成情况看板 */}
            <div className="mb-3 p-3 bg-gradient-subtle rounded border border-primary/20">
              <div className="flex items-center justify-between mb-2">
                <div className="text-base text-foreground font-bold">合同额完成情况</div>
                <div className="text-2xl text-primary font-bold">{contractPercentage}%</div>
              </div>

              {/* 进度条 */}
              <div className="w-full h-3 bg-muted rounded-full overflow-hidden mb-2">
                <div
                  className="h-full bg-gradient-primary transition-all duration-300"
                  style={{width: `${Math.min(contractPercentage, 100)}%`}}
                />
              </div>

              <div className="flex items-center justify-between text-sm">
                <div className="text-muted-foreground">
                  已完成: <span className="text-foreground font-bold">{contractCompleted}</span> 万元
                </div>
                <div className="text-muted-foreground">
                  目标: <span className="text-foreground font-bold">{contractTarget}</span> 万元
                </div>
              </div>
            </div>

            {team.goal ? (
              <div>
                <div className="text-xl text-foreground leading-relaxed whitespace-pre-wrap mb-3">
                  {team.goal.goal_content}
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 bg-muted rounded-full h-3 overflow-hidden">
                    <div
                      className="bg-primary h-full transition-all"
                      style={{width: `${team.goal.progress}%`}}
                    />
                  </div>
                  <div className="text-xl text-foreground font-bold">{team.goal.progress}%</div>
                </div>
              </div>
            ) : (
              <div className="text-center py-4 bg-muted/30 rounded">
                <div className="text-base text-muted-foreground">暂未设置年度目标</div>
              </div>
            )}
          </div>
        )
      })}

      {/* 编辑对话框 */}
      {showEditDialog && editingTeam && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-6">
          <div className="bg-card rounded p-6 w-full max-w-md">
            <div className="text-xl text-foreground font-bold mb-4">
              编辑小组目标 - {editingTeam.name}
            </div>

            <div className="mb-4">
              <div className="flex items-center gap-1 mb-2">
                <div className="text-xl text-foreground font-bold">目标内容</div>
                <span className="text-destructive text-xl">*</span>
              </div>
              <div className="border-2 border-input rounded px-4 py-3 bg-background overflow-hidden">
                <textarea
                  value={goalContent}
                  onInput={(e) => {
                    const ev = e as unknown
                    setGoalContent(
                      (ev as {detail?: {value?: string}}).detail?.value ??
                        (ev as {target?: {value?: string}}).target?.value ??
                        ''
                    )
                  }}
                  placeholder="请输入年度目标内容"
                  className="w-full text-xl text-foreground bg-transparent outline-none"
                  style={{minHeight: '120px'}}
                />
              </div>
            </div>

            <div className="mb-4">
              <div className="flex items-center gap-1 mb-2">
                <div className="text-xl text-foreground font-bold">完成进度（%）</div>
                <span className="text-destructive text-xl">*</span>
              </div>
              <div className="border-2 border-input rounded px-4 py-3 bg-background overflow-hidden">
                <input
                  type="number"
                  value={goalProgress}
                  onInput={(e) => {
                    const ev = e as unknown
                    setGoalProgress(
                      (ev as {detail?: {value?: string}}).detail?.value ??
                        (ev as {target?: {value?: string}}).target?.value ??
                        ''
                    )
                  }}
                  placeholder="0-100"
                  className="w-full text-xl text-foreground bg-transparent outline-none"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowEditDialog(false)}
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
    </div>
  )
}
