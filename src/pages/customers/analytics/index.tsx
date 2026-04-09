import {useState, useCallback, useEffect, useMemo} from 'react'
import Taro from '@tarojs/taro'
import {useAuth} from '@/contexts/AuthContext'
import {supabase} from '@/client/supabase'
import {getAllCustomers, getTeamCustomers} from '@/db/api'
import {isLeaderOrAdmin} from '@/db/permissions-utils'
import type {Customer, CustomerType} from '@/db/types'

const CUSTOMER_TYPES: CustomerType[] = ['政府', '央企', '省属', '市属', '区属', '民企', '上市公司']

const TYPE_COLORS: Record<string, string> = {
  '政府': 'bg-primary',
  '央企': 'bg-success',
  '省属': 'bg-blue-400',
  '市属': 'bg-cyan-500',
  '区属': 'bg-teal-500',
  '民企': 'bg-warning',
  '上市公司': 'bg-destructive'
}

interface TeamCustomerStats {
  teamName: string
  total: number
  newCount: number
  oldCount: number
}

export default function CustomerAnalytics() {
  const {profile} = useAuth()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [teamStats, setTeamStats] = useState<TeamCustomerStats[]>([])
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    if (!profile) return
    try {
      setLoading(true)

      // Load customers based on role
      const hasFullAccess = isLeaderOrAdmin(profile)
      const data = hasFullAccess
        ? await getAllCustomers()
        : await getTeamCustomers(profile.id as string)
      setCustomers(data)

      // Load team-level customer stats
      if (hasFullAccess) {
        const {data: teams} = await supabase
          .from('teams')
          .select('id, name')
          .order('display_order')

        if (teams && teams.length > 0) {
          const {data: userTeams} = await supabase
            .from('user_teams')
            .select('team_id, user_id')

          const teamStatsData: TeamCustomerStats[] = teams.map((team) => {
            const memberIds = (userTeams || [])
              .filter((ut) => ut.team_id === team.id)
              .map((ut) => ut.user_id)
            const teamCustomers = data.filter((c: Customer) =>
              memberIds.includes(c.responsible_person_id)
            )
            return {
              teamName: team.name,
              total: teamCustomers.length,
              newCount: teamCustomers.filter((c: Customer) => c.classification === '新客户').length,
              oldCount: teamCustomers.filter((c: Customer) => c.classification === '老客户').length
            }
          })
          setTeamStats(teamStatsData)
        }
      }
    } catch (error) {
      console.error('加载客户分析数据失败:', error)
      Taro.showToast({title: '加载失败', icon: 'none'})
    } finally {
      setLoading(false)
    }
  }, [profile])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Customer type distribution
  const typeStats = useMemo(() => {
    return CUSTOMER_TYPES.map((type) => ({
      type,
      count: customers.filter((c) => c.type === type).length
    })).filter((s) => s.count > 0)
  }, [customers])

  // New vs old customer distribution
  const classStats = useMemo(() => {
    const newCount = customers.filter((c) => c.classification === '新客户').length
    const oldCount = customers.filter((c) => c.classification === '老客户').length
    return {newCount, oldCount, total: customers.length}
  }, [customers])

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-xl text-muted-foreground">加载中...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background pb-6">
      {/* Header */}
      <div className="bg-gradient-primary px-6 py-6">
        <div className="flex items-center justify-between mb-2">
          <div className="text-2xl text-primary-foreground font-bold">客户分析</div>
          <button
            type="button"
            onClick={() => Taro.navigateBack()}
            className="px-4 py-2 bg-primary-foreground/20 text-primary-foreground text-base rounded flex items-center gap-1 leading-none">
            <div className="i-mdi-arrow-left text-lg" />
            <span>返回</span>
          </button>
        </div>
        <div className="text-base text-primary-foreground/80">客户数据分布与趋势</div>
      </div>

      {/* Summary cards */}
      <div className="px-6 mt-4">
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-gradient-primary rounded p-4 flex flex-col items-center">
            <div className="text-3xl text-primary-foreground font-bold">{classStats.total}</div>
            <div className="text-base text-primary-foreground/80 mt-1">客户总数</div>
          </div>
          <div className="bg-gradient-subtle rounded p-4 flex flex-col items-center">
            <div className="text-3xl text-success font-bold">{classStats.newCount}</div>
            <div className="text-base text-muted-foreground mt-1">新客户</div>
          </div>
          <div className="bg-gradient-subtle rounded p-4 flex flex-col items-center">
            <div className="text-3xl text-primary font-bold">{classStats.oldCount}</div>
            <div className="text-base text-muted-foreground mt-1">老客户</div>
          </div>
        </div>
      </div>

      {/* New/Old customer distribution */}
      {classStats.total > 0 && (
        <div className="px-6 mt-4">
          <div className="bg-card rounded p-4 border border-border">
            <div className="text-xl text-foreground font-bold mb-3">新老客户分布</div>
            <div className="flex items-center gap-3 mb-3">
              <div className="flex-1">
                <div className="flex items-center justify-between text-base mb-1">
                  <span className="text-foreground">新客户</span>
                  <span className="text-muted-foreground">
                    {classStats.newCount} ({Math.round((classStats.newCount / classStats.total) * 100)}%)
                  </span>
                </div>
                <div className="w-full h-4 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-success transition-all"
                    style={{width: `${Math.round((classStats.newCount / classStats.total) * 100)}%`}}
                  />
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <div className="flex items-center justify-between text-base mb-1">
                  <span className="text-foreground">老客户</span>
                  <span className="text-muted-foreground">
                    {classStats.oldCount} ({Math.round((classStats.oldCount / classStats.total) * 100)}%)
                  </span>
                </div>
                <div className="w-full h-4 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{width: `${Math.round((classStats.oldCount / classStats.total) * 100)}%`}}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Customer type distribution */}
      <div className="px-6 mt-4">
        <div className="bg-card rounded p-4 border border-border">
          <div className="text-xl text-foreground font-bold mb-3">客户类型分布</div>
          {typeStats.length > 0 ? (
            <div>
              {typeStats.map((s) => {
                const pct = customers.length > 0 ? Math.round((s.count / customers.length) * 100) : 0
                return (
                  <div key={s.type} className="mb-3 last:mb-0">
                    <div className="flex items-center justify-between text-base mb-1">
                      <span className="text-foreground">{s.type}</span>
                      <span className="text-muted-foreground">{s.count} ({pct}%)</span>
                    </div>
                    <div className="w-full h-4 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${TYPE_COLORS[s.type] || 'bg-primary'}`}
                        style={{width: `${pct}%`}}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="text-center text-base text-muted-foreground py-4">暂无数据</div>
          )}
        </div>
      </div>

      {/* Team tracking stats (only visible to leaders/admins) */}
      {teamStats.length > 0 && (
        <div className="px-6 mt-4">
          <div className="bg-card rounded p-4 border border-border">
            <div className="text-xl text-foreground font-bold mb-3">各小组跟踪客户数量</div>
            <div className="flex flex-col gap-3">
              {teamStats.map((team) => (
                <div key={team.teamName} className="bg-muted/30 rounded p-3 border border-border">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-lg text-foreground font-bold">{team.teamName}</div>
                    <div className="text-lg text-primary font-bold">{team.total} 个客户</div>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span>新客户: <span className="text-success font-bold">{team.newCount}</span></span>
                    <span>老客户: <span className="text-primary font-bold">{team.oldCount}</span></span>
                  </div>
                  {team.total > 0 && (
                    <div className="mt-2 w-full h-3 bg-muted rounded-full overflow-hidden flex">
                      <div
                        className="h-full bg-success"
                        style={{width: `${Math.round((team.newCount / team.total) * 100)}%`}}
                      />
                      <div
                        className="h-full bg-primary"
                        style={{width: `${Math.round((team.oldCount / team.total) * 100)}%`}}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
