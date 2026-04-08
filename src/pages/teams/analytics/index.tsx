import {useState, useCallback, useEffect} from 'react'
import Taro, {useDidShow} from '@tarojs/taro'
import {Picker} from '@tarojs/components'
import {withRouteGuard} from '@/components/RouteGuard'
import {supabase} from '@/client/supabase'
import type {Team, TeamGoal} from '@/db/types'

type TimePeriod = 'month' | 'quarter' | 'year'

interface TeamStats {
  team: Team
  currentGoal?: TeamGoal
  history: {month: number; progress: number}[]
  avgProgress: number
  trend: 'up' | 'down' | 'stable'
}

function TeamAnalytics() {
  const [teams, setTeams] = useState<Team[]>([])
  const [teamStats, setTeamStats] = useState<TeamStats[]>([])
  const [loading, setLoading] = useState(true)
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('month')
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())

  const years = Array.from({length: 5}, (_, i) => new Date().getFullYear() - i)

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
        setTeamStats([])
        return
      }

      setTeams(teamsData)

      // 加载当前年度目标
      const {data: goalsData} = await supabase
        .from('team_goals')
        .select('*')
        .eq('year', selectedYear)
        .in(
          'team_id',
          teamsData.map((t) => t.id)
        )

      // 加载历史数据
      const {data: historyData} = await supabase
        .from('team_goal_history')
        .select('*')
        .eq('year', selectedYear)
        .in(
          'team_id',
          teamsData.map((t) => t.id)
        )
        .order('month')

      // 组装统计数据
      const stats: TeamStats[] = teamsData.map((team) => {
        const currentGoal = goalsData?.find((g) => g.team_id === team.id)
        const history =
          historyData
            ?.filter((h) => h.team_id === team.id)
            .map((h) => ({month: h.month, progress: h.progress})) || []

        // 计算平均进度
        const avgProgress =
          history.length > 0
            ? history.reduce((sum, h) => sum + h.progress, 0) / history.length
            : currentGoal?.progress || 0

        // 计算趋势
        let trend: 'up' | 'down' | 'stable' = 'stable'
        if (history.length >= 2) {
          const recent = history.slice(-2)
          if (recent[1].progress > recent[0].progress) trend = 'up'
          else if (recent[1].progress < recent[0].progress) trend = 'down'
        }

        return {team, currentGoal, history, avgProgress, trend}
      })

      setTeamStats(stats)
    } catch (error) {
      console.error('加载数据失败:', error)
      Taro.showToast({title: '加载失败', icon: 'none'})
    } finally {
      setLoading(false)
    }
  }, [selectedYear])

  useDidShow(() => {
    loadData()
  })

  useEffect(() => {
    loadData()
  }, [loadData])

  const getTrendIcon = (trend: 'up' | 'down' | 'stable') => {
    switch (trend) {
      case 'up':
        return 'i-mdi-trending-up'
      case 'down':
        return 'i-mdi-trending-down'
      default:
        return 'i-mdi-trending-neutral'
    }
  }

  const getTrendColor = (trend: 'up' | 'down' | 'stable') => {
    switch (trend) {
      case 'up':
        return 'text-success'
      case 'down':
        return 'text-destructive'
      default:
        return 'text-muted-foreground'
    }
  }

  const getMonthsForPeriod = () => {
    const currentMonth = new Date().getMonth() + 1
    switch (timePeriod) {
      case 'month':
        return [currentMonth]
      case 'quarter': {
        const quarter = Math.floor((currentMonth - 1) / 3)
        return [quarter * 3 + 1, quarter * 3 + 2, quarter * 3 + 3]
      }
      case 'year':
        return Array.from({length: 12}, (_, i) => i + 1)
    }
  }

  const getFilteredHistory = (history: {month: number; progress: number}[]) => {
    const months = getMonthsForPeriod()
    return history.filter((h) => months.includes(h.month))
  }

  return (
    <div className="min-h-screen bg-background pb-6">
      {/* 页面标题 */}
      <div className="px-6 py-6 bg-gradient-primary">
        <div className="text-2xl text-primary-foreground font-bold mb-2">小组统计分析</div>
        <div className="text-xl text-primary-foreground/80">查看各小组目标完成情况</div>
      </div>

      {/* 筛选器 */}
      <div className="px-6 mt-4">
        <div className="bg-card rounded p-4 border border-border">
          <div className="flex items-center gap-3 mb-3">
            <div className="text-xl text-foreground font-bold">年份</div>
            <Picker
              mode="selector"
              range={years}
              onChange={(e) => {
                const index = e.detail.value
                if (typeof index === 'number' && index >= 0 && index < years.length) {
                  setSelectedYear(years[index])
                }
              }}>
              <div className="px-4 py-2 bg-primary text-primary-foreground text-base rounded">
                {selectedYear}
              </div>
            </Picker>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-xl text-foreground font-bold">周期</div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setTimePeriod('month')}
                className={`px-4 py-2 text-base rounded ${
                  timePeriod === 'month'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-foreground'
                }`}>
                月度
              </button>
              <button
                type="button"
                onClick={() => setTimePeriod('quarter')}
                className={`px-4 py-2 text-base rounded ${
                  timePeriod === 'quarter'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-foreground'
                }`}>
                季度
              </button>
              <button
                type="button"
                onClick={() => setTimePeriod('year')}
                className={`px-4 py-2 text-base rounded ${
                  timePeriod === 'year'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-foreground'
                }`}>
                年度
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 统计概览 */}
      <div className="px-6 mt-4">
        <div className="text-xl text-foreground font-bold mb-3">统计概览</div>
        {loading ? (
          <div className="text-center py-8">
            <div className="text-base text-muted-foreground">加载中...</div>
          </div>
        ) : teamStats.length === 0 ? (
          <div className="bg-card rounded p-8 text-center border border-border">
            <div className="i-mdi-chart-line text-6xl text-muted-foreground mb-2" />
            <div className="text-base text-muted-foreground">暂无数据</div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {teamStats.map((stat) => {
              const filteredHistory = getFilteredHistory(stat.history)
              const periodProgress =
                filteredHistory.length > 0
                  ? filteredHistory.reduce((sum, h) => sum + h.progress, 0) / filteredHistory.length
                  : stat.currentGoal?.progress || 0

              return (
                <div key={stat.team.id} className="bg-card rounded p-4 border border-border">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="text-xl text-foreground font-bold mb-1">{stat.team.name}</div>
                      {stat.currentGoal && (
                        <div className="text-sm text-muted-foreground line-clamp-2">
                          {stat.currentGoal.goal_content}
                        </div>
                      )}
                    </div>
                    <div className={`ml-3 ${getTrendIcon(stat.trend)} text-3xl ${getTrendColor(stat.trend)}`} />
                  </div>

                  {/* 当前进度 */}
                  <div className="mb-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-base text-muted-foreground">当前进度</span>
                      <span className="text-base text-foreground font-bold">
                        {stat.currentGoal?.progress || 0}%
                      </span>
                    </div>
                    <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-primary transition-all"
                        style={{width: `${stat.currentGoal?.progress || 0}%`}}
                      />
                    </div>
                  </div>

                  {/* 周期平均进度 */}
                  <div className="mb-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-base text-muted-foreground">周期平均</span>
                      <span className="text-base text-foreground font-bold">
                        {periodProgress.toFixed(1)}%
                      </span>
                    </div>
                    <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-subtle transition-all"
                        style={{width: `${periodProgress}%`}}
                      />
                    </div>
                  </div>

                  {/* 历史趋势 */}
                  {filteredHistory.length > 0 && (
                    <div>
                      <div className="text-base text-muted-foreground mb-2">历史趋势</div>
                      <div className="flex items-end gap-1 h-24">
                        {filteredHistory.map((h) => (
                          <div key={h.month} className="flex-1 flex flex-col items-center">
                            <div
                              className="w-full bg-primary/20 rounded-t"
                              style={{height: `${h.progress}%`}}
                            />
                            <div className="text-xs text-muted-foreground mt-1">{h.month}月</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 对比分析 */}
      <div className="px-6 mt-4">
        <div className="text-xl text-foreground font-bold mb-3">对比分析</div>
        <div className="bg-card rounded p-4 border border-border overflow-x-auto">
          <table className="w-full text-base">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 text-foreground font-bold">小组</th>
                <th className="text-center py-3 text-foreground font-bold">当前进度</th>
                <th className="text-center py-3 text-foreground font-bold">平均进度</th>
                <th className="text-center py-3 text-foreground font-bold">趋势</th>
              </tr>
            </thead>
            <tbody>
              {teamStats.map((stat) => {
                const filteredHistory = getFilteredHistory(stat.history)
                const periodProgress =
                  filteredHistory.length > 0
                    ? filteredHistory.reduce((sum, h) => sum + h.progress, 0) / filteredHistory.length
                    : stat.currentGoal?.progress || 0

                return (
                  <tr key={stat.team.id} className="border-b border-border last:border-0">
                    <td className="py-3 text-foreground">{stat.team.name}</td>
                    <td className="text-center py-3 text-foreground font-bold">
                      {stat.currentGoal?.progress || 0}%
                    </td>
                    <td className="text-center py-3 text-foreground font-bold">
                      {periodProgress.toFixed(1)}%
                    </td>
                    <td className="text-center py-3">
                      <div className={`${getTrendIcon(stat.trend)} text-2xl ${getTrendColor(stat.trend)} mx-auto`} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 关键指标 */}
      <div className="px-6 mt-4">
        <div className="text-xl text-foreground font-bold mb-3">关键指标</div>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gradient-primary rounded p-4">
            <div className="text-base text-primary-foreground/80 mb-1">最高进度</div>
            <div className="text-2xl text-primary-foreground font-bold">
              {teamStats.length > 0
                ? Math.max(...teamStats.map((s) => s.currentGoal?.progress || 0)).toFixed(1)
                : 0}
              %
            </div>
            <div className="text-sm text-primary-foreground/70 mt-1">
              {teamStats.find(
                (s) =>
                  s.currentGoal?.progress ===
                  Math.max(...teamStats.map((s) => s.currentGoal?.progress || 0))
              )?.team.name || '-'}
            </div>
          </div>

          <div className="bg-gradient-subtle rounded p-4">
            <div className="text-base text-muted-foreground mb-1">平均进度</div>
            <div className="text-2xl text-foreground font-bold">
              {teamStats.length > 0
                ? (
                    teamStats.reduce((sum, s) => sum + (s.currentGoal?.progress || 0), 0) /
                    teamStats.length
                  ).toFixed(1)
                : 0}
              %
            </div>
            <div className="text-sm text-muted-foreground mt-1">所有小组</div>
          </div>

          <div className="bg-success/10 rounded p-4">
            <div className="text-base text-muted-foreground mb-1">上升趋势</div>
            <div className="text-2xl text-success font-bold">
              {teamStats.filter((s) => s.trend === 'up').length}
            </div>
            <div className="text-sm text-muted-foreground mt-1">个小组</div>
          </div>

          <div className="bg-warning/10 rounded p-4">
            <div className="text-base text-muted-foreground mb-1">需关注</div>
            <div className="text-2xl text-warning font-bold">
              {teamStats.filter((s) => (s.currentGoal?.progress || 0) < 50).length}
            </div>
            <div className="text-sm text-muted-foreground mt-1">个小组</div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default withRouteGuard(TeamAnalytics)
