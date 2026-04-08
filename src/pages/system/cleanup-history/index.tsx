import {useCallback, useEffect, useState} from 'react'
import Taro from '@tarojs/taro'
import {supabase} from '@/client/supabase'
import {useAuth} from '@/contexts/AuthContext'

/**
 * 清理日志类型
 */
interface CleanupLog {
  id: string
  cleaned_at: string
  orphan_count: number
  cleaned_user_ids: string[]
  trigger_type: 'auto' | 'manual'
  status: 'success' | 'failed' | 'partial'
  error_message: string | null
  execution_time_ms: number
  created_at: string
}

/**
 * 清理历史页面
 * 
 * 功能：
 * - 展示cleanup_logs表中的所有清理记录
 * - 显示清理时间、数量、触发类型、状态等信息
 * - 支持查看清理的用户ID列表
 * - 支持筛选（按触发类型、状态）
 * - 支持刷新
 */
export default function CleanupHistory() {
  const {profile} = useAuth()
  const [logs, setLogs] = useState<CleanupLog[]>([])
  const [loading, setLoading] = useState(true)
  const [filterType, setFilterType] = useState<'all' | 'auto' | 'manual'>('all')
  const [filterStatus, setFilterStatus] = useState<'all' | 'success' | 'failed' | 'partial'>('all')

  /**
   * 加载清理日志
   */
  const loadLogs = useCallback(async () => {
    try {
      setLoading(true)

      let query = supabase
        .from('cleanup_logs')
        .select('*')
        .order('cleaned_at', {ascending: false})
        .limit(50)

      // 应用筛选条件
      if (filterType !== 'all') {
        query = query.eq('trigger_type', filterType)
      }
      if (filterStatus !== 'all') {
        query = query.eq('status', filterStatus)
      }

      const {data, error} = await query

      if (error) {
        throw error
      }

      setLogs(data || [])
    } catch (error) {
      console.error('加载清理日志失败:', error)
      Taro.showToast({
        title: '加载失败',
        icon: 'none'
      })
    } finally {
      setLoading(false)
    }
  }, [filterType, filterStatus])

  useEffect(() => {
    loadLogs()
  }, [loadLogs])

  /**
   * 刷新数据
   */
  const handleRefresh = () => {
    loadLogs()
  }

  /**
   * 查看清理详情
   */
  const handleViewDetail = (log: CleanupLog) => {
    const userIdList = log.cleaned_user_ids.join('\n')
    const content = `清理时间：${new Date(log.cleaned_at).toLocaleString('zh-CN')}\n清理数量：${log.orphan_count}\n触发类型：${log.trigger_type === 'auto' ? '自动' : '手动'}\n执行状态：${log.status === 'success' ? '成功' : log.status === 'failed' ? '失败' : '部分成功'}\n执行耗时：${log.execution_time_ms}ms\n\n清理的用户ID：\n${userIdList || '无'}\n\n${log.error_message ? `错误信息：\n${log.error_message}` : ''}`

    Taro.showModal({
      title: '清理详情',
      content: content,
      showCancel: false,
      confirmText: '关闭'
    })
  }

  /**
   * 格式化时间
   */
  const formatTime = (time: string) => {
    const date = new Date(time)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))

    if (days === 0) {
      return '今天 ' + date.toLocaleTimeString('zh-CN', {hour: '2-digit', minute: '2-digit'})
    } else if (days === 1) {
      return '昨天 ' + date.toLocaleTimeString('zh-CN', {hour: '2-digit', minute: '2-digit'})
    } else if (days < 7) {
      return `${days}天前`
    } else {
      return date.toLocaleDateString('zh-CN', {month: '2-digit', day: '2-digit'})
    }
  }

  /**
   * 获取状态颜色
   */
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'text-green-600'
      case 'failed':
        return 'text-red-600'
      case 'partial':
        return 'text-yellow-600'
      default:
        return 'text-muted-foreground'
    }
  }

  /**
   * 获取状态文本
   */
  const getStatusText = (status: string) => {
    switch (status) {
      case 'success':
        return '成功'
      case 'failed':
        return '失败'
      case 'partial':
        return '部分成功'
      default:
        return '未知'
    }
  }

  // 权限检查
  if (!profile || profile.role !== 'system_admin') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6">
        <div className="text-center">
          <div className="i-mdi-lock text-6xl text-muted-foreground mb-4" />
          <div className="text-2xl text-foreground mb-2">无权限访问</div>
          <div className="text-base text-muted-foreground">仅系统管理员可访问此页面</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* 筛选区域 */}
      <div className="bg-card px-6 py-4 mb-2">
        <div className="flex flex-col gap-3">
          {/* 触发类型筛选 */}
          <div>
            <div className="text-sm text-muted-foreground mb-2">触发类型</div>
            <div className="flex gap-2">
              <button
                type="button"
                className={`flex-1 px-4 py-2 rounded-lg text-base transition-colors ${
                  filterType === 'all'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground'
                }`}
                onClick={() => setFilterType('all')}
              >
                全部
              </button>
              <button
                type="button"
                className={`flex-1 px-4 py-2 rounded-lg text-base transition-colors ${
                  filterType === 'auto'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground'
                }`}
                onClick={() => setFilterType('auto')}
              >
                自动
              </button>
              <button
                type="button"
                className={`flex-1 px-4 py-2 rounded-lg text-base transition-colors ${
                  filterType === 'manual'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground'
                }`}
                onClick={() => setFilterType('manual')}
              >
                手动
              </button>
            </div>
          </div>

          {/* 状态筛选 */}
          <div>
            <div className="text-sm text-muted-foreground mb-2">执行状态</div>
            <div className="flex gap-2">
              <button
                type="button"
                className={`flex-1 px-4 py-2 rounded-lg text-base transition-colors ${
                  filterStatus === 'all'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground'
                }`}
                onClick={() => setFilterStatus('all')}
              >
                全部
              </button>
              <button
                type="button"
                className={`flex-1 px-4 py-2 rounded-lg text-base transition-colors ${
                  filterStatus === 'success'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground'
                }`}
                onClick={() => setFilterStatus('success')}
              >
                成功
              </button>
              <button
                type="button"
                className={`flex-1 px-4 py-2 rounded-lg text-base transition-colors ${
                  filterStatus === 'partial'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground'
                }`}
                onClick={() => setFilterStatus('partial')}
              >
                部分
              </button>
              <button
                type="button"
                className={`flex-1 px-4 py-2 rounded-lg text-base transition-colors ${
                  filterStatus === 'failed'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground'
                }`}
                onClick={() => setFilterStatus('failed')}
              >
                失败
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 刷新按钮 */}
      <div className="px-6 py-3 flex justify-end">
        <button
          type="button"
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-base"
          onClick={handleRefresh}
        >
          <div className="i-mdi-refresh text-xl" />
          <span>刷新</span>
        </button>
      </div>

      {/* 日志列表 */}
      <div className="px-6 pb-6">
        {loading ? (
          <div className="text-center py-12">
            <div className="text-base text-muted-foreground">加载中...</div>
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-12">
            <div className="i-mdi-inbox text-6xl text-muted-foreground mb-4" />
            <div className="text-base text-muted-foreground">暂无清理记录</div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {logs.map((log) => (
              <div
                key={log.id}
                className="bg-card rounded-lg p-4 border border-border"
                onClick={() => handleViewDetail(log)}
              >
                {/* 头部：时间和状态 */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="i-mdi-clock-outline text-xl text-muted-foreground" />
                    <span className="text-base text-foreground">{formatTime(log.cleaned_at)}</span>
                  </div>
                  <div className={`text-base font-medium ${getStatusColor(log.status)}`}>
                    {getStatusText(log.status)}
                  </div>
                </div>

                {/* 内容：清理数量和触发类型 */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="i-mdi-delete-outline text-xl text-muted-foreground" />
                    <span className="text-base text-foreground">清理数量：{log.orphan_count}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div
                      className={`i-mdi-${log.trigger_type === 'auto' ? 'robot' : 'account'} text-xl text-muted-foreground`}
                    />
                    <span className="text-sm text-muted-foreground">
                      {log.trigger_type === 'auto' ? '自动' : '手动'}
                    </span>
                  </div>
                </div>

                {/* 底部：执行耗时 */}
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <div className="i-mdi-timer-outline text-lg" />
                  <span>执行耗时：{log.execution_time_ms}ms</span>
                </div>

                {/* 错误信息（如果有） */}
                {log.error_message && (
                  <div className="mt-3 pt-3 border-t border-border">
                    <div className="flex items-start gap-2">
                      <div className="i-mdi-alert-circle text-lg text-red-600 mt-0.5" />
                      <div className="flex-1 text-sm text-red-600 break-all">
                        {log.error_message.length > 100
                          ? log.error_message.substring(0, 100) + '...'
                          : log.error_message}
                      </div>
                    </div>
                  </div>
                )}

                {/* 查看详情提示 */}
                <div className="mt-3 pt-3 border-t border-border flex items-center justify-center gap-1 text-sm text-primary">
                  <span>点击查看详情</span>
                  <div className="i-mdi-chevron-right text-lg" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
