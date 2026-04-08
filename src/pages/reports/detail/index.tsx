import {useState, useEffect, useMemo} from 'react'
import Taro from '@tarojs/taro'
import {useAuth} from '@/contexts/AuthContext'
import {supabase} from '@/client/supabase'
import {getReviewHistory} from '@/db/review'
import type {ReviewHistory} from '@/db/types'

interface WeeklyReport {
  id: string
  user_id: string
  week_start_date: string
  week_end_date: string
  core_work: string
  project_progress: string
  bidding_work: string
  customer_contact: string
  next_week_plan: string
  issues: string | null
  status: string
  review_status: string
  review_comment: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  created_at: string
  user_name?: string
  user_department?: string
}

export default function ReportDetail() {
  const {profile} = useAuth()
  const [report, setReport] = useState<WeeklyReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [reviewComment, setReviewComment] = useState('')
  const [reviewHistory, setReviewHistory] = useState<ReviewHistory[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [relatedTasks, setRelatedTasks] = useState<any[]>([])

  const reportId = useMemo(() => {
    const instance = Taro.getCurrentInstance()
    return instance.router?.params?.id || ''
  }, [])

  useEffect(() => {
    if (!reportId) return

    const loadReport = async () => {
      setLoading(true)
      try {
        const {data, error} = await supabase
          .from('weekly_reports')
          .select(`
            *,
            profiles!weekly_reports_user_id_fkey(name, department)
          `)
          .eq('id', reportId)
          .maybeSingle()

        if (error) throw error
        if (!data) {
          Taro.showToast({title: '周报不存在', icon: 'none'})
          setTimeout(() => Taro.navigateBack(), 1500)
          return
        }

        const reportData = data as WeeklyReport & {profiles?: {name?: string; department?: string}}
        setReport({
          ...reportData,
          user_name: reportData.profiles?.name || '未知用户',
          user_department: reportData.profiles?.department || '未知部门'
        })
        setReviewComment(reportData.review_comment || '')

        // 加载审阅历史
        const history = await getReviewHistory(reportId)
        setReviewHistory(history)
      } catch (error) {
        console.error('加载周报失败:', error)
        Taro.showToast({title: '加载失败', icon: 'none'})
      } finally {
        setLoading(false)
      }
    }

    loadReport()
  }, [reportId])

  // 添加审阅批复（不再区分通过/驳回，只添加批复意见）
  const handleReview = async () => {
    if (!report || !profile) return

    if (!reviewComment) {
      Taro.showToast({title: '请填写审阅批复意见', icon: 'none'})
      return
    }

    const res = await Taro.showModal({
      title: '确认提交',
      content: '确定要提交审阅批复吗？'
    })

    if (!res.confirm) return

    setProcessing(true)
    try {
      const {error} = await supabase
        .from('weekly_reports')
        .update({
          status: 'approved',
          review_comment: reviewComment,
          reviewed_by: profile.id,
          reviewed_at: new Date().toISOString()
        })
        .eq('id', report.id)

      if (error) throw error

      Taro.showToast({title: '审阅批复已提交', icon: 'success'})
      setTimeout(() => Taro.navigateBack(), 1500)
    } catch (error) {
      console.error('操作失败:', error)
      Taro.showToast({title: '操作失败', icon: 'none'})
    } finally {
      setProcessing(false)
    }
  }

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      draft: '草稿',
      submitted: '待审阅',
      approved: '已通过',
      rejected: '已驳回'
    }
    return labels[status] || status
  }

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      draft: 'text-muted-foreground',
      submitted: 'text-warning',
      approved: 'text-success',
      rejected: 'text-destructive'
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

  if (!report) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6">
        <div className="text-center">
          <div className="i-mdi-alert-circle text-6xl text-warning mb-4" />
          <div className="text-2xl text-foreground">周报不存在</div>
        </div>
      </div>
    )
  }

  const isLeaderOrAdmin = profile && ['leader', 'system_admin'].includes(profile.role as string)
  const canReview = isLeaderOrAdmin && report.status === 'submitted'
  const canEdit = profile && report.user_id === profile.id && report.status === 'draft'

  const handleEdit = () => {
    Taro.navigateTo({url: `/pages/reports/edit/index?id=${report.id}`})
  }

  return (
    <div className="min-h-screen bg-background pb-6">
      {/* 头部 */}
      <div className="bg-gradient-primary px-6 py-6">
        <div className="flex items-center justify-between mb-2">
          <div className="text-2xl text-primary-foreground font-bold">周报详情</div>
          <div className="text-xl text-primary-foreground font-medium">
            {report.user_name}
          </div>
        </div>
        <div className="flex items-center justify-between">
          <div className="text-base text-primary-foreground/80">
            {report.user_department}
          </div>
          <div className="flex items-center gap-2">

            {canEdit && (
              <button
                type="button"
                onClick={handleEdit}
                className="px-4 py-2 bg-primary-foreground text-primary text-base rounded flex items-center justify-center leading-none">
                <div className="i-mdi-pencil text-xl mr-1" />
                编辑
              </button>
            )}
          </div>
        </div>
      </div>
      {/* 周报内容 */}
      <div className="px-6 py-6 flex flex-col gap-6">
        {/* 填报周期 */}
        <div>
          <div className="text-base text-muted-foreground mb-2">填报周期</div>
          <div className="text-xl text-foreground">
            {report.week_start_date} 至 {report.week_end_date}
          </div>
        </div>

        {/* 工作完成情况 */}
        <div>
          <div className="text-base text-muted-foreground mb-2">工作完成情况</div>
          <div className="text-xl text-foreground whitespace-pre-wrap">
            {report.core_work || ''}
          </div>
        </div>

        {/* 主要项目推进进展 */}
        <div>
          <div className="text-base text-muted-foreground mb-2">主要项目推进进展</div>
          <div className="text-xl text-foreground whitespace-pre-wrap">
            {report.project_progress || ''}
          </div>
        </div>

        {/* 下周工作计划 */}
        <div>
          <div className="text-base text-muted-foreground mb-2">下周工作计划</div>
          <div className="text-xl text-foreground whitespace-pre-wrap">
            {report.next_week_plan || ''}
          </div>
        </div>

        {/* 存在问题及协调需求 */}
        <div>
          <div className="text-base text-muted-foreground mb-2">存在问题及协调需求</div>
          <div className="text-xl text-foreground whitespace-pre-wrap">
            {report.issues || ''}
          </div>
        </div>

        {/* 审阅意见（如果已审阅） */}
        {report.review_comment && report.status !== 'submitted' && (
          <div className="bg-muted rounded p-4">
            <div className="text-base text-muted-foreground mb-2">最新审阅意见</div>
            <div className="text-xl text-foreground whitespace-pre-wrap">{report.review_comment}</div>
            {report.reviewed_at && (
              <div className="text-base text-muted-foreground mt-2">
                审阅时间：{new Date(report.reviewed_at).toLocaleString('zh-CN')}
              </div>
            )}
          </div>
        )}

        {/* 审阅历史 */}
        {reviewHistory.length > 0 && (
          <div className="bg-card rounded p-4 border border-border">
            <div
              onClick={() => setShowHistory(!showHistory)}
              className="flex items-center justify-between cursor-pointer">
              <div className="text-xl text-foreground font-bold">审阅历史</div>
              <div className="flex items-center gap-2">
                <div className="text-base text-muted-foreground">{reviewHistory.length} 条记录</div>
                <div
                  className={`i-mdi-chevron-down text-2xl text-foreground transition-transform ${
                    showHistory ? 'rotate-180' : ''
                  }`}
                />
              </div>
            </div>

            {showHistory && (
              <div className="mt-4 space-y-3">
                {reviewHistory.map((history, index) => (
                  <div
                    key={history.id}
                    className="relative pl-6 pb-3 border-l-2 border-primary/30 last:border-l-0 last:pb-0">
                    {/* 时间线圆点 */}
                    <div className="absolute left-[-5px] top-0 w-3 h-3 rounded-full bg-primary" />

                    <div className="bg-muted/50 rounded p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="text-base text-foreground font-bold">
                            {history.reviewer?.name || '未知审阅人'}
                          </div>
                          <div
                            className={`px-2 py-1 rounded text-sm ${
                              history.review_status === 'approved'
                                ? 'bg-green-500/10 text-green-600'
                                : 'bg-yellow-500/10 text-yellow-600'
                            }`}>
                            {history.review_status === 'approved' ? '通过' : '需修改'}
                          </div>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {new Date(history.reviewed_at).toLocaleString('zh-CN', {
                            month: '2-digit',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </div>
                      </div>

                      {history.review_comment && (
                        <div className="text-base text-foreground whitespace-pre-wrap">
                          {history.review_comment}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 审阅操作（领导/管理员且状态为待审阅） */}
        {canReview && (
          <div className="mt-4">
            <div className="text-xl text-foreground mb-2">审阅批复</div>
            <div className="border-2 border-input rounded px-4 py-3 bg-card mb-4">
              <textarea
                value={reviewComment}
                onInput={(e) => {
                  const ev = e as unknown
                  setReviewComment(
                    (ev as {detail?: {value?: string}}).detail?.value ??
                      (ev as {target?: {value?: string}}).target?.value ??
                      ''
                  )
                }}
                placeholder="请填写审阅批复意见（必填）"
                className="w-full text-xl text-foreground bg-transparent outline-none"
                style={{minHeight: '120px'}}
              />
            </div>

            <button
              type="button"
              onClick={handleReview}
              disabled={processing}
              className="w-full py-4 bg-primary text-primary-foreground text-xl rounded flex items-center justify-center leading-none">
              {processing ? '提交中...' : '提交审阅批复'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
