import {useState, useCallback, useEffect} from 'react'
import Taro from '@tarojs/taro'
import {withRouteGuard} from '@/components/RouteGuard'
import {useAuth} from '@/contexts/AuthContext'
import {getKPIIndicatorsWithLatestData, getUnreadAlerts} from '@/db/leaderDashboard'
import {isLeaderOrAdmin} from '@/db/permissions-utils'
import type {KPIIndicator, ReportAlert} from '@/db/types'

function LeaderDashboard() {
  const {profile} = useAuth()
  const [kpiData, setKpiData] = useState<
    Array<KPIIndicator & {latest_value?: number; latest_date?: string}>
  >([])
  const [alerts, setAlerts] = useState<ReportAlert[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

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
    financial: '财务指标',
    project: '项目指标',
    customer: '客户指标',
    operation: '运营指标'
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
          {Object.entries(groupedKPI).map(([category, kpis]) => (
            <div key={category}>
              <div className="text-xl text-foreground font-bold mb-3 flex items-center gap-2">
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

      {/* 快捷入口 */}
      <div className="px-6 mt-6">
        <div className="text-xl text-foreground font-bold mb-3">快捷入口</div>
        <div className="grid grid-cols-3 gap-3">
          <button
            type="button"
            onClick={() => Taro.navigateTo({url: '/pages/leader/reports/index'})}
            className="py-4 bg-card border-2 border-border rounded flex flex-col items-center justify-center gap-2">
            <div className="i-mdi-file-chart text-3xl text-primary" />
            <span className="text-base text-foreground">专项报表</span>
          </button>

          <button
            type="button"
            onClick={() => Taro.navigateTo({url: '/pages/leader/analysis/index'})}
            className="py-4 bg-card border-2 border-border rounded flex flex-col items-center justify-center gap-2">
            <div className="i-mdi-chart-box text-3xl text-primary" />
            <span className="text-base text-foreground">深度分析</span>
          </button>

          <button
            type="button"
            onClick={() => Taro.navigateTo({url: '/pages/leader/export/index'})}
            className="py-4 bg-card border-2 border-border rounded flex flex-col items-center justify-center gap-2">
            <div className="i-mdi-download text-3xl text-primary" />
            <span className="text-base text-foreground">数据导出</span>
          </button>
        </div>
      </div>
    </div>
  )
}

export default withRouteGuard(LeaderDashboard)
