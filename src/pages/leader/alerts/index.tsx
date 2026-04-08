import {useState, useCallback, useEffect} from 'react'
import Taro from '@tarojs/taro'
import {withRouteGuard} from '@/components/RouteGuard'
import {getUnreadAlerts, markAlertAsRead, markAllAlertsAsRead} from '@/db/leaderDashboard'
import type {ReportAlert} from '@/db/types'

function AlertsPage() {
  const [alerts, setAlerts] = useState<ReportAlert[]>([])
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      const data = await getUnreadAlerts()
      setAlerts(data)
    } catch (error) {
      console.error('加载预警失败:', error)
      Taro.showToast({title: '加载失败', icon: 'none'})
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  // 标记单个预警为已读
  const handleMarkAsRead = async (alertId: string) => {
    try {
      await markAlertAsRead(alertId)
      Taro.showToast({title: '已标记', icon: 'success', duration: 1500})
      loadData()
    } catch (error) {
      console.error('标记失败:', error)
      Taro.showToast({title: '操作失败', icon: 'none'})
    }
  }

  // 标记所有预警为已读
  const handleMarkAllAsRead = async () => {
    const result = await Taro.showModal({
      title: '确认操作',
      content: '确定要标记所有预警为已读吗？'
    })

    if (!result.confirm) return

    try {
      await markAllAlertsAsRead()
      Taro.showToast({title: '全部已标记', icon: 'success'})
      loadData()
    } catch (error) {
      console.error('批量标记失败:', error)
      Taro.showToast({title: '操作失败', icon: 'none'})
    }
  }

  // 获取预警类型图标
  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'threshold':
        return 'i-mdi-alert-circle'
      case 'anomaly':
        return 'i-mdi-alert-octagon'
      case 'warning':
        return 'i-mdi-alert'
      default:
        return 'i-mdi-information'
    }
  }

  return (
    <div className="min-h-screen bg-background pb-6">
      {/* 头部 */}
      <div className="bg-gradient-primary px-6 py-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-2xl text-primary-foreground font-bold">预警中心</div>
            <div className="text-base text-primary-foreground/80 mt-1">
              {alerts.length} 条未读预警
            </div>
          </div>
          {alerts.length > 0 && (
            <button
              type="button"
              onClick={handleMarkAllAsRead}
              className="px-4 py-2 bg-primary-foreground text-primary text-base rounded flex items-center justify-center leading-none">
              全部已读
            </button>
          )}
        </div>
      </div>

      {/* 预警列表 */}
      {loading ? (
        <div className="text-center py-12">
          <div className="text-xl text-muted-foreground">加载中...</div>
        </div>
      ) : alerts.length === 0 ? (
        <div className="text-center py-12">
          <div className="i-mdi-check-circle text-6xl text-success mb-4" />
          <div className="text-xl text-foreground">暂无预警</div>
          <div className="text-base text-muted-foreground mt-2">所有指标运行正常</div>
        </div>
      ) : (
        <div className="px-6 mt-4 space-y-3">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className="bg-card rounded p-4 border-2 border-destructive/30 relative">
              {/* 预警类型标识 */}
              <div className="absolute top-4 right-4">
                <div className={`${getAlertIcon(alert.alert_type)} text-2xl text-destructive`} />
              </div>

              {/* 预警信息 */}
              <div className="pr-10">
                <div className="text-xl text-foreground font-bold mb-2">{alert.message}</div>

                <div className="space-y-1 mb-3">
                  {alert.current_value !== null && (
                    <div className="text-base text-muted-foreground">
                      当前值: <span className="text-destructive font-bold">{alert.current_value}</span>
                    </div>
                  )}
                  {alert.threshold !== null && (
                    <div className="text-base text-muted-foreground">
                      阈值: {alert.threshold}
                    </div>
                  )}
                  <div className="text-sm text-muted-foreground">
                    {new Date(alert.triggered_at).toLocaleString('zh-CN')}
                  </div>
                </div>

                {/* 操作按钮 */}
                <button
                  type="button"
                  onClick={() => handleMarkAsRead(alert.id)}
                  className="px-4 py-2 bg-primary text-primary-foreground text-base rounded flex items-center justify-center leading-none">
                  标记已读
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default withRouteGuard(AlertsPage)
