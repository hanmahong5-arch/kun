import {useState, useEffect, useMemo} from 'react'
import Taro from '@tarojs/taro'
import {withRouteGuard} from '@/components/RouteGuard'
import {useAuth} from '@/contexts/AuthContext'
import {supabase} from '@/client/supabase'

interface WeeklyReport {
  id: string
  user_id: string
  week_start_date: string
  week_end_date: string
  custom_fields?: Record<string, unknown>
  review_comment: string | null
  reviewed_by: string | null
  reviewed_at: string | null
}

function ReplyReport() {
  const {profile} = useAuth()
  const [report, setReport] = useState<WeeklyReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [replyContent, setReplyContent] = useState('')

  const reportId = useMemo(() => {
    const instance = Taro.getCurrentInstance()
    return instance.router?.params?.id || ''
  }, [])

  useEffect(() => {
    if (!reportId || !profile) return

    const loadReport = async () => {
      setLoading(true)
      try {
        const {data, error} = await supabase
          .from('weekly_reports')
          .select('*')
          .eq('id', reportId)
          .eq('user_id', profile.id)
          .maybeSingle()

        if (error) throw error
        if (!data) {
          Taro.showToast({title: '周报不存在', icon: 'none'})
          setTimeout(() => Taro.navigateBack(), 1500)
          return
        }

        setReport(data as WeeklyReport)
      } catch (error) {
        console.error('加载周报失败:', error)
        Taro.showToast({title: '加载失败', icon: 'none'})
      } finally {
        setLoading(false)
      }
    }

    loadReport()
  }, [reportId, profile])

  const handleSubmit = async () => {
    if (!report || !profile) return

    if (!replyContent.trim()) {
      Taro.showToast({title: '请填写回复内容', icon: 'none'})
      return
    }

    try {
      setSubmitting(true)

      // 更新周报状态，添加回复内容
      const {error} = await supabase
        .from('weekly_reports')
        .update({
          status: 'pending_review',
          review_status: 'pending',
          user_reply: replyContent.trim(),
          replied_at: new Date().toISOString()
        })
        .eq('id', report.id)

      if (error) throw error

      Taro.showToast({title: '回复成功', icon: 'success'})
      setTimeout(() => {
        Taro.navigateBack()
      }, 1500)
    } catch (error) {
      console.error('回复失败:', error)
      Taro.showToast({title: '回复失败', icon: 'none'})
    } finally {
      setSubmitting(false)
    }
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

  return (
    <div className="min-h-screen bg-background pb-6">
      {/* 页面标题 */}
      <div className="px-6 py-6 bg-gradient-primary">
        <div className="text-2xl text-primary-foreground font-bold mb-2">回复审阅意见</div>
        <div className="text-base text-primary-foreground/80">
          {report.week_start_date} ~ {report.week_end_date}
        </div>
      </div>

      {/* 审阅意见 */}
      <div className="px-6 mt-4">
        <div className="bg-card rounded p-4 border border-border">
          <div className="text-xl text-foreground font-bold mb-3">领导审阅意见</div>
          <div className="p-4 bg-warning/10 rounded border border-warning/30">
            <div className="text-base text-foreground whitespace-pre-wrap">
              {report.review_comment || '暂无审阅意见'}
            </div>
          </div>
          {report.reviewed_at && (
            <div className="text-sm text-muted-foreground mt-2">
              审阅时间：{new Date(report.reviewed_at).toLocaleString()}
            </div>
          )}
        </div>
      </div>

      {/* 回复内容 */}
      <div className="px-6 mt-4">
        <div className="bg-card rounded p-4 border border-border">
          <div className="flex items-center gap-1 mb-3">
            <div className="text-xl text-foreground font-bold">回复内容</div>
            <span className="text-destructive text-xl">*</span>
          </div>
          <div className="border-2 border-input rounded px-4 py-3 bg-background overflow-hidden">
            <textarea
              value={replyContent}
              onInput={(e) => {
                const ev = e as unknown
                setReplyContent(
                  (ev as {detail?: {value?: string}}).detail?.value ??
                    (ev as {target?: {value?: string}}).target?.value ??
                    ''
                )
              }}
              placeholder="请说明针对审阅意见的改进措施和说明"
              className="w-full text-xl text-foreground bg-transparent outline-none"
              style={{minHeight: '150px'}}
            />
          </div>
          <div className="text-base text-muted-foreground mt-2">
            回复后周报将重新提交给审阅领导
          </div>
        </div>
      </div>

      {/* 操作按钮 */}
      <div className="px-6 mt-4 flex gap-3">
        <button
          type="button"
          onClick={() => Taro.navigateBack()}
          disabled={submitting}
          className="flex-1 py-4 bg-card border-2 border-border text-foreground text-xl rounded flex items-center justify-center leading-none">
          取消
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
          className="flex-1 py-4 bg-primary text-primary-foreground text-xl rounded flex items-center justify-center leading-none">
          <div className="i-mdi-send text-2xl mr-2" />
          {submitting ? '提交中...' : '提交回复'}
        </button>
      </div>
    </div>
  )
}

export default withRouteGuard(ReplyReport)
