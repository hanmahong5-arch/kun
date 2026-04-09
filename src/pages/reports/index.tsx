import {useCallback, useEffect, useState} from 'react'
import Taro, {useDidShow} from '@tarojs/taro'
import {withRouteGuard} from '@/components/RouteGuard'
import {useAuth} from '@/contexts/AuthContext'
import {supabase} from '@/client/supabase'
import {getMyWeeklyReports, getAllWeeklyReports, getMyTasks} from '@/db/api'
import {isLeaderOrAdmin} from '@/db/permissions-utils'
import type {WeeklyReport} from '@/db/types'

function Reports() {
  const {profile} = useAuth()
  const [myReports, setMyReports] = useState<WeeklyReport[]>([])
  const [allReports, setAllReports] = useState<any[]>([])
  const [myTasks, setMyTasks] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const canViewAllReports = isLeaderOrAdmin(profile)

  const loadData = useCallback(async () => {
    if (!profile) return

    try {
      setLoading(true)
      
      // 加载我的周报
      const myReportsData = await getMyWeeklyReports(profile.id as string)
      setMyReports(Array.isArray(myReportsData) ? myReportsData : [])

      // 如果是领导或管理员，加载所有周报
      if (canViewAllReports) {
        const allReportsData = await getAllWeeklyReports()
        setAllReports(Array.isArray(allReportsData) ? allReportsData : [])
      }

      // 加载我的任务
      const tasksData = await getMyTasks(profile.id as string)
      setMyTasks(Array.isArray(tasksData) ? tasksData : [])
    } catch (error) {
      console.error('加载数据失败:', error)
      Taro.showToast({title: '加载失败', icon: 'none'})
    } finally {
      setLoading(false)
    }
  }, [profile, isLeaderOrAdmin])

  useDidShow(() => {
    loadData()
  })

  useEffect(() => {
    loadData()
  }, [loadData])

  // 计算周数（ISO 8601标准）
  const getWeekNumber = (dateString: string): number => {
    const date = new Date(dateString)
    const firstDayOfYear = new Date(date.getFullYear(), 0, 1)
    const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000
    return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7)
  }

  // 格式化周报标题
  const formatWeekTitle = (weekStartDate: string): string => {
    const weekNumber = getWeekNumber(weekStartDate)
    return `第${weekNumber}周`
  }

  // 对周报按周数倒序排序
  const sortedMyReports = [...myReports].sort((a, b) => {
    const weekA = getWeekNumber(a.week_start_date)
    const weekB = getWeekNumber(b.week_start_date)
    return weekB - weekA // 倒序：最新的周在上面
  })

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      draft: '草稿',
      pending_review: '待审阅',
      reviewed: '已审阅',
      rejected: '已驳回'
    }
    return labels[status] || status
  }

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      draft: 'text-muted-foreground',
      pending_review: 'text-warning',
      reviewed: 'text-success',
      rejected: 'text-destructive'
    }
    return colors[status] || 'text-foreground'
  }

  const handleCreateReport = () => {
    Taro.navigateTo({url: '/pages/reports/create/index'})
  }

  const handleViewReport = (id: string) => {
    Taro.navigateTo({url: `/pages/reports/detail/index?id=${id}`})
  }

  const handleEditReport = (id: string) => {
    Taro.navigateTo({url: `/pages/reports/edit/index?id=${id}`})
  }

  const handleDeleteReport = async (id: string) => {
    try {
      const result = await Taro.showModal({
        title: '确认删除',
        content: '确定要删除这条周报吗？删除后无法恢复。',
        confirmText: '删除',
        cancelText: '取消'
      })

      if (!result.confirm) return

      const {error} = await supabase.from('weekly_reports').delete().eq('id', id)

      if (error) throw error

      Taro.showToast({title: '删除成功', icon: 'success'})
      loadData() // 重新加载数据
    } catch (error) {
      console.error('删除周报失败:', error)
      Taro.showToast({title: '删除失败', icon: 'none'})
    }
  }

  // 撤回周报
  const handleWithdrawReport = async (id: string) => {
    try {
      const result = await Taro.showModal({
        title: '确认撤回',
        content: '撤回后周报将变为草稿状态，可以重新编辑。',
        confirmText: '撤回',
        cancelText: '取消'
      })

      if (!result.confirm) return

      const {error} = await supabase
        .from('weekly_reports')
        .update({
          status: 'draft',
          review_status: 'pending',
          review_comment: null,
          reviewed_by: null,
          reviewed_at: null
        })
        .eq('id', id)

      if (error) throw error

      Taro.showToast({title: '撤回成功', icon: 'success'})
      loadData()
    } catch (error) {
      console.error('撤回周报失败:', error)
      Taro.showToast({title: '撤回失败', icon: 'none'})
    }
  }

  // 回复审阅意见
  const handleReplyReport = (id: string) => {
    Taro.navigateTo({url: `/pages/reports/reply/index?id=${id}`})
  }

  const handleAssignTask = () => {
    Taro.navigateTo({url: '/pages/tasks/assign/index'})
  }

  const handleViewTask = (id: string) => {
    Taro.navigateTo({url: `/pages/tasks/detail/index?id=${id}`})
  }

  // 统计我的待办任务
  const pendingTasksCount = myTasks.filter((t) => t.status === 'pending' || t.status === 'in_progress').length

  return (
    <div className="min-h-screen bg-background pb-6">
      {/* 头部 */}
      <div className="bg-gradient-primary px-6 py-6">
        <div className="text-2xl text-primary-foreground font-bold">工作汇报</div>
        <div className="text-base text-primary-foreground/80 mt-1">周报管理与任务协同</div>
      </div>
      {/* 任务指派入口（仅领导可见，置顶显示） */}
      {profile?.role === 'leader' && (
        <div className="px-6 mt-4">
          <div
            onClick={handleAssignTask}
            className="bg-gradient-subtle rounded p-4 flex items-center justify-between border-2 border-primary/30">
            <div className="flex items-center gap-3">
              <div className="i-mdi-account-arrow-right text-4xl text-primary" />
              <div>
                <div className="text-xl text-foreground font-bold">任务指派</div>
                <div className="text-base text-muted-foreground">为团队成员分配工作任务</div>
              </div>
            </div>
            <div className="i-mdi-chevron-right text-3xl text-primary" />
          </div>
        </div>
      )}
      {/* 周报审阅入口（领导和管理员可见） */}
      {isLeaderOrAdmin && (
        <div className="px-6 mt-4">
          <div
            onClick={() => Taro.navigateTo({url: '/pages/reports/review/index'})}
            className="bg-gradient-primary rounded p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="i-mdi-clipboard-check text-4xl text-primary-foreground" />
              <div>
                <div className="text-xl text-primary-foreground font-bold">周报审阅</div>
                <div className="text-base text-primary-foreground/80">查看和审阅团队周报</div>
              </div>
            </div>
            <div className="i-mdi-chevron-right text-3xl text-primary-foreground" />
          </div>
        </div>
      )}

      {/* 周报填报入口 */}
      <div className="px-6 mt-4">
        <div
          onClick={handleCreateReport}
          className="bg-gradient-subtle rounded p-4 flex items-center justify-between border-2 border-primary/30">
          <div className="flex items-center gap-3">
            <div className="i-mdi-file-document-edit text-4xl text-primary" />
            <div>
              <div className="text-xl text-foreground font-bold">周报填报</div>
              <div className="text-base text-muted-foreground">填写本周工作汇报</div>
            </div>
          </div>
          <div className="i-mdi-chevron-right text-3xl text-primary" />
        </div>
      </div>

      {/* 模板配置（仅管理员可见） */}
      {profile && (profile.role === 'system_admin' || profile.role === 'super_admin') && (
        <div className="px-6 mt-4">
          <div
            onClick={() => Taro.navigateTo({url: '/pages/report-templates/list/index'})}
            className="bg-card rounded p-4 flex items-center justify-between border border-border">
            <div className="flex items-center gap-3">
              <div className="i-mdi-cog text-3xl text-foreground" />
              <div>
                <div className="text-xl text-foreground font-bold">模板配置</div>
                <div className="text-base text-muted-foreground">管理周报模板</div>
              </div>
            </div>
            <div className="i-mdi-chevron-right text-2xl text-muted-foreground" />
          </div>
        </div>
      )}
      {/* 任务指派概览 */}
      <div className="px-6 mt-6">
        <div className="text-xl text-foreground font-bold mb-3">任务概览</div>
        <div className="grid grid-cols-2 gap-3">
          {/* 指派给我的任务 */}
          <div className="bg-card rounded p-4 border border-border">
            <div className="flex items-center gap-2 mb-3">
              <div className="i-mdi-account-arrow-left text-2xl text-primary" />
              <div className="text-base text-foreground font-bold">指派给我</div>
            </div>
            <div className="text-3xl text-primary font-bold mb-2">
              {myTasks.filter((t) => t.assigned_to === profile?.id).length}
            </div>
            <button
              type="button"
              onClick={() => Taro.navigateTo({url: '/pages/tasks/index?filter=assigned_to_me'})}
              className="w-full py-2 bg-primary/10 text-primary text-base rounded">
              查看全部
            </button>
          </div>

          {/* 我指派的任务 */}
          <div className="bg-card rounded p-4 border border-border">
            <div className="flex items-center gap-2 mb-3">
              <div className="i-mdi-account-arrow-right text-2xl text-primary" />
              <div className="text-base text-foreground font-bold">我指派的</div>
            </div>
            <div className="text-3xl text-primary font-bold mb-2">
              {myTasks.filter((t) => t.created_by === profile?.id).length}
            </div>
            <button
              type="button"
              onClick={() => Taro.navigateTo({url: '/pages/tasks/index?filter=created_by_me'})}
              className="w-full py-2 bg-primary/10 text-primary text-base rounded">
              查看全部
            </button>
          </div>
        </div>
      </div>
      {/* 我的周报列表 */}
      <div className="px-6 mt-6">
        <div className="flex items-center justify-between mb-3">
          <div className="text-xl text-foreground font-bold">我的周报</div>

        </div>

        {loading ? (
          <div className="text-center py-8">
            <div className="text-base text-muted-foreground">加载中...</div>
          </div>
        ) : myReports.length === 0 ? (
          <div className="bg-card rounded p-8 text-center border border-border">
            <div className="i-mdi-file-document-outline text-6xl text-muted-foreground mb-2" />
            <div className="text-base text-muted-foreground mb-4">暂无周报</div>
            <button
              type="button"
              onClick={handleCreateReport}
              className="px-6 py-3 bg-primary text-primary-foreground text-xl rounded flex items-center justify-center leading-none mx-auto">
              <div className="i-mdi-plus text-2xl mr-2" />
              填写周报
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {sortedMyReports.slice(0, 5).map((report) => (
              <div key={report.id} className="bg-card rounded p-4 border border-border">
                <div className="flex items-start justify-between mb-2">
                  <div
                    className="flex-1"
                    onClick={() => handleViewReport(report.id)}>
                    <div className="text-xl text-foreground font-bold mb-1">
                      {formatWeekTitle(report.week_start_date)}
                    </div>
                    <div className="text-base text-muted-foreground">
                      {report.week_start_date} - {new Date(report.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`px-3 py-1 rounded text-base ${getStatusColor(report.status)}`}>
                      {getStatusLabel(report.status)}
                    </div>
                    {/* 草稿状态显示编辑和删除按钮 */}
                    {report.status === 'draft' && (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleEditReport(report.id)
                          }}
                          className="p-2 text-primary">
                          <div className="i-mdi-pencil text-2xl" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDeleteReport(report.id)
                          }}
                          className="p-2 text-destructive">
                          <div className="i-mdi-delete text-2xl" />
                        </button>
                      </div>
                    )}
                    {/* 已提交状态显示撤回按钮 */}
                    {report.status === 'pending_review' && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleWithdrawReport(report.id)
                        }}
                        className="p-2 text-warning">
                        <div className="i-mdi-undo text-2xl" />
                      </button>
                    )}
                  </div>
                </div>
                {report.review_comment && (
                  <div className="mt-3 pt-3 border-t border-border">
                    <div className="text-base text-muted-foreground mb-1">审阅批复</div>
                    <div className="text-base text-foreground mb-2">{report.review_comment}</div>
                    {/* 需修改状态显示回复按钮 */}
                    {report.review_status === 'rejected' && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleReplyReport(report.id)
                        }}
                        className="px-4 py-2 bg-primary text-primary-foreground text-base rounded flex items-center gap-2 leading-none">
                        <div className="i-mdi-reply text-xl" />
                        回复并重新提交
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
            {myReports.length > 5 && (
              <div className="text-center py-2">
                <span className="text-base text-muted-foreground">显示最近5条，共{myReports.length}条</span>
              </div>
            )}
          </div>
        )}
      </div>
      {/* 我的任务（最近3条） */}
      {myTasks.length > 0 && (
        <div className="px-6 mt-6">

          <div className="flex flex-col gap-3">
            {myTasks.slice(0, 3).map((task) => (
              <></>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default withRouteGuard(Reports)
