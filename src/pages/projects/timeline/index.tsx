import {useState, useEffect, useMemo, useCallback} from 'react'
import Taro from '@tarojs/taro'
import {withRouteGuard} from '@/components/RouteGuard'
import {getAllProjects, getProjectTrackingRecords} from '@/db/api'

function ProjectTimeline() {
  const [projects, setProjects] = useState<any[]>([])
  const [trackingRecords, setTrackingRecords] = useState<Record<string, any[]>>({})
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      const projectsData = await getAllProjects()
      setProjects(Array.isArray(projectsData) ? projectsData : [])

      // 加载所有项目的跟踪记录
      const records: Record<string, any[]> = {}
      await Promise.all(
        projectsData.map(async (project: any) => {
          const projectRecords = await getProjectTrackingRecords(project.id)
          records[project.id] = projectRecords
        })
      )
      setTrackingRecords(records)
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

  // 构建时间轴事件列表
  const timelineEvents = useMemo(() => {
    const events: Array<{
      date: Date
      type: 'create' | 'stage' | 'tracking'
      project: any
      content: string
    }> = []

    projects.forEach((project) => {
      // 项目创建事件
      events.push({
        date: new Date(project.created_at),
        type: 'create',
        project,
        content: `创建项目`
      })

      // 跟踪记录事件
      const records = trackingRecords[project.id] || []
      records.forEach((record) => {
        events.push({
          date: new Date(record.created_at),
          type: 'tracking',
          project,
          content: record.content || '更新跟踪记录'
        })
      })
    })

    // 按时间倒序排序
    return events.sort((a, b) => b.date.getTime() - a.date.getTime())
  }, [projects, trackingRecords])

  // 按月份分组
  const groupedEvents = useMemo(() => {
    const groups: Record<string, typeof timelineEvents> = {}

    timelineEvents.forEach((event) => {
      const month = event.date.toLocaleDateString('zh-CN', {year: 'numeric', month: '2-digit'})
      if (!groups[month]) {
        groups[month] = []
      }
      groups[month].push(event)
    })

    return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a))
  }, [timelineEvents])

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'create':
        return 'i-mdi-plus-circle'
      case 'stage':
        return 'i-mdi-arrow-right-circle'
      case 'tracking':
        return 'i-mdi-update'
      default:
        return 'i-mdi-circle'
    }
  }

  const getEventColor = (type: string) => {
    switch (type) {
      case 'create':
        return 'text-primary'
      case 'stage':
        return 'text-success'
      case 'tracking':
        return 'text-info'
      default:
        return 'text-muted-foreground'
    }
  }

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
          <div className="text-2xl text-primary-foreground font-bold">项目时间轴</div>
          <button
            type="button"
            onClick={() => Taro.navigateBack()}
            className="px-4 py-2 bg-primary-foreground/20 text-primary-foreground text-base rounded flex items-center gap-1 leading-none">
            <div className="i-mdi-arrow-left text-lg" />
            <span>返回</span>
          </button>
        </div>
        <div className="text-base text-primary-foreground/80">按时间顺序查看项目动态</div>
      </div>

      {/* 时间轴 */}
      <div className="px-6 py-4">
        {groupedEvents.map(([month, events]) => (
          <div key={month} className="mb-6">
            <div className="text-xl text-foreground font-bold mb-4 sticky top-0 bg-background py-2 z-10">{month}</div>
            <div className="relative">
              {/* 时间轴线 */}
              <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />

              {/* 事件列表 */}
              <div className="flex flex-col gap-4">
                {events.map((event, index) => (
                  <div key={index} className="flex gap-4">
                    {/* 时间轴节点 */}
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-background border-2 border-border flex items-center justify-center relative z-10">
                      <div className={`${getEventIcon(event.type)} text-lg ${getEventColor(event.type)}`} />
                    </div>

                    {/* 事件内容 */}
                    <div
                      onClick={() => Taro.navigateTo({url: `/pages/projects/detail/index?id=${event.project.id}`})}
                      className="flex-1 bg-card rounded p-4 border border-border">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="text-xl text-foreground font-bold mb-1">{event.project.name}</div>
                          <div className="text-base text-muted-foreground">
                            {event.date.toLocaleDateString('zh-CN', {
                              month: '2-digit',
                              day: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </div>
                        </div>
                        <span
                          className={`px-2 py-1 rounded text-base ${
                            event.type === 'create'
                              ? 'bg-primary/10 text-primary'
                              : event.type === 'stage'
                              ? 'bg-success/10 text-success'
                              : 'bg-info/10 text-info'
                          }`}>
                          {event.type === 'create' ? '创建' : event.type === 'stage' ? '阶段变更' : '跟踪记录'}
                        </span>
                      </div>
                      <div className="text-base text-foreground">{event.content}</div>
                      {event.project.stage && (
                        <div className="mt-2">
                          <span className="px-2 py-1 bg-muted text-muted-foreground text-base rounded">{event.project.stage}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}

        {groupedEvents.length === 0 && (
          <div className="text-center py-12">
            <div className="text-xl text-muted-foreground">暂无项目动态</div>
          </div>
        )}
      </div>
    </div>
  )
}

export default withRouteGuard(ProjectTimeline)
