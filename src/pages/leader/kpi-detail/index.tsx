import {useState, useCallback, useEffect, useMemo} from 'react'
import Taro from '@tarojs/taro'
import {withRouteGuard} from '@/components/RouteGuard'
import {getKPIDataHistory} from '@/db/leaderDashboard'
import {supabase} from '@/client/supabase'
import type {KPIIndicator, KPIData} from '@/db/types'

function KPIDetailPage() {
  const [indicator, setIndicator] = useState<KPIIndicator | null>(null)
  const [historyData, setHistoryData] = useState<KPIData[]>([])
  const [loading, setLoading] = useState(true)
  const [days, setDays] = useState(30)

  const kpiId = useMemo(() => {
    const instance = Taro.getCurrentInstance()
    return instance.router?.params?.id || ''
  }, [])

  const kpiName = useMemo(() => {
    const instance = Taro.getCurrentInstance()
    return decodeURIComponent(instance.router?.params?.name || '')
  }, [])

  const loadData = useCallback(async () => {
    if (!kpiId) return

    try {
      setLoading(true)

      // 获取指标信息
      const {data: indicatorData, error: indicatorError} = await supabase
        .from('kpi_indicators')
        .select('*')
        .eq('id', kpiId)
        .maybeSingle()

      if (indicatorError) throw indicatorError
      setIndicator(indicatorData)

      // 获取历史数据
      const history = await getKPIDataHistory(kpiId, days)
      setHistoryData(history)
    } catch (error) {
      console.error('加载KPI详情失败:', error)
      Taro.showToast({title: '加载失败', icon: 'none'})
    } finally {
      setLoading(false)
    }
  }, [kpiId, days])

  useEffect(() => {
    loadData()
  }, [loadData])

  // 计算统计数据
  const statistics = useMemo(() => {
    if (historyData.length === 0) {
      return {
        latest: 0,
        average: 0,
        max: 0,
        min: 0,
        trend: 0
      }
    }

    const values = historyData.map((d) => d.value)
    const latest = values[values.length - 1]
    const previous = values[values.length - 2] || latest
    const trend = previous !== 0 ? ((latest - previous) / previous) * 100 : 0

    return {
      latest,
      average: values.reduce((sum, val) => sum + val, 0) / values.length,
      max: Math.max(...values),
      min: Math.min(...values),
      trend
    }
  }, [historyData])

  return (
    <div className="min-h-screen bg-background pb-6">
      {/* 头部 */}
      <div className="bg-gradient-primary px-6 py-6">
        <div className="text-2xl text-primary-foreground font-bold">{kpiName}</div>
        {indicator && (
          <div className="text-base text-primary-foreground/80 mt-1">{indicator.description}</div>
        )}
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="text-xl text-muted-foreground">加载中...</div>
        </div>
      ) : (
        <>
          {/* 统计卡片 */}
          <div className="px-6 mt-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gradient-subtle rounded p-4 border border-border">
                <div className="text-base text-muted-foreground mb-2">当前值</div>
                <div className="flex items-baseline gap-2">
                  <div className="text-3xl text-foreground font-bold">
                    {statistics.latest.toFixed(0)}
                  </div>
                  {indicator?.unit && (
                    <div className="text-base text-muted-foreground">{indicator.unit}</div>
                  )}
                </div>
                {statistics.trend !== 0 && (
                  <div
                    className={`text-sm mt-2 flex items-center gap-1 ${
                      statistics.trend > 0 ? 'text-success' : 'text-destructive'
                    }`}>
                    <div
                      className={`i-mdi-${statistics.trend > 0 ? 'trending-up' : 'trending-down'} text-base`}
                    />
                    <span>{Math.abs(statistics.trend).toFixed(1)}%</span>
                  </div>
                )}
              </div>

              <div className="bg-gradient-subtle rounded p-4 border border-border">
                <div className="text-base text-muted-foreground mb-2">平均值</div>
                <div className="flex items-baseline gap-2">
                  <div className="text-3xl text-foreground font-bold">
                    {statistics.average.toFixed(0)}
                  </div>
                  {indicator?.unit && (
                    <div className="text-base text-muted-foreground">{indicator.unit}</div>
                  )}
                </div>
              </div>

              <div className="bg-gradient-subtle rounded p-4 border border-border">
                <div className="text-base text-muted-foreground mb-2">最大值</div>
                <div className="flex items-baseline gap-2">
                  <div className="text-3xl text-foreground font-bold">
                    {statistics.max.toFixed(0)}
                  </div>
                  {indicator?.unit && (
                    <div className="text-base text-muted-foreground">{indicator.unit}</div>
                  )}
                </div>
              </div>

              <div className="bg-gradient-subtle rounded p-4 border border-border">
                <div className="text-base text-muted-foreground mb-2">最小值</div>
                <div className="flex items-baseline gap-2">
                  <div className="text-3xl text-foreground font-bold">
                    {statistics.min.toFixed(0)}
                  </div>
                  {indicator?.unit && (
                    <div className="text-base text-muted-foreground">{indicator.unit}</div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 时间范围选择 */}
          <div className="px-6 mt-4">
            <div className="flex gap-2">
              {[7, 30, 90].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDays(d)}
                  className={`px-4 py-2 rounded text-base ${
                    days === d
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-card border-2 border-border text-foreground'
                  }`}>
                  {d}天
                </button>
              ))}
            </div>
          </div>

          {/* 数据列表 */}
          <div className="px-6 mt-4">
            <div className="text-xl text-foreground font-bold mb-3">历史数据</div>

            {historyData.length === 0 ? (
              <div className="text-center py-12">
                <div className="i-mdi-chart-line-variant text-6xl text-muted-foreground mb-4" />
                <div className="text-xl text-muted-foreground">暂无历史数据</div>
              </div>
            ) : (
              <div className="space-y-2">
                {historyData
                  .slice()
                  .reverse()
                  .map((item) => (
                    <div
                      key={item.id}
                      className="bg-card rounded p-4 border border-border flex items-center justify-between">
                      <div>
                        <div className="text-xl text-foreground font-bold">
                          {item.value.toFixed(0)} {indicator?.unit}
                        </div>
                        <div className="text-base text-muted-foreground mt-1">
                          {new Date(item.date).toLocaleDateString('zh-CN', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })}
                        </div>
                      </div>

                      {indicator?.target_value && (
                        <div
                          className={`text-xl font-bold ${
                            item.value >= indicator.target_value
                              ? 'text-success'
                              : item.value >= (indicator.warning_threshold || 0)
                                ? 'text-warning'
                                : 'text-destructive'
                          }`}>
                          {((item.value / indicator.target_value) * 100).toFixed(0)}%
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

export default withRouteGuard(KPIDetailPage)
