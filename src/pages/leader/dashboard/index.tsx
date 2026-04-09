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
}

interface CategoryDistribution {
  title: string
  items: DistributionItem[]
  total?: number
}

function LeaderDashboard() {
  const {profile} = useAuth()
  const [kpiData, setKpiData] = useState<
    Array<KPIIndicator & {latest_value?: number; latest_date?: string}>
  >([])
  const [alerts, setAlerts] = useState<ReportAlert[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [showDistribution, setShowDistribution] = useState<CategoryDistribution | null>(null)

  // 允许超级管理员、系统管理员和领导访问
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
    } catch (error) {
      console.error('加载数据失败:', error)
      Taro.showToast({title: '加载失败', icon: 'none'})
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  // 手动刷新
  const handleRefresh = async () => {
    setRefreshing(true)
    await loadData()
    setRefreshing(false)
    Taro.showToast({title: '刷新成功', icon: 'success', duration: 1500})
  }

  // Load distribution data for a category
  const handleShowDistribution = async (cat: string) => {
    try {
      Taro.showLoading({title: '加载中...'})

      if (cat === 'financial') {
        // Project type distribution for won bids
        const {data: projects} = await supabase
          .from('projects')
          .select('project_type, investment_amount')
          .eq('stage', '已中标')

        const typeMap = new Map<string, {count: number; amount: number}>()
        ;(projects || []).forEach((p) => {
          const type = p.project_type || '其他'
          const prev = typeMap.get(type) || {count: 0, amount: 0}
          typeMap.set(type, {count: prev.count + 1, amount: prev.amount + (p.investment_amount || 0)})
        })

        setShowDistribution({
          title: '中标项目类型分布',
          items: Array.from(typeMap.entries()).map(([label, v]) => ({label, count: v.count, amount: v.amount})),
          total: (projects || []).length
        })
      } else if (cat === 'project') {
        // Classification distribution
        const {data: projects} = await supabase
          .from('projects')
          .select('classification, stage, investment_amount')

        const classMap = new Map<string, {count: number; amount: number}>()
        let wonCount = 0
        let trackingCount = 0
        const classLabels: Record<string, string> = {
          a_lock: 'A跟', a_compete: 'A争', b_class: 'B类', c_class: 'C类', d_class: 'D类'
        }

        ;(projects || []).forEach((p) => {
          const label = classLabels[p.classification] || p.classification || '未分类'
          const prev = classMap.get(label) || {count: 0, amount: 0}
          classMap.set(label, {count: prev.count + 1, amount: prev.amount + (p.investment_amount || 0)})
          if (p.stage === '已中标') wonCount++
          else trackingCount++
        })

        setShowDistribution({
          title: '项目分级分布',
          items: [
            {label: '已中标', count: wonCount},
            {label: '在跟踪', count: trackingCount},
            ...Array.from(classMap.entries()).map(([label, v]) => ({label, count: v.count, amount: v.amount}))
          ],
          total: (projects || []).length
        })
      } else if (cat === 'customer') {
        const {data: customers} = await supabase
          .from('customers')
          .select('type, classification')

        const total = (customers || []).length
        const newCount = (customers || []).filter((c) => c.classification === '新客户').length
        const oldCount = (customers || []).filter((c) => c.classification === '老客户').length

        const typeMap = new Map<string, number>()
        ;(customers || []).forEach((c) => {
          const type = c.type || '其他'
          typeMap.set(type, (typeMap.get(type) || 0) + 1)
        })

        setShowDistribution({
          title: '客户分布',
          items: [
            {label: '新客户', count: newCount},
            {label: '老客户', count: oldCount},
            ...Array.from(typeMap.entries()).map(([label, count]) => ({label, count}))
          ],
          total
        })
      }
    } catch (error) {
      console.error('加载分布数据失败:', error)
      Taro.showToast({title: '加载失败', icon: 'none'})
    } finally {
      Taro.hideLoading()
    }
  }

  // 计算完成率
  const calculateCompletionRate = (current?: number, target?: number) => {
    if (!current || !target || target === 0) return 0
    return Math.round((current / target) * 100)
  }

  // 获取完成率颜色
  const getCompletionRateColor = (rate: number) => {
    if (rate >= 90) return 'text-success'
    if (rate >= 70) return 'text-warning'
    return 'text-destructive'
  }

  // 按类别分组KPI
  const groupedKPI = kpiData.reduce(
    (acc, kpi) => {
      if (!acc[kpi.category]) {
        acc[kpi.category] = []
      }
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
      {/* 头部 */}
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

      {/* 预警提示 */}
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

      {/* KPI指标卡片 */}
      {loading ? (
        <div className="text-center py-12">
          <div className="text-xl text-muted-foreground">加载中...</div>
        </div>
      ) : (
        <div className="px-6 mt-4 space-y-6">
          {Object.entries(groupedKPI).filter(([category]) => category in categoryNames).map(([category, kpis]) => (
            <div key={category}>
              <div className="text-xl text-foreground font-bold mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className={`i-mdi-${
                      category === 'financial'
                        ? 'currency-cny'
                        : category === 'project'
                          ? 'briefcase'
                          : category === 'customer'
                            ? 'account-group'
                            : 'chart-line'
                    } text-2xl text-primary`}
                  />
                  <span>{categoryNames[category] || category}</span>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleShowDistribution(category)
                  }}
                  className="text-sm text-primary font-normal flex items-center gap-1">
                  <span>关联展示</span>
                  <div className="i-mdi-chevron-right text-base" />
                </button>
              </div>

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
                      className="bg-gradient-subtle rounded p-4 border border-border">
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

                          {/* 进度条 */}
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
            </div>
          ))}
        </div>
      )}

      {/* Distribution modal */}
      {showDistribution && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center px-6">
          <div className="w-full max-w-lg bg-card rounded-xl p-6 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div className="text-xl text-foreground font-bold">{showDistribution.title}</div>
              <button
                type="button"
                onClick={() => setShowDistribution(null)}
                className="p-1 text-muted-foreground">
                <div className="i-mdi-close text-2xl" />
              </button>
            </div>

            {showDistribution.total !== undefined && (
              <div className="text-base text-muted-foreground mb-4">
                共计 <span className="text-foreground font-bold">{showDistribution.total}</span> 项
              </div>
            )}

            <div className="flex flex-col gap-3">
              {showDistribution.items.map((item) => {
                const pct = showDistribution.total && showDistribution.total > 0
                  ? Math.round((item.count / showDistribution.total) * 100)
                  : 0
                return (
                  <div key={item.label}>
                    <div className="flex items-center justify-between text-base mb-1">
                      <span className="text-foreground">{item.label}</span>
                      <span className="text-muted-foreground">
                        {item.count} 个{item.amount !== undefined ? ` / ${item.amount} 万元` : ''} ({pct}%)
                      </span>
                    </div>
                    <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{width: `${Math.max(pct, 2)}%`}}
                      />
                    </div>
                  </div>
                )
              })}
            </div>

            {showDistribution.items.length === 0 && (
              <div className="text-center py-6 text-muted-foreground">暂无数据</div>
            )}

            <button
              type="button"
              onClick={() => setShowDistribution(null)}
              className="w-full mt-6 py-3 bg-muted text-foreground text-base rounded">
              关闭
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default withRouteGuard(LeaderDashboard)
