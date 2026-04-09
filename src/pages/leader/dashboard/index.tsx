import {useState, useCallback, useEffect} from 'react'
import Taro from '@tarojs/taro'
import {withRouteGuard} from '@/components/RouteGuard'
import {useAuth} from '@/contexts/AuthContext'
import {supabase} from '@/client/supabase'
import {getKPIIndicatorsWithLatestData, getUnreadAlerts} from '@/db/leaderDashboard'
import {isLeaderOrAdmin} from '@/db/permissions-utils'
import type {KPIIndicator, ReportAlert} from '@/db/types'

interface DistributionItem {
  label: string
  count: number
  amount?: number
  // Navigation params when this row is clicked
  navUrl?: string
}

interface CategoryDistribution {
  items: DistributionItem[]
  total: number
}

function LeaderDashboard() {
  const {profile} = useAuth()
  const [kpiData, setKpiData] = useState<
    Array<KPIIndicator & {latest_value?: number; latest_date?: string}>
  >([])
  const [alerts, setAlerts] = useState<ReportAlert[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [distributions, setDistributions] = useState<Record<string, CategoryDistribution>>({})

  const hasAccess = isLeaderOrAdmin(profile)

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      const [kpiResult, alertsResult] = await Promise.all([
        getKPIIndicatorsWithLatestData(),
        getUnreadAlerts()
      ])
      setKpiData(kpiResult)
      setAlerts(alertsResult)
      await loadDistributions()
    } catch (error) {
      console.error('加载数据失败:', error)
      Taro.showToast({title: '加载失败', icon: 'none'})
    } finally {
      setLoading(false)
    }
  }, [])

  const loadDistributions = async () => {
    try {
      const [projectsRes, customersRes] = await Promise.all([
        supabase.from('projects').select('project_type, investment_amount, classification, stage'),
        supabase.from('customers').select('type, classification')
      ])

      const projects = projectsRes.data || []
      const customers = customersRes.data || []

      // Financial: won bid project type distribution
      const wonProjects = projects.filter((p) => p.stage === '已中标')
      const typeMap = new Map<string, {count: number; amount: number}>()
      wonProjects.forEach((p) => {
        const type = p.project_type || '其他'
        const prev = typeMap.get(type) || {count: 0, amount: 0}
        typeMap.set(type, {count: prev.count + 1, amount: prev.amount + (p.investment_amount || 0)})
      })

      // Project: classification distribution
      const classKeys: Record<string, string> = {
        a_lock: 'A跟', a_compete: 'A争', b_class: 'B类', c_class: 'C类', d_class: 'D类'
      }
      const classMap = new Map<string, {count: number; amount: number; key: string}>()
      let wonCount = 0
      let trackingCount = 0
      projects.forEach((p) => {
        const key = p.classification || 'unknown'
        const label = classKeys[key] || key
        const prev = classMap.get(label) || {count: 0, amount: 0, key}
        classMap.set(label, {count: prev.count + 1, amount: prev.amount + (p.investment_amount || 0), key})
        if (p.stage === '已中标') wonCount++
        else trackingCount++
      })

      // Customer: new/old + type distribution
      const newCount = customers.filter((c) => c.classification === '新客户').length
      const oldCount = customers.filter((c) => c.classification === '老客户').length
      const custTypeMap = new Map<string, number>()
      customers.forEach((c) => {
        const type = c.type || '其他'
        custTypeMap.set(type, (custTypeMap.get(type) || 0) + 1)
      })

      setDistributions({
        financial: {
          items: Array.from(typeMap.entries()).map(([label, v]) => ({
            label,
            count: v.count,
            amount: v.amount,
            navUrl: '/pages/projects/index?stage=已中标'
          })),
          total: wonProjects.length
        },
        project: {
          items: [
            {label: '已中标', count: wonCount, navUrl: '/pages/projects/index?stage=已中标'},
            {label: '在跟踪', count: trackingCount, navUrl: '/pages/projects/index'},
            ...Array.from(classMap.entries()).map(([label, v]) => ({
              label,
              count: v.count,
              amount: v.amount,
              navUrl: `/pages/projects/index?classification=${v.key}`
            }))
          ],
          total: projects.length
        },
        customer: {
          items: [
            {label: '新客户', count: newCount, navUrl: '/pages/customers/index?classification=新客户'},
            {label: '老客户', count: oldCount, navUrl: '/pages/customers/index?classification=老客户'},
            ...Array.from(custTypeMap.entries()).map(([label, count]) => ({
              label,
              count,
              navUrl: `/pages/customers/index?type=${encodeURIComponent(label)}`
            }))
          ],
          total: customers.length
        }
      })
    } catch (error) {
      console.error('加载分布数据失败:', error)
    }
  }

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleRefresh = async () => {
    setRefreshing(true)
    await loadData()
    setRefreshing(false)
    Taro.showToast({title: '刷新成功', icon: 'success', duration: 1500})
  }

  const calculateCompletionRate = (current?: number, target?: number) => {
    if (!current || !target || target === 0) return 0
    return Math.round((current / target) * 100)
  }

  const getCompletionRateColor = (rate: number) => {
    if (rate >= 90) return 'text-success'
    if (rate >= 70) return 'text-warning'
    return 'text-destructive'
  }

  const groupedKPI = kpiData.reduce(
    (acc, kpi) => {
      if (!acc[kpi.category]) acc[kpi.category] = []
      acc[kpi.category].push(kpi)
      return acc
    },
    {} as Record<string, typeof kpiData>
  )

  const categoryNames: Record<string, string> = {
    financial: '中标指标',
    project: '项目指标',
    customer: '客户指标'
  }

  const categoryIcons: Record<string, string> = {
    financial: 'i-mdi-currency-cny',
    project: 'i-mdi-briefcase',
    customer: 'i-mdi-account-group'
  }

  // "View all" link for each category
  const categoryListUrl: Record<string, string> = {
    financial: '/pages/bids/index?filter=won',
    project: '/pages/projects/index',
    customer: '/pages/customers/index'
  }

  // Quick navigation entries
  const quickNav = [
    {icon: 'i-mdi-chart-timeline-variant', label: '项目分析', url: '/pages/projects/analytics/index'},
    {icon: 'i-mdi-account-search', label: '客户分析', url: '/pages/customers/analytics/index'},
    {icon: 'i-mdi-gavel', label: '投标记录', url: '/pages/bids/index'},
    {icon: 'i-mdi-book-open-variant', label: '知识库', url: '/pages/documents/index'},
  ]

  if (!profile || !hasAccess) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6">
        <div className="text-center">
          <div className="i-mdi-shield-lock text-6xl text-muted-foreground mb-4" />
          <div className="text-xl text-foreground">仅限领导和管理员访问</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background pb-6">
      {/* Header */}
      <div className="bg-gradient-primary px-6 py-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-2xl text-primary-foreground font-bold">领导数据中心</div>
            <div className="text-base text-primary-foreground/80 mt-1">
              实时监控关键业务指标
            </div>
          </div>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-3 bg-primary-foreground/20 text-primary-foreground rounded flex items-center justify-center leading-none">
            <div className={`i-mdi-refresh text-2xl ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="px-6 mt-4">
          <div
            onClick={() => Taro.navigateTo({url: '/pages/leader/alerts/index'})}
            className="bg-destructive/10 border-2 border-destructive rounded p-4 flex items-center gap-3">
            <div className="i-mdi-alert text-3xl text-destructive" />
            <div className="flex-1">
              <div className="text-xl text-destructive font-bold">
                {alerts.length} 条未读预警
              </div>
              <div className="text-base text-destructive/80 mt-1">点击查看详情</div>
            </div>
            <div className="i-mdi-chevron-right text-2xl text-destructive" />
          </div>
        </div>
      )}

      {/* Quick navigation */}
      <div className="px-6 mt-4">
        <div className="grid grid-cols-4 gap-3">
          {quickNav.map((item) => (
            <div
              key={item.label}
              onClick={() => Taro.navigateTo({url: item.url})}
              className="bg-card rounded p-3 border border-border flex flex-col items-center gap-2 active:bg-muted/50">
              <div className={`${item.icon} text-2xl text-primary`} />
              <div className="text-sm text-foreground text-center">{item.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* KPI sections */}
      {loading ? (
        <div className="text-center py-12">
          <div className="text-xl text-muted-foreground">加载中...</div>
        </div>
      ) : (
        <div className="px-6 mt-4 space-y-6">
          {Object.entries(groupedKPI).filter(([category]) => category in categoryNames).map(([category, kpis]) => {
            const dist = distributions[category]

            return (
              <div key={category}>
                {/* Category header with "view all" link */}
                <div className="flex items-center justify-between mb-3">
                  <div className="text-xl text-foreground font-bold flex items-center gap-2">
                    <div className={`${categoryIcons[category] || 'i-mdi-chart-line'} text-2xl text-primary`} />
                    <span>{categoryNames[category] || category}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => Taro.navigateTo({url: categoryListUrl[category]})}
                    className="text-sm text-primary flex items-center gap-1">
                    <span>查看全部</span>
                    <div className="i-mdi-chevron-right text-base" />
                  </button>
                </div>

                {/* KPI cards */}
                <div className="grid grid-cols-2 gap-3">
                  {kpis.map((kpi) => {
                    const completionRate = calculateCompletionRate(
                      kpi.latest_value,
                      kpi.target_value || undefined
                    )
                    const rateColor = getCompletionRateColor(completionRate)

                    return (
                      <div
                        key={kpi.id}
                        onClick={() =>
                          Taro.navigateTo({
                            url: `/pages/leader/kpi-detail/index?id=${kpi.id}&name=${encodeURIComponent(kpi.name)}`
                          })
                        }
                        className="bg-gradient-subtle rounded p-4 border border-border active:bg-muted/50">
                        <div className="text-base text-muted-foreground mb-2">{kpi.name}</div>

                        <div className="flex items-baseline gap-2 mb-2">
                          <div className="text-3xl text-foreground font-bold">
                            {kpi.latest_value?.toFixed(0) || '-'}
                          </div>
                          {kpi.unit && (
                            <div className="text-base text-muted-foreground">{kpi.unit}</div>
                          )}
                        </div>

                        {kpi.target_value && (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">
                                目标: {kpi.target_value.toFixed(0)}
                                {kpi.unit}
                              </span>
                              <span className={`font-bold ${rateColor}`}>{completionRate}%</span>
                            </div>

                            <div className="w-full h-2 bg-muted rounded overflow-hidden">
                              <div
                                className={`h-full transition-all ${
                                  completionRate >= 90
                                    ? 'bg-success'
                                    : completionRate >= 70
                                      ? 'bg-warning'
                                      : 'bg-destructive'
                                }`}
                                style={{width: `${Math.min(completionRate, 100)}%`}}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* Inline distribution — each row clickable to filtered list */}
                {dist && dist.items.length > 0 && (
                  <div className="mt-3 bg-card rounded p-4 border border-border">
                    <div className="flex items-center justify-between mb-3">
                      <div className="text-base text-muted-foreground font-medium">
                        {category === 'financial' ? '中标项目类型分布' : category === 'project' ? '项目分级分布' : '客户分布'}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        共 <span className="text-foreground font-bold">{dist.total}</span> 项
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      {dist.items.map((item) => {
                        const pct = dist.total > 0 ? Math.round((item.count / dist.total) * 100) : 0
                        return (
                          <div
                            key={item.label}
                            onClick={() => {
                              if (item.navUrl) Taro.navigateTo({url: item.navUrl})
                            }}
                            className={item.navUrl ? 'active:bg-muted/50 rounded -mx-1 px-1 py-0.5' : ''}>
                            <div className="flex items-center justify-between text-sm mb-1">
                              <span className="text-foreground flex items-center gap-1">
                                {item.label}
                                {item.navUrl && <div className="i-mdi-chevron-right text-xs text-muted-foreground" />}
                              </span>
                              <span className="text-muted-foreground">
                                {item.count}{item.amount !== undefined ? ` / ${item.amount}万` : ''} ({pct}%)
                              </span>
                            </div>
                            <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full bg-primary transition-all"
                                style={{width: `${Math.max(pct, 2)}%`}}
                              />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default withRouteGuard(LeaderDashboard)
