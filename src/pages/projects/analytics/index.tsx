import {useState, useEffect, useMemo, useCallback} from 'react'
import Taro from '@tarojs/taro'
import {withRouteGuard} from '@/components/RouteGuard'
import {getAllProjects} from '@/db/api'

function ProjectAnalytics() {
  const [projects, setProjects] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [timeRange, setTimeRange] = useState<'all' | '3months' | '6months' | '1year'>('1year')

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      const data = await getAllProjects()
      setProjects(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('加载项目数据失败:', error)
      Taro.showToast({title: '加载失败', icon: 'none'})
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  // 根据时间范围筛选项目
  const filteredProjects = useMemo(() => {
    if (timeRange === 'all') return projects

    const now = new Date()
    const cutoffDate = new Date()
    
    switch (timeRange) {
      case '3months':
        cutoffDate.setMonth(now.getMonth() - 3)
        break
      case '6months':
        cutoffDate.setMonth(now.getMonth() - 6)
        break
      case '1year':
        cutoffDate.setFullYear(now.getFullYear() - 1)
        break
    }

    return projects.filter((p) => new Date(p.created_at) >= cutoffDate)
  }, [projects, timeRange])

  // 按月统计新增项目数量
  const monthlyStats = useMemo(() => {
    const stats: Record<string, {newProjects: number; wonProjects: number}> = {}
    
    filteredProjects.forEach((project) => {
      const month = new Date(project.created_at).toLocaleDateString('zh-CN', {year: 'numeric', month: '2-digit'})
      if (!stats[month]) {
        stats[month] = {newProjects: 0, wonProjects: 0}
      }
      stats[month].newProjects++
      if (project.stage === '已中标') {
        stats[month].wonProjects++
      }
    })

    return Object.entries(stats)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => ({month, ...data}))
  }, [filteredProjects])

  // 负责人业绩排行榜
  const personRanking = useMemo(() => {
    const ranking: Record<string, {name: string; wonCount: number; totalAmount: number}> = {}

    filteredProjects.forEach((project) => {
      if (project.stage === '已中标' && project.profiles) {
        const personId = project.responsible_person_id
        if (!ranking[personId]) {
          ranking[personId] = {
            name: project.profiles.name,
            wonCount: 0,
            totalAmount: 0
          }
        }
        ranking[personId].wonCount++
        ranking[personId].totalAmount += project.investment_amount || 0
      }
    })

    return Object.values(ranking)
      .sort((a, b) => b.wonCount - a.wonCount || b.totalAmount - a.totalAmount)
      .slice(0, 10)
  }, [filteredProjects])

  const timeRangeOptions = [
    {label: '全部', value: 'all'},
    {label: '近3个月', value: '3months'},
    {label: '近6个月', value: '6months'},
    {label: '近1年', value: '1year'}
  ]

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-xl text-muted-foreground">加载中...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background pb-6">
      {/* 头部 */}
      <div className="bg-gradient-primary px-6 py-6">
        <div className="flex items-center justify-between mb-2">
          <div className="text-2xl text-primary-foreground font-bold">项目数据分析</div>
          <button
            type="button"
            onClick={() => Taro.navigateBack()}
            className="px-4 py-2 bg-primary-foreground/20 text-primary-foreground text-base rounded flex items-center gap-1 leading-none">
            <div className="i-mdi-arrow-left text-lg" />
            <span>返回</span>
          </button>
        </div>
        <div className="text-base text-primary-foreground/80">项目趋势与业绩分析</div>
      </div>

      {/* 时间范围选择 */}
      <div className="px-6 py-4 bg-card">
        <div className="text-base text-muted-foreground mb-2">时间范围</div>
        <div className="flex gap-2 overflow-x-auto">
          {timeRangeOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setTimeRange(option.value as typeof timeRange)}
              className={`px-4 py-2 text-xl rounded flex items-center justify-center leading-none break-keep ${
                timeRange === option.value ? 'bg-primary text-primary-foreground' : 'bg-card text-foreground border border-border'
              }`}>
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* 项目趋势图表 */}
      <div className="px-6 py-4">
        <div className="bg-card rounded p-4 border border-border">
          <div className="text-xl text-foreground font-bold mb-4">项目趋势</div>
          <div className="flex flex-col gap-3">
            {monthlyStats.map((stat) => (
              <div key={stat.month} className="flex items-center gap-3">
                <div className="text-base text-muted-foreground w-24">{stat.month}</div>
                <div className="flex-1 flex items-center gap-2">
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-base text-foreground">新增</span>
                      <span className="text-base text-primary font-bold">{stat.newProjects}</span>
                    </div>
                    <div
                      className="h-2 rounded-full bg-primary"
                      style={{width: `${(stat.newProjects / Math.max(...monthlyStats.map((s) => s.newProjects), 1)) * 100}%`, minWidth: '10px'}}
                    />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-base text-foreground">中标</span>
                      <span className="text-base text-success font-bold">{stat.wonProjects}</span>
                    </div>
                    <div
                      className="h-2 rounded-full bg-success"
                      style={{width: `${(stat.wonProjects / Math.max(...monthlyStats.map((s) => s.wonProjects), 1)) * 100}%`, minWidth: '10px'}}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 负责人业绩排行榜 */}
      <div className="px-6 py-4">
        <div className="bg-card rounded p-4 border border-border">
          <div className="text-xl text-foreground font-bold mb-4">负责人业绩排行榜</div>
          <div className="flex flex-col gap-3">
            {personRanking.map((person, index) => (
              <div key={index} className="flex items-center gap-3 bg-background rounded px-4 py-3">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-base font-bold ${
                    index === 0
                      ? 'bg-yellow-500 text-white'
                      : index === 1
                      ? 'bg-gray-400 text-white'
                      : index === 2
                      ? 'bg-orange-600 text-white'
                      : 'bg-muted text-muted-foreground'
                  }`}>
                  {index + 1}
                </div>
                <div className="flex-1">
                  <div className="text-xl text-foreground font-bold">{person.name}</div>
                  <div className="flex items-center gap-4 mt-1">
                    <span className="text-base text-muted-foreground">
                      中标项目: <span className="text-primary font-bold">{person.wonCount}</span>
                    </span>
                    <span className="text-base text-muted-foreground">
                      合同额: <span className="text-success font-bold">{(person.totalAmount / 10000).toFixed(2)}</span> 万元
                    </span>
                  </div>
                </div>
              </div>
            ))}
            {personRanking.length === 0 && (
              <div className="text-center py-8">
                <div className="text-xl text-muted-foreground">暂无数据</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default withRouteGuard(ProjectAnalytics)
