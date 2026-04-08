import {useState, useCallback, useEffect} from 'react'
import Taro, {useDidShow} from '@tarojs/taro'
import {withRouteGuard} from '@/components/RouteGuard'
import {useAuth} from '@/contexts/AuthContext'
import {getUserNotifications, markNotificationAsRead, markAllNotificationsAsRead} from '@/db/api'

interface Notification {
  id: string
  task_id: string
  notification_type: string
  title: string
  content: string
  is_read: boolean
  created_at: string
  tasks?: {name: string}
}

function NotificationsPage() {
  const {profile} = useAuth()
  const [loading, setLoading] = useState(true)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [filterUnread, setFilterUnread] = useState(false)

  const loadNotifications = useCallback(async () => {
    if (!profile) return

    setLoading(true)
    try {
      const data = await getUserNotifications(profile.id as string, filterUnread)
      setNotifications(data as Notification[])
    } catch (error) {
      console.error('加载通知失败:', error)
      Taro.showToast({title: '加载失败', icon: 'none'})
    } finally {
      setLoading(false)
    }
  }, [profile, filterUnread])

  useDidShow(() => {
    loadNotifications()
  })

  useEffect(() => {
    loadNotifications()
  }, [loadNotifications])

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      await markNotificationAsRead(notificationId)
      loadNotifications()
    } catch (error) {
      console.error('标记已读失败:', error)
      Taro.showToast({title: '操作失败', icon: 'none'})
    }
  }

  const handleMarkAllAsRead = async () => {
    if (!profile) return

    try {
      await markAllNotificationsAsRead(profile.id as string)
      Taro.showToast({title: '已全部标记为已读', icon: 'success'})
      loadNotifications()
    } catch (error) {
      console.error('标记失败:', error)
      Taro.showToast({title: '操作失败', icon: 'none'})
    }
  }

  const handleViewTask = (taskId: string, notificationId: string, isRead: boolean) => {
    if (!isRead) {
      handleMarkAsRead(notificationId)
    }
    Taro.navigateTo({url: `/pages/tasks/detail/index?id=${taskId}`})
  }

  const getNotificationIcon = (type: string) => {
    const icons: Record<string, string> = {
      assigned: 'i-mdi-account-arrow-right',
      progress_update: 'i-mdi-chart-line',
      confirmed: 'i-mdi-check-circle',
      deadline_reminder: 'i-mdi-clock-alert'
    }
    return icons[type] || 'i-mdi-bell'
  }

  const getNotificationColor = (type: string) => {
    const colors: Record<string, string> = {
      assigned: 'text-primary',
      progress_update: 'text-success',
      confirmed: 'text-success',
      deadline_reminder: 'text-warning'
    }
    return colors[type] || 'text-muted-foreground'
  }

  const unreadCount = notifications.filter((n) => !n.is_read).length

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
        <div className="text-2xl text-primary-foreground font-bold">消息通知</div>
        <div className="text-base text-primary-foreground/80 mt-1">
          {unreadCount > 0 ? `${unreadCount}条未读消息` : '暂无未读消息'}
        </div>
      </div>

      {/* 操作栏 */}
      <div className="px-6 mt-4 flex items-center justify-between">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setFilterUnread(false)}
            className={`px-4 py-2 text-base rounded flex items-center justify-center leading-none ${
              !filterUnread ? 'bg-primary text-primary-foreground' : 'bg-card border border-border text-foreground'
            }`}>
            全部
          </button>
          <button
            type="button"
            onClick={() => setFilterUnread(true)}
            className={`px-4 py-2 text-base rounded flex items-center justify-center leading-none ${
              filterUnread ? 'bg-primary text-primary-foreground' : 'bg-card border border-border text-foreground'
            }`}>
            未读
          </button>
        </div>
        {unreadCount > 0 && (
          <button
            type="button"
            onClick={handleMarkAllAsRead}
            className="px-4 py-2 bg-card border border-border text-primary text-base rounded flex items-center justify-center leading-none">
            全部已读
          </button>
        )}
      </div>

      {/* 通知列表 */}
      <div className="px-6 mt-4">
        {notifications.length === 0 ? (
          <div className="text-center py-12">
            <div className="i-mdi-bell-off text-6xl text-muted-foreground mb-4" />
            <div className="text-xl text-muted-foreground">暂无通知</div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {notifications.map((notification) => (
              <div
                key={notification.id}
                onClick={() => handleViewTask(notification.task_id, notification.id, notification.is_read)}
                className={`bg-card rounded p-4 border ${
                  notification.is_read ? 'border-border' : 'border-primary'
                }`}>
                <div className="flex items-start gap-3">
                  <div className={`${getNotificationIcon(notification.notification_type)} text-3xl ${getNotificationColor(notification.notification_type)} mt-1`} />
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-xl text-foreground font-bold">{notification.title}</div>
                      {!notification.is_read && (
                        <div className="w-2 h-2 bg-primary rounded-full" />
                      )}
                    </div>
                    <div className="text-base text-foreground mb-2">{notification.content}</div>
                    <div className="text-sm text-muted-foreground">
                      {new Date(notification.created_at).toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default withRouteGuard(NotificationsPage)
