import {useCallback, useEffect, useState} from 'react'
import {isAdmin, isLeaderOrAdmin} from '@/db/permissions-utils'
import Taro, {useDidShow} from '@tarojs/taro'
import {withRouteGuard} from '@/components/RouteGuard'
import {useAuth} from '@/contexts/AuthContext'
import {getMyTasks} from '@/db/api'
import type {Task} from '@/db/types'

function TasksPage() {
  const {profile} = useAuth()
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('all')

  const loadData = useCallback(async () => {
    if (!profile) return

    try {
      setLoading(true)
      const tasksData = await getMyTasks(profile.id as string)
      setTasks(Array.isArray(tasksData) ? tasksData : [])
    } catch (error) {
      console.error('加载任务失败:', error)
      Taro.showToast({title: '加载失败', icon: 'none'})
    } finally {
      setLoading(false)
    }
  }, [profile])

  useDidShow(() => {
    loadData()
  })

  useEffect(() => {
    loadData()
  }, [loadData])

  // 筛选任务
  const filteredTasks = tasks.filter((task) => {
    if (statusFilter === 'all') return true
    return task.status === statusFilter
  })

  // 按状态排序：待执行 > 进行中 > 已完成 > 已逾期
  const sortedTasks = [...filteredTasks].sort((a, b) => {
    const statusOrder: Record<string, number> = {
      pending: 1,
      in_progress: 2,
      completed: 3,
      overdue: 4
    }
    return (statusOrder[a.status] || 999) - (statusOrder[b.status] || 999)
  })

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      pending: '待执行',
      in_progress: '进行中',
      completed: '已完成',
      overdue: '已逾期'
    }
    return labels[status] || status
  }

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-warning/10 text-warning border-warning/30',
      in_progress: 'bg-primary/10 text-primary border-primary/30',
      completed: 'bg-success/10 text-success border-success/30',
      overdue: 'bg-destructive/10 text-destructive border-destructive/30'
    }
    return colors[status] || 'bg-muted text-muted-foreground border-border'
  }

  const getPriorityLabel = (priority: string) => {
    const labels: Record<string, string> = {
      high: '高',
      medium: '中',
      low: '低'
    }
    return labels[priority] || priority
  }

  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      high: 'text-destructive',
      medium: 'text-warning',
      low: 'text-success'
    }
    return colors[priority] || 'text-foreground'
  }

  const handleViewTask = (id: string) => {
    Taro.navigateTo({url: `/pages/tasks/detail/index?id=${id}`})
  }

  // 统计各状态任务数量
  const stats = {
    all: tasks.length,
    pending: tasks.filter((t) => t.status === 'pending').length,
    in_progress: tasks.filter((t) => t.status === 'in_progress').length,
    completed: tasks.filter((t) => t.status === 'completed').length,
    overdue: tasks.filter((t) => t.status === 'overdue').length
  }

  return (
    <div className="min-h-screen bg-background pb-6">
      {/* 头部 */}
      <div className="bg-gradient-primary px-6 py-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-2xl text-primary-foreground font-bold">我的任务</div>
            <div className="text-base text-primary-foreground/80 mt-1">任务管理与进度跟踪</div>
          </div>
          {/* 指派任务入口 */}
          {isLeaderOrAdmin(profile) && (
            <button
              type="button"
              onClick={() => Taro.navigateTo({url: '/pages/tasks/assign/index'})}
              className="px-4 py-3 bg-primary-foreground text-primary text-xl rounded flex items-center justify-center leading-none gap-2">
              <div className="i-mdi-account-arrow-right text-2xl" />
              <span>指派任务</span>
            </button>
          )}
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="px-6 mt-4">
        <div className="grid grid-cols-3 gap-3">
          <div
            onClick={() => setStatusFilter('pending')}
            className={`bg-gradient-subtle rounded p-4 flex flex-col items-center ${
              statusFilter === 'pending' ? 'border-2 border-warning' : ''
            }`}>
            <div className="text-3xl text-warning font-bold">{stats.pending}</div>
            <div className="text-base text-muted-foreground mt-1">待执行</div>
          </div>
          <div
            onClick={() => setStatusFilter('in_progress')}
            className={`bg-gradient-subtle rounded p-4 flex flex-col items-center ${
              statusFilter === 'in_progress' ? 'border-2 border-primary' : ''
            }`}>
            <div className="text-3xl text-primary font-bold">{stats.in_progress}</div>
            <div className="text-base text-muted-foreground mt-1">进行中</div>
          </div>
          <div
            onClick={() => setStatusFilter('completed')}
            className={`bg-gradient-subtle rounded p-4 flex flex-col items-center ${
              statusFilter === 'completed' ? 'border-2 border-success' : ''
            }`}>
            <div className="text-3xl text-success font-bold">{stats.completed}</div>
            <div className="text-base text-muted-foreground mt-1">已完成</div>
          </div>
        </div>
      </div>

      {/* 筛选按钮 */}
      <div className="px-6 mt-4">
        <div className="flex gap-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`px-4 py-2 rounded text-base whitespace-nowrap ${
              statusFilter === 'all'
                ? 'bg-primary text-primary-foreground'
                : 'bg-card text-foreground border border-border'
            }`}>
            全部 ({stats.all})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('pending')}
            className={`px-4 py-2 rounded text-base whitespace-nowrap ${
              statusFilter === 'pending'
                ? 'bg-warning text-white'
                : 'bg-card text-foreground border border-border'
            }`}>
            待执行 ({stats.pending})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('in_progress')}
            className={`px-4 py-2 rounded text-base whitespace-nowrap ${
              statusFilter === 'in_progress'
                ? 'bg-primary text-primary-foreground'
                : 'bg-card text-foreground border border-border'
            }`}>
            进行中 ({stats.in_progress})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('completed')}
            className={`px-4 py-2 rounded text-base whitespace-nowrap ${
              statusFilter === 'completed'
                ? 'bg-success text-white'
                : 'bg-card text-foreground border border-border'
            }`}>
            已完成 ({stats.completed})
          </button>
          {stats.overdue > 0 && (
            <button
              type="button"
              onClick={() => setStatusFilter('overdue')}
              className={`px-4 py-2 rounded text-base whitespace-nowrap ${
                statusFilter === 'overdue'
                  ? 'bg-destructive text-destructive-foreground'
                  : 'bg-card text-foreground border border-border'
              }`}>
              已逾期 ({stats.overdue})
            </button>
          )}
        </div>
      </div>

      {/* 任务列表 */}
      <div className="px-6 mt-4">
        {loading ? (
          <div className="text-center py-12">
            <div className="text-xl text-muted-foreground">加载中...</div>
          </div>
        ) : sortedTasks.length === 0 ? (
          <div className="bg-card rounded p-12 flex flex-col items-center">
            <div className="i-mdi-clipboard-check-outline text-[100px] text-muted-foreground" />
            <div className="text-xl text-muted-foreground mt-4">暂无任务</div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {sortedTasks.map((task) => (
              <div
                key={task.id}
                onClick={() => handleViewTask(task.id)}
                className="bg-card rounded p-4 border border-border">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="text-xl text-foreground font-bold mb-2">{task.name}</div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className={`px-3 py-1 rounded text-base border ${getStatusColor(task.status)}`}>
                        {getStatusLabel(task.status)}
                      </div>
                      <div className={`px-3 py-1 rounded text-base ${getPriorityColor(task.priority)}`}>
                        优先级: {getPriorityLabel(task.priority)}
                      </div>
                    </div>
                  </div>
                </div>
                {task.description && (
                  <div className="text-base text-muted-foreground mb-2 line-clamp-2">{task.description}</div>
                )}
                <div className="flex items-center justify-between text-base text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <div className="i-mdi-account text-lg" />
                    <span>指派人: {task.assigned_by || '未知'}</span>
                  </div>
                  {task.deadline && (
                    <div className="flex items-center gap-1">
                      <div className="i-mdi-calendar text-lg" />
                      <span>{new Date(task.deadline).toLocaleDateString()}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default withRouteGuard(TasksPage)
