import {useState, useEffect, useMemo, useCallback} from 'react'
import Taro from '@tarojs/taro'
import {withRouteGuard} from '@/components/RouteGuard'
import {useAuth} from '@/contexts/AuthContext'
import {getTaskById, getTaskProgressUpdates, createTaskProgressUpdate, confirmTaskCompletion} from '@/db/api'
import type {Task} from '@/db/types'

interface TaskProgressUpdate {
  id: string
  task_id: string
  updated_by: string
  progress: number
  is_completed: boolean
  note: string | null
  created_at: string
  profiles?: {name: string}
}

function TasksDetailPage() {
  const {profile} = useAuth()
  const [loading, setLoading] = useState(true)
  const [task, setTask] = useState<Task | null>(null)
  const [progressUpdates, setProgressUpdates] = useState<TaskProgressUpdate[]>([])
  const [showUpdateModal, setShowUpdateModal] = useState(false)
  const [newProgress, setNewProgress] = useState(0)
  const [isCompleted, setIsCompleted] = useState(false)
  const [progressNote, setProgressNote] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const taskId = useMemo(() => {
    const instance = Taro.getCurrentInstance()
    return instance.router?.params?.id || ''
  }, [])

  const loadTaskData = useCallback(async () => {
    if (!taskId) return

    setLoading(true)
    try {
      const taskData = await getTaskById(taskId)
      if (taskData) {
        setTask(taskData as Task)
        setNewProgress(taskData.progress || 0)
      } else {
        Taro.showToast({title: '任务不存在', icon: 'none'})
        setTimeout(() => Taro.navigateBack(), 1500)
        return
      }

      // 加载进度更新记录
      const updates = await getTaskProgressUpdates(taskId)
      setProgressUpdates(updates as TaskProgressUpdate[])
    } catch (error) {
      console.error('加载任务失败:', error)
      Taro.showToast({title: '加载失败', icon: 'none'})
    } finally {
      setLoading(false)
    }
  }, [taskId])

  useEffect(() => {
    loadTaskData()
  }, [loadTaskData])

  const handleUpdateProgress = async () => {
    if (!task || !profile) return

    setSubmitting(true)
    try {
      await createTaskProgressUpdate({
        task_id: task.id,
        updated_by: profile.id as string,
        progress: newProgress,
        is_completed: isCompleted,
        note: progressNote || null
      })

      Taro.showToast({title: '进度更新成功', icon: 'success'})
      setShowUpdateModal(false)
      setProgressNote('')
      setIsCompleted(false)
      
      // 重新加载数据
      await loadTaskData()
    } catch (error) {
      console.error('更新进度失败:', error)
      Taro.showToast({title: '更新失败', icon: 'none'})
    } finally {
      setSubmitting(false)
    }
  }

  const handleConfirmCompletion = async () => {
    if (!task || !profile) return

    try {
      const result = await Taro.showModal({
        title: '确认完成',
        content: '确认该任务已完成？',
        confirmText: '确认',
        cancelText: '取消'
      })

      if (!result.confirm) return

      await confirmTaskCompletion(task.id, profile.id as string)
      Taro.showToast({title: '已确认完成', icon: 'success'})
      
      // 重新加载数据
      await loadTaskData()
    } catch (error) {
      console.error('确认完成失败:', error)
      Taro.showToast({title: '操作失败', icon: 'none'})
    }
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
      pending: 'text-muted-foreground',
      in_progress: 'text-primary',
      completed: 'text-success',
      overdue: 'text-destructive'
    }
    return colors[status] || 'text-foreground'
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-xl text-muted-foreground">加载中...</div>
      </div>
    )
  }

  if (!task) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6">
        <div className="text-center">
          <div className="i-mdi-alert-circle text-6xl text-warning mb-4" />
          <div className="text-2xl text-foreground">任务不存在</div>
        </div>
      </div>
    )
  }

  const isResponsible = profile?.id === task.responsible_person_id
  const isAssigner = profile?.id === task.assigned_by
  const canUpdateProgress = isResponsible && task.status !== 'completed'
  const canConfirmCompletion = isAssigner && !task.confirmed_completed

  return (
    <div className="min-h-screen bg-background pb-6">
      {/* 头部 */}
      <div className="bg-gradient-primary px-6 py-6">
        <div className="text-2xl text-primary-foreground font-bold">{task.name}</div>
        <div className="flex items-center gap-3 mt-2">
          <div className={`px-3 py-1 rounded text-base bg-primary-foreground/20 ${getPriorityColor(task.priority)}`}>
            优先级：{getPriorityLabel(task.priority)}
          </div>
          <div className={`px-3 py-1 rounded text-base bg-primary-foreground/20 ${getStatusColor(task.status)}`}>
            {getStatusLabel(task.status)}
          </div>
          {task.confirmed_completed && (
            <div className="px-3 py-1 rounded text-base bg-success/20 text-success">
              已确认完成
            </div>
          )}
        </div>
      </div>

      {/* 任务详情 */}
      <div className="px-6 py-6 flex flex-col gap-6">
        {/* 基本信息 */}
        <div className="bg-card rounded p-4 border border-border">
          <div className="text-xl text-foreground font-bold mb-4">基本信息</div>
          
          <div className="flex flex-col gap-3">
            <div className="flex items-start">
              <div className="text-base text-muted-foreground w-24">任务类型</div>
              <div className="flex-1 text-base text-foreground">{task.type}</div>
            </div>
            
            <div className="flex items-start">
              <div className="text-base text-muted-foreground w-24">指派人</div>
              <div className="flex-1 text-base text-foreground">
                {(task as any).profiles?.name || task.assigned_by}
              </div>
            </div>
            
            <div className="flex items-start">
              <div className="text-base text-muted-foreground w-24">责任人</div>
              <div className="flex-1 text-base text-foreground">{task.responsible_person_id}</div>
            </div>
            
            <div className="flex items-start">
              <div className="text-base text-muted-foreground w-24">截止时间</div>
              <div className="flex-1 text-base text-foreground">
                {new Date(task.deadline).toLocaleDateString()}
              </div>
            </div>
            
            <div className="flex items-start">
              <div className="text-base text-muted-foreground w-24">完成进度</div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary"
                      style={{width: `${task.progress}%`}}
                    />
                  </div>
                  <div className="text-base text-foreground">{task.progress}%</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 任务描述 */}
        <div className="bg-card rounded p-4 border border-border">
          <div className="text-xl text-foreground font-bold mb-3">任务描述</div>
          <div className="text-base text-foreground whitespace-pre-wrap">
            {task.description || '暂无描述'}
          </div>
        </div>

        {/* 进度更新记录 */}
        {progressUpdates.length > 0 && (
          <div className="bg-card rounded p-4 border border-border">
            <div className="text-xl text-foreground font-bold mb-3">进度更新记录</div>
            <div className="flex flex-col gap-3">
              {progressUpdates.map((update) => (
                <div key={update.id} className="border-l-4 border-primary pl-4 py-2">
                  <div className="flex items-center justify-between mb-1">
                    <div className="text-base text-foreground font-bold">
                      进度：{update.progress}%
                      {update.is_completed && (
                        <span className="ml-2 px-2 py-1 bg-success/20 text-success text-sm rounded">
                          标记完成
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {new Date(update.created_at).toLocaleString()}
                    </div>
                  </div>
                  <div className="text-base text-muted-foreground mb-1">
                    更新人：{update.profiles?.name || update.updated_by}
                  </div>
                  {update.note && (
                    <div className="text-base text-foreground mt-2">
                      {update.note}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 完成备注 */}
        {task.completion_note && (
          <div className="bg-card rounded p-4 border border-border">
            <div className="text-xl text-foreground font-bold mb-3">完成备注</div>
            <div className="text-base text-foreground whitespace-pre-wrap">
              {task.completion_note}
            </div>
          </div>
        )}

        {/* 操作按钮 */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => Taro.navigateBack()}
            className="flex-1 py-4 bg-card border-2 border-border text-foreground text-xl rounded flex items-center justify-center leading-none">
            返回
          </button>
          {canUpdateProgress && (
            <button
              type="button"
              onClick={() => setShowUpdateModal(true)}
              className="flex-1 py-4 bg-primary text-primary-foreground text-xl rounded flex items-center justify-center leading-none">
              更新进度
            </button>
          )}
          {canConfirmCompletion && (
            <button
              type="button"
              onClick={handleConfirmCompletion}
              className="flex-1 py-4 bg-success text-white text-xl rounded flex items-center justify-center leading-none">
              确认完成
            </button>
          )}
        </div>
      </div>

      {/* 更新进度弹窗 */}
      {showUpdateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-6">
          <div className="bg-background rounded-lg w-full max-w-md">
            <div className="px-6 py-4 border-b border-border">
              <div className="text-2xl text-foreground font-bold">更新任务进度</div>
            </div>
            <div className="px-6 py-4 flex flex-col gap-4">
              {/* 进度滑块 */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="text-base text-foreground">完成进度</div>
                  <div className="text-xl text-primary font-bold">{newProgress}%</div>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={newProgress}
                  onChange={(e) => {
                    const ev = e as unknown
                    const value = parseInt(
                      (ev as {target?: {value?: string}}).target?.value ?? '0'
                    )
                    setNewProgress(value)
                  }}
                  className="w-full"
                />
              </div>

              {/* 是否完成 */}
              <div className="flex items-center gap-3">
                <div
                  onClick={() => setIsCompleted(!isCompleted)}
                  className={`w-6 h-6 rounded border-2 flex items-center justify-center ${
                    isCompleted ? 'bg-primary border-primary' : 'border-input'
                  }`}>
                  {isCompleted && <div className="i-mdi-check text-primary-foreground text-xl" />}
                </div>
                <div className="text-base text-foreground">标记为完成</div>
              </div>

              {/* 进度备注 */}
              <div>
                <div className="text-base text-foreground mb-2">进度备注</div>
                <div className="border-2 border-input rounded px-4 py-3 bg-card">
                  <textarea
                    value={progressNote}
                    onInput={(e) => {
                      const ev = e as unknown
                      setProgressNote(
                        (ev as {detail?: {value?: string}}).detail?.value ??
                          (ev as {target?: {value?: string}}).target?.value ??
                          ''
                      )
                    }}
                    placeholder="请描述本次进度更新的内容"
                    className="w-full text-base text-foreground bg-transparent outline-none"
                    style={{minHeight: '100px'}}
                  />
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-border flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowUpdateModal(false)
                  setProgressNote('')
                  setIsCompleted(false)
                }}
                disabled={submitting}
                className="flex-1 py-3 bg-card border-2 border-border text-foreground text-xl rounded flex items-center justify-center leading-none">
                取消
              </button>
              <button
                type="button"
                onClick={handleUpdateProgress}
                disabled={submitting}
                className="flex-1 py-3 bg-primary text-primary-foreground text-xl rounded flex items-center justify-center leading-none">
                {submitting ? '提交中...' : '确认更新'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default withRouteGuard(TasksDetailPage)
