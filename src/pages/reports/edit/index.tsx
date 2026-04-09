import {useState, useEffect, useMemo, useCallback, useRef} from 'react'
import Taro, {useDidHide} from '@tarojs/taro'
import {useAuth} from '@/contexts/AuthContext'
import {supabase} from '@/client/supabase'

interface WeeklyReport {
  id: string
  user_id: string
  week_start_date: string
  week_end_date: string
  core_work: string | null
  project_progress: string | null
  next_week_plan: string | null
  issues: string | null
  status: string
}

export default function EditReport() {
  const {profile} = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [report, setReport] = useState<WeeklyReport | null>(null)
  const [lastSaveTime, setLastSaveTime] = useState<string>('')

  const reportId = useMemo(() => {
    const instance = Taro.getCurrentInstance()
    return instance.router?.params?.id || ''
  }, [])

  // 表单数据
  const [weekStartDate, setWeekStartDate] = useState('')
  const [weekEndDate, setWeekEndDate] = useState('')
  const [coreWork, setCoreWork] = useState('') // 工作完成情况
  const [projectProgress, setProjectProgress] = useState('') // 主要项目推进进展
  const [biddingWork, setBiddingWork] = useState('') // 投标工作
  const [customerContact, setCustomerContact] = useState('') // 客户联系情况
  const [nextWeekPlan, setNextWeekPlan] = useState('') // 下周工作计划
  const [issues, setIssues] = useState('') // 存在问题及协调需求
  const busyRef = useRef(false)

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
          .eq('status', 'draft')
          .maybeSingle()

        if (error) throw error
        if (!data) {
          Taro.showToast({title: '周报不存在或无权编辑', icon: 'none'})
          setTimeout(() => Taro.navigateBack(), 1500)
          return
        }

        setReport(data as WeeklyReport)
        setWeekStartDate(data.week_start_date)
        setWeekEndDate(data.week_end_date)
        setCoreWork(data.core_work || '')
        setProjectProgress(data.project_progress || '')
        setBiddingWork(data.bidding_work || '')
        setCustomerContact(data.customer_contact || '')
        setNextWeekPlan(data.next_week_plan || '')
        setIssues(data.issues || '')
      } catch (error) {
        console.error('加载周报失败:', error)
        Taro.showToast({title: '加载失败', icon: 'none'})
      } finally {
        setLoading(false)
      }
    }

    loadReport()
  }, [reportId, profile])

  // 自动保存功能（每30秒自动保存一次）
  const autoSave = useCallback(async () => {
    if (!report) return
    
    try {
      const {error} = await supabase
        .from('weekly_reports')
        .update({
          week_start_date: weekStartDate,
          week_end_date: weekEndDate,
          core_work: coreWork || '',
          project_progress: projectProgress || '',
          bidding_work: biddingWork || '',
          customer_contact: customerContact || '',
          next_week_plan: nextWeekPlan || '',
          issues: issues || null,
          status: 'draft'
        })
        .eq('id', report.id)

      if (error) throw error

      const now = new Date()
      setLastSaveTime(`${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`)
    } catch (error) {
      console.error('自动保存失败:', error)
    }
  }, [report, weekStartDate, weekEndDate, coreWork, projectProgress, biddingWork, customerContact, nextWeekPlan, issues])

  // 设置自动保存定时器
  useEffect(() => {
    if (!report) return

    const timer = setInterval(() => {
      autoSave()
    }, 30000) // 30秒自动保存一次

    return () => clearInterval(timer)
  }, [autoSave, report])

  // 保存草稿
  const handleSaveDraft = async () => {
    if (!report) return

    setSaving(true)
    try {
      await autoSave()
      Taro.showToast({title: '草稿已保存', icon: 'success'})
      setTimeout(() => {
        Taro.navigateBack()
      }, 1500)
    } catch (error) {
      console.error('保存草稿失败:', error)
      Taro.showToast({title: '保存失败', icon: 'none'})
    } finally {
      setSaving(false)
    }
  }

  // 提交周报（with confirmation + lock）
  const handleSubmit = async () => {
    if (!report || busyRef.current || saving) return

    const {confirm} = await Taro.showModal({
      title: '确认提交',
      content: `确认提交 ${weekStartDate} 至 ${weekEndDate} 的周报？提交后将进入审核流程。`,
      confirmText: '确认提交',
      cancelText: '继续编辑'
    })
    if (!confirm) return

    busyRef.current = true
    setSaving(true)
    try {
      const {error} = await supabase
        .from('weekly_reports')
        .update({
          week_start_date: weekStartDate,
          week_end_date: weekEndDate,
          core_work: coreWork || '',
          project_progress: projectProgress || '',
          bidding_work: biddingWork || '',
          customer_contact: customerContact || '',
          next_week_plan: nextWeekPlan || '',
          issues: issues || null,
          status: 'pending_review',
          review_status: 'pending'
        })
        .eq('id', report.id)

      if (error) throw error

      Taro.showToast({title: '周报提交成功，等待审核', icon: 'success'})
      setTimeout(() => {
        Taro.navigateBack()
      }, 1500)
    } catch (error: unknown) {
      console.error('提交失败:', error)
      const msg = (error as Error)?.message || '请检查网络连接后重试'
      Taro.showModal({title: '提交失败', content: msg, showCancel: false, confirmText: '知道了'})
    } finally {
      setSaving(false)
      busyRef.current = false
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
          <div className="text-2xl text-foreground">周报不存在或无权编辑</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background pb-6">
      {/* 头部 */}
      <div className="bg-gradient-primary px-6 py-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-2xl text-primary-foreground font-bold">编辑周报</div>
            <div className="text-base text-primary-foreground/80 mt-1">
              填报周期：{weekStartDate} 至 {weekEndDate}
            </div>
          </div>
          {lastSaveTime && (
            <div className="text-base text-primary-foreground/80">
              最后保存：{lastSaveTime}
            </div>
          )}
        </div>
      </div>
      {/* 表单内容 */}
      <div className="px-6 py-6 flex flex-col gap-6">
        {/* 周期选择 */}
        <div>
          <div className="text-xl text-foreground mb-2">填报周期</div>
          <div className="flex gap-3 items-center">
            <div className="flex-1 border-2 border-input rounded px-4 py-3 bg-card">
              <input
                type="date"
                value={weekStartDate}
                onInput={(e) => {
                  const ev = e as unknown
                  setWeekStartDate(
                    (ev as {detail?: {value?: string}}).detail?.value ??
                      (ev as {target?: {value?: string}}).target?.value ??
                      ''
                  )
                }}
                className="w-full text-xl text-foreground bg-transparent outline-none"
              />
            </div>
            <span className="text-xl text-muted-foreground">至</span>
            <div className="flex-1 border-2 border-input rounded px-4 py-3 bg-card">
              <input
                type="date"
                value={weekEndDate}
                onInput={(e) => {
                  const ev = e as unknown
                  setWeekEndDate(
                    (ev as {detail?: {value?: string}}).detail?.value ??
                      (ev as {target?: {value?: string}}).target?.value ??
                      ''
                  )
                }}
                className="w-full text-xl text-foreground bg-transparent outline-none"
              />
            </div>
          </div>
        </div>

        {/* 1. 工作完成情况 */}
        <div>
          <div className="text-xl text-foreground mb-2">工作完成情况</div>
          <div className="border-2 border-input rounded px-4 py-3 bg-card">
            <textarea
              value={coreWork}
              onInput={(e) => {
                const ev = e as unknown
                setCoreWork(
                  (ev as {detail?: {value?: string}}).detail?.value ??
                    (ev as {target?: {value?: string}}).target?.value ??
                    ''
                )
              }}
              placeholder="请描述本周完成的工作内容"
              className="w-full text-xl text-foreground bg-transparent outline-none"
              style={{minHeight: '120px'}}
            />
          </div>
        </div>

        {/* 2. 主要项目推进进展 */}
        <div>
          <div className="text-xl text-foreground mb-2">主要项目推进进展</div>
          <div className="border-2 border-input rounded px-4 py-3 bg-card">
            <textarea
              value={projectProgress}
              onInput={(e) => {
                const ev = e as unknown
                setProjectProgress(
                  (ev as {detail?: {value?: string}}).detail?.value ??
                    (ev as {target?: {value?: string}}).target?.value ??
                    ''
                )
              }}
              placeholder="请描述主要项目的推进进展情况"
              className="w-full text-xl text-foreground bg-transparent outline-none"
              style={{minHeight: '120px'}}
            />
          </div>
        </div>

        {/* 3. 下周工作计划 */}
        <div>
          <div className="text-xl text-foreground mb-2">下周工作计划</div>
          <div className="border-2 border-input rounded px-4 py-3 bg-card">
            <textarea
              value={nextWeekPlan}
              onInput={(e) => {
                const ev = e as unknown
                setNextWeekPlan(
                  (ev as {detail?: {value?: string}}).detail?.value ??
                    (ev as {target?: {value?: string}}).target?.value ??
                    ''
                )
              }}
              placeholder="请描述下周的工作计划"
              className="w-full text-xl text-foreground bg-transparent outline-none"
              style={{minHeight: '120px'}}
            />
          </div>
        </div>

        {/* 4. 存在问题及协调需求 */}
        <div>
          <div className="text-xl text-foreground mb-2">存在问题及协调需求</div>
          <div className="border-2 border-input rounded px-4 py-3 bg-card">
            <textarea
              value={issues}
              onInput={(e) => {
                const ev = e as unknown
                setIssues(
                  (ev as {detail?: {value?: string}}).detail?.value ??
                    (ev as {target?: {value?: string}}).target?.value ??
                    ''
                )
              }}
              placeholder="如有需要协调的问题，请在此描述"
              className="w-full text-xl text-foreground bg-transparent outline-none"
              style={{minHeight: '100px'}}
            />
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="flex gap-3 mt-4">
          <button
            type="button"
            onClick={handleSaveDraft}
            disabled={saving}
            className="flex-1 py-4 bg-card border-2 border-primary text-primary text-xl rounded flex items-center justify-center leading-none">
            {saving ? '保存中...' : '保存草稿'}
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="flex-1 py-4 bg-primary text-primary-foreground text-xl rounded flex items-center justify-center leading-none">
            {saving ? '提交中...' : '提交周报'}
          </button>
        </div>
      </div>
    </div>
  )
}
