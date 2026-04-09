import {useState, useMemo, useEffect, useCallback, useRef} from 'react'
import Taro, {useDidHide} from '@tarojs/taro'
import {Picker} from '@tarojs/components'
import {useAuth} from '@/contexts/AuthContext'
import {supabase} from '@/client/supabase'

export default function CreateReport() {
  const {profile} = useAuth()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [lastSaveTime, setLastSaveTime] = useState<string>('')
  const [draftId, setDraftId] = useState<string>('')
  // Submission lock to prevent race condition between auto-save and submit
  const busyRef = useRef(false)
  const formDirtyRef = useRef(false)

  // 计算当前周的开始和结束日期（safe: no Date mutation）
  const currentWeek = useMemo(() => {
    const now = new Date()
    const day = now.getDay()
    const diff = now.getDate() - day + (day === 0 ? -6 : 1)
    const monday = new Date(now)
    monday.setDate(diff)
    const sunday = new Date(monday)
    sunday.setDate(monday.getDate() + 6)

    return {
      start: monday.toISOString().split('T')[0],
      end: sunday.toISOString().split('T')[0]
    }
  }, [])

  const [weekStartDate, setWeekStartDate] = useState(currentWeek.start)
  const [weekEndDate, setWeekEndDate] = useState(currentWeek.end)
  const [formData, setFormData] = useState<Record<string, string>>({
    work_completed: '',
    project_progress: '',
    bidding_work: '',
    customer_contact: '',
    next_week_plan: '',
    issues: ''
  })

  // 保存草稿（with busy lock to prevent race conditions）
  const handleSaveDraft = useCallback(async (isAuto = false) => {
    if (!profile) return
    // Skip if another operation is in progress
    if (busyRef.current) return
    busyRef.current = true

    try {
      setSaving(true)

      const reportData = {
        user_id: profile.id,
        week_start_date: weekStartDate,
        week_end_date: weekEndDate,
        core_work: formData.work_completed || '',
        project_progress: formData.project_progress || '',
        bidding_work: formData.bidding_work || '',
        customer_contact: formData.customer_contact || '',
        next_week_plan: formData.next_week_plan || '',
        issues: formData.issues || null,
        status: 'draft',
        updated_at: new Date().toISOString()
      }

      if (draftId) {
        // 更新草稿
        const {error} = await supabase
          .from('weekly_reports')
          .update(reportData)
          .eq('id', draftId)

        if (error) throw error
      } else {
        // 创建草稿
        const {data, error} = await supabase
          .from('weekly_reports')
          .insert(reportData)
          .select()
          .single()

        if (error) throw error
        if (data) setDraftId(data.id)
      }

      const now = new Date()
      setLastSaveTime(`${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`)

      if (!isAuto) {
        Taro.showToast({title: '草稿已保存', icon: 'success'})
      }
    } catch (error) {
      console.error('保存草稿失败:', error)
      if (!isAuto) {
        Taro.showToast({title: '保存失败，请检查网络后重试', icon: 'none'})
      }
    } finally {
      setSaving(false)
      busyRef.current = false
      formDirtyRef.current = false
    }
  }, [profile, weekStartDate, weekEndDate, formData, draftId])

  // 自动保存草稿
  useEffect(() => {
    if (!profile) return

    const timer = setInterval(() => {
      handleSaveDraft(true)
    }, 30000) // 30秒自动保存

    return () => clearInterval(timer)
  }, [profile, handleSaveDraft])

  // Page leave: auto-save if dirty
  useDidHide(() => {
    if (formDirtyRef.current && !busyRef.current) {
      handleSaveDraft(true)
    }
  })

  // 更新字段值
  const handleFieldChange = (fieldName: string, value: string) => {
    formDirtyRef.current = true
    setFormData((prev) => ({
      ...prev,
      [fieldName]: value
    }))
  }

  // 验证必填项（不验证任何字段）
  const validateForm = () => {
    // 所有字段都是可选的，不需要验证
    return []
  }

  // 提交周报（with confirmation dialog + busy lock）
  const handleSubmit = async () => {
    if (busyRef.current || loading) return

    // Confirmation dialog for 国央企 users
    const {confirm} = await Taro.showModal({
      title: '确认提交',
      content: `确认提交 ${weekStartDate} 至 ${weekEndDate} 的周报？提交后将进入审核流程，不可自行修改。`,
      confirmText: '确认提交',
      cancelText: '继续编辑'
    })
    if (!confirm) return

    busyRef.current = true
    try {
      setLoading(true)

      const reportData = {
        user_id: profile?.id,
        week_start_date: weekStartDate,
        week_end_date: weekEndDate,
        core_work: formData.work_completed || '',
        project_progress: formData.project_progress || '',
        bidding_work: formData.bidding_work || '',
        customer_contact: formData.customer_contact || '',
        next_week_plan: formData.next_week_plan || '',
        issues: formData.issues || null,
        status: 'pending_review',
        review_status: 'pending'
      }

      if (draftId) {
        const {error} = await supabase
          .from('weekly_reports')
          .update(reportData)
          .eq('id', draftId)

        if (error) throw error
      } else {
        const {error} = await supabase.from('weekly_reports').insert(reportData)

        if (error) throw error
      }

      formDirtyRef.current = false
      Taro.showToast({title: '周报提交成功，等待审核', icon: 'success'})
      setTimeout(() => {
        Taro.navigateBack()
      }, 1500)
    } catch (error: unknown) {
      console.error('提交失败:', error)
      const msg = (error as Error)?.message || '请检查网络连接后重试'
      Taro.showModal({
        title: '提交失败',
        content: msg,
        showCancel: false,
        confirmText: '知道了'
      })
    } finally {
      setLoading(false)
      busyRef.current = false
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-base text-muted-foreground">加载中...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background pb-6">
      {/* 页面标题 */}
      <div className="px-6 py-6 bg-gradient-primary">
        <div className="text-2xl text-primary-foreground font-bold mb-2">填写周报</div>
        {lastSaveTime && (
          <div className="text-base text-primary-foreground/80">
            上次保存: {lastSaveTime}
          </div>
        )}
      </div>

      {/* 周期选择 */}
      <div className="px-6 mt-4">
        <div className="bg-card rounded p-4 border border-border">
          <div className="text-xl text-foreground font-bold mb-3">填报周期</div>
          <div className="flex items-center gap-3">
            <Picker
              mode="date"
              value={weekStartDate}
              onChange={(e) => setWeekStartDate(e.detail.value)}>
              <div className="flex-1 border-2 border-input rounded px-4 py-3 bg-background">
                <div className="text-xl text-foreground">{weekStartDate}</div>
              </div>
            </Picker>
            <div className="text-xl text-muted-foreground">至</div>
            <Picker
              mode="date"
              value={weekEndDate}
              onChange={(e) => setWeekEndDate(e.detail.value)}>
              <div className="flex-1 border-2 border-input rounded px-4 py-3 bg-background">
                <div className="text-xl text-foreground">{weekEndDate}</div>
              </div>
            </Picker>
          </div>
        </div>
      </div>

      {/* 表单字段 */}
      <div className="px-6 mt-4">
        <div className="bg-card rounded p-4 border border-border">
          {/* 工作完成情况 */}
          <div className="mb-4">
            <div className="text-xl text-foreground font-bold mb-2">工作完成情况</div>
            <div className="border-2 border-input rounded px-4 py-3 bg-background overflow-hidden">
              <textarea
                value={formData.work_completed || ''}
                onInput={(e) => {
                  const ev = e as unknown
                  handleFieldChange(
                    'work_completed',
                    (ev as {detail?: {value?: string}}).detail?.value ??
                      (ev as {target?: {value?: string}}).target?.value ??
                      ''
                  )
                }}
                placeholder="请描述本周完成的主要工作内容"
                className="w-full text-xl text-foreground bg-transparent outline-none"
                style={{minHeight: '120px'}}
              />
            </div>
          </div>

          {/* 主要项目推进进展 */}
          <div className="mb-4">
            <div className="text-xl text-foreground font-bold mb-2">主要项目推进进展</div>
            <div className="border-2 border-input rounded px-4 py-3 bg-background overflow-hidden">
              <textarea
                value={formData.project_progress || ''}
                onInput={(e) => {
                  const ev = e as unknown
                  handleFieldChange(
                    'project_progress',
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

          {/* 下周工作计划 */}
          <div className="mb-4">
            <div className="text-xl text-foreground font-bold mb-2">下周工作计划</div>
            <div className="border-2 border-input rounded px-4 py-3 bg-background overflow-hidden">
              <textarea
                value={formData.next_week_plan || ''}
                onInput={(e) => {
                  const ev = e as unknown
                  handleFieldChange(
                    'next_week_plan',
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

          {/* 存在问题及协调需求 */}
          <div>
            <div className="text-xl text-foreground font-bold mb-2">存在问题及协调需求</div>
            <div className="border-2 border-input rounded px-4 py-3 bg-background overflow-hidden">
              <textarea
                value={formData.issues || ''}
                onInput={(e) => {
                  const ev = e as unknown
                  handleFieldChange(
                    'issues',
                    (ev as {detail?: {value?: string}}).detail?.value ??
                      (ev as {target?: {value?: string}}).target?.value ??
                      ''
                  )
                }}
                placeholder="请描述存在的问题和需要协调的事项"
                className="w-full text-xl text-foreground bg-transparent outline-none"
                style={{minHeight: '120px'}}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 操作按钮 */}
      <div className="px-6 mt-4 pb-6 flex gap-3">
        <button
          type="button"
          onClick={() => handleSaveDraft(false)}
          disabled={saving}
          className="flex-1 py-4 bg-card border-2 border-border text-foreground text-xl rounded flex items-center justify-center leading-none">
          <div className="i-mdi-content-save text-2xl mr-2" />
          {saving ? '保存中...' : '保存草稿'}
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={loading}
          className="flex-1 py-4 bg-primary text-primary-foreground text-xl rounded flex items-center justify-center leading-none">
          <div className="i-mdi-send text-2xl mr-2" />
          {loading ? '提交中...' : '提交周报'}
        </button>
      </div>

    </div>
  )
}
