import {useState, useCallback, useEffect} from 'react'
import Taro, {useDidShow} from '@tarojs/taro'
import {withRouteGuard} from '@/components/RouteGuard'
import {useAuth} from '@/contexts/AuthContext'
import {supabase} from '@/client/supabase'
import {createReviewHistory} from '@/db/review'
import type {WeeklyReport, WeeklyReportTemplateField} from '@/db/types'

function ReportReviewPage() {
  const {profile} = useAuth()
  const [reports, setReports] = useState<(WeeklyReport & {user_name?: string})[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [reviewingReportId, setReviewingReportId] = useState<string | null>(null)
  const [reviewComment, setReviewComment] = useState('')
  const [templateFieldsMap, setTemplateFieldsMap] = useState<Record<string, WeeklyReportTemplateField[]>>({})

  const loadReports = useCallback(async () => {
    if (!profile) return

    try {
      setLoading(true)

      let query = supabase
        .from('weekly_reports')
        .select(`
          *,
          profiles!weekly_reports_user_id_fkey(name)
        `)
        .order('week_start_date', {ascending: false})

      // 筛选审阅状态
      if (filter !== 'all') {
        query = query.eq('review_status', filter)
      }

      // 筛选时间范围
      if (startDate) {
        query = query.gte('week_start_date', startDate)
      }
      if (endDate) {
        query = query.lte('week_end_date', endDate)
      }

      const {data, error} = await query

      if (error) throw error

      // 处理数据，提取用户名
      const processedData = (data || []).map((item) => {
        const profileData = item.profiles as {name: string} | null
        return {
          ...item,
          user_name: profileData?.name || '未知用户'
        }
      })

      setReports(processedData)
    } catch (error) {
      console.error('加载周报失败:', error)
      Taro.showToast({title: '加载失败', icon: 'none'})
    } finally {
      setLoading(false)
    }
  }, [profile, filter, startDate, endDate])

  // 加载模板字段
  const loadTemplateFields = useCallback(async (templateIds: string[]) => {
    if (templateIds.length === 0) return

    try {
      const {data, error} = await supabase
        .from('weekly_report_template_fields')
        .select('*')
        .in('template_id', templateIds)
        .order('display_order')

      if (error) throw error

      // 按template_id分组
      const fieldsMap: Record<string, WeeklyReportTemplateField[]> = {}
      data?.forEach((field) => {
        if (!fieldsMap[field.template_id]) {
          fieldsMap[field.template_id] = []
        }
        fieldsMap[field.template_id].push(field)
      })

      setTemplateFieldsMap(fieldsMap)
    } catch (error) {
      console.error('加载模板字段失败:', error)
    }
  }, [])

  useDidShow(() => {
    loadReports()
  })

  useEffect(() => {
    loadReports()
  }, [loadReports])

  // 当reports加载完成后，加载对应的模板字段
  useEffect(() => {
    const templateIds = reports
      .filter(r => r.template_id)
      .map(r => r.template_id as string)
    
    if (templateIds.length > 0) {
      loadTemplateFields([...new Set(templateIds)])
    }
  }, [reports, loadTemplateFields])

  const handleStartReview = (reportId: string) => {
    setReviewingReportId(reportId)
    setReviewComment('')
  }

  const handleCancelReview = () => {
    setReviewingReportId(null)
    setReviewComment('')
  }

  const handleSubmitReview = async (reportId: string, status: 'approved' | 'rejected') => {
    if (!profile) return

    try {
      // 保存审阅历史
      await createReviewHistory({
        report_id: reportId,
        reviewer_id: profile.id as string,
        review_status: status,
        review_comment: reviewComment.trim() || null
      })

      // 更新周报状态
      const {error} = await supabase
        .from('weekly_reports')
        .update({
          review_status: status,
          review_comment: reviewComment.trim() || null,
          reviewed_by: profile.id,
          reviewed_at: new Date().toISOString()
        })
        .eq('id', reportId)

      if (error) throw error

      Taro.showToast({title: '审阅成功', icon: 'success'})
      setReviewingReportId(null)
      setReviewComment('')
      loadReports()
    } catch (error) {
      console.error('审阅失败:', error)
      Taro.showToast({title: '审阅失败', icon: 'none'})
    }
  }

  const handleViewDetail = (reportId: string) => {
    Taro.navigateTo({url: `/pages/reports/detail/index?id=${reportId}`})
  }

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      pending: '待审阅',
      approved: '已通过',
      rejected: '需修改'
    }
    return labels[status] || status
  }

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-yellow-500/10 text-yellow-600',
      approved: 'bg-green-500/10 text-green-600',
      rejected: 'bg-red-500/10 text-red-600'
    }
    return colors[status] || 'bg-muted text-muted-foreground'
  }

  return (
    <div className="min-h-screen bg-background pb-6">
      {/* 页面标题 */}
      <div className="px-6 py-6 bg-gradient-primary">
        <div className="text-3xl text-primary-foreground font-bold mb-2">周报审阅</div>
        <div className="text-xl text-primary-foreground/80">查看和审阅团队周报</div>
      </div>

      {/* 筛选器 */}
      <div className="px-6 mt-4">
        <div className="bg-card rounded p-4 border border-border">
          {/* 状态筛选 */}
          <div className="mb-4">
            <div className="text-xl text-foreground font-bold mb-2">审阅状态</div>
            <div className="flex gap-2">
              {[
                {key: 'all', label: '全部'},
                {key: 'pending', label: '待审阅'},
                {key: 'approved', label: '已通过'},
                {key: 'rejected', label: '需修改'}
              ].map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setFilter(item.key as typeof filter)}
                  className={`flex-1 py-2 text-base rounded ${
                    filter === item.key
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  }`}>
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* 时间范围筛选 */}
          <div className="flex gap-3">
            <div className="flex-1">
              <div className="text-base text-foreground mb-2">开始日期</div>
              <div className="border-2 border-input rounded px-3 py-2 bg-background">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full text-base text-foreground bg-transparent outline-none"
                />
              </div>
            </div>
            <div className="flex-1">
              <div className="text-base text-foreground mb-2">结束日期</div>
              <div className="border-2 border-input rounded px-3 py-2 bg-background">
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full text-base text-foreground bg-transparent outline-none"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 周报列表 */}
      <div className="px-6 mt-4">
        {loading ? (
          <div className="text-center py-12">
            <div className="text-xl text-muted-foreground">加载中...</div>
          </div>
        ) : reports.length === 0 ? (
          <div className="text-center py-12">
            <div className="i-mdi-file-document-outline text-[80px] text-muted-foreground mb-4" />
            <div className="text-xl text-muted-foreground">暂无周报</div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {reports.map((report) => (
              <div key={report.id} className="bg-card rounded p-4 border border-border">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="text-xl text-foreground font-bold">{report.user_name}</div>
                      <div className={`px-2 py-1 rounded text-sm ${getStatusColor(report.review_status)}`}>
                        {getStatusLabel(report.review_status)}
                      </div>
                    </div>
                    <div className="text-base text-muted-foreground">
                      {report.week_start_date} ~ {report.week_end_date}
                    </div>
                  </div>
                </div>

                {/* 周报内容预览 */}
                <div className="mb-3 p-3 bg-muted/30 rounded">
                  <div className="text-base text-foreground line-clamp-3">
                    {report.core_work || '暂无内容'}
                  </div>
                </div>

                {/* 审阅批注 */}
                {report.review_comment && (
                  <div className="mb-3 p-3 bg-primary/10 rounded border border-primary/30">
                    <div className="text-sm text-muted-foreground mb-1">审阅意见</div>
                    <div className="text-base text-foreground">{report.review_comment}</div>
                  </div>
                )}

                {/* 审阅输入区域 */}
                {reviewingReportId === report.id && (
                  <div className="mb-3 p-4 bg-muted/50 rounded border-2 border-primary">
                    {/* 周报内容展示 */}
                    <div className="mb-4 p-4 bg-background rounded border border-border max-h-[60vh] overflow-y-auto">
                      <div className="text-xl text-foreground font-bold mb-3">周报内容</div>
                      
                      {/* 动态字段内容（custom_fields），按模板字段顺序展示 */}
                      {report.custom_fields && typeof report.custom_fields === 'object' && report.template_id && templateFieldsMap[report.template_id] ? (
                        <div className="flex flex-col gap-4">
                          {templateFieldsMap[report.template_id].map((field) => {
                            const value = (report.custom_fields as Record<string, string>)[field.field_name]
                            if (!value) return null
                            
                            // 尝试解析项目进展数据（如果是JSON字符串）
                            let displayValue = value
                            try {
                              const parsed = JSON.parse(value)
                              if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].projectId) {
                                displayValue = parsed.map((p: {projectName: string; content: string}) => 
                                  `【${p.projectName}】\n${p.content}`
                                ).join('\n\n')
                              }
                            } catch {
                              // 不是JSON，保持原值
                            }

                            return (
                              <div key={field.id}>
                                <div className="text-base text-muted-foreground mb-2">{field.field_label}</div>
                                <div className="text-base text-foreground whitespace-pre-wrap">
                                  {displayValue}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      ) : report.custom_fields && typeof report.custom_fields === 'object' ? (
                        // 没有模板字段信息时，直接显示custom_fields
                        <div className="flex flex-col gap-4">
                          {Object.entries(report.custom_fields as Record<string, string>).map(([key, value]) => {
                            if (!value) return null
                            
                            // 尝试解析项目进展数据（如果是JSON字符串）
                            let displayValue = value
                            try {
                              const parsed = JSON.parse(value)
                              if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].projectId) {
                                displayValue = parsed.map((p: {projectName: string; content: string}) => 
                                  `【${p.projectName}】\n${p.content}`
                                ).join('\n\n')
                              }
                            } catch {
                              // 不是JSON，保持原值
                            }

                            // 格式化字段名称
                            const fieldLabel = key
                              .replace(/_/g, ' ')
                              .replace(/\b\w/g, (l) => l.toUpperCase())

                            return (
                              <div key={key}>
                                <div className="text-base text-muted-foreground mb-2">{fieldLabel}</div>
                                <div className="text-base text-foreground whitespace-pre-wrap">
                                  {displayValue}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      ) : (
                        // 如果没有custom_fields，显示固定字段
                        <>
                          {/* 工作完成情况 */}
                          <div className="mb-4">
                            <div className="text-base text-muted-foreground mb-2">工作完成情况</div>
                            <div className="text-base text-foreground whitespace-pre-wrap">
                              {report.core_work || ''}
                            </div>
                          </div>

                          {/* 主要项目推进进展 */}
                          <div className="mb-4">
                            <div className="text-base text-muted-foreground mb-2">主要项目推进进展</div>
                            <div className="text-base text-foreground whitespace-pre-wrap">
                              {report.project_progress || ''}
                            </div>
                          </div>

                          {/* 下周工作计划 */}
                          <div className="mb-4">
                            <div className="text-base text-muted-foreground mb-2">下周工作计划</div>
                            <div className="text-base text-foreground whitespace-pre-wrap">
                              {report.next_week_plan || ''}
                            </div>
                          </div>

                          {/* 存在问题及协调需求 */}
                          <div>
                            <div className="text-base text-muted-foreground mb-2">存在问题及协调需求</div>
                            <div className="text-base text-foreground whitespace-pre-wrap">
                              {report.issues || ''}
                            </div>
                          </div>
                        </>
                      )}
                    </div>

                    <div className="text-xl text-foreground font-bold mb-3">填写审阅意见</div>
                    <div className="border-2 border-input rounded px-4 py-3 bg-background overflow-hidden mb-3">
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
                        placeholder="请输入审阅意见（可选）&#10;支持多行输入，详细说明审阅结果和改进建议"
                        className="w-full text-xl text-foreground bg-transparent outline-none"
                        style={{minHeight: '120px'}}
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleCancelReview}
                        className="flex-1 py-3 bg-card border-2 border-border text-foreground text-xl rounded flex items-center justify-center leading-none">
                        取消
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSubmitReview(report.id, 'approved')}
                        className="flex-1 py-3 bg-green-500 text-white text-xl rounded flex items-center justify-center leading-none gap-2">
                        <div className="i-mdi-check text-2xl" />
                        <span>通过</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSubmitReview(report.id, 'rejected')}
                        className="flex-1 py-3 bg-yellow-500 text-white text-xl rounded flex items-center justify-center leading-none gap-2">
                        <div className="i-mdi-pencil text-2xl" />
                        <span>需修改</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* 操作按钮 */}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleViewDetail(report.id)}
                    className="flex-1 py-3 bg-card border-2 border-primary text-primary text-xl rounded flex items-center justify-center leading-none gap-2">
                    <div className="i-mdi-eye text-2xl" />
                    <span>查看详情</span>
                  </button>
                  {report.review_status === 'pending' && !reviewingReportId && (
                    <button
                      type="button"
                      onClick={() => handleStartReview(report.id)}
                      className="flex-1 py-3 bg-primary text-primary-foreground text-xl rounded flex items-center justify-center leading-none gap-2">
                      <div className="i-mdi-clipboard-check text-2xl" />
                      <span>开始审阅</span>
                    </button>
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

export default withRouteGuard(ReportReviewPage)
