import {useState, useMemo, useEffect, useCallback} from 'react'
import Taro from '@tarojs/taro'
import {Picker} from '@tarojs/components'
import {useAuth} from '@/contexts/AuthContext'
import {supabase} from '@/client/supabase'

export default function CreateReport() {
  const {profile} = useAuth()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [lastSaveTime, setLastSaveTime] = useState<string>('')
  const [draftId, setDraftId] = useState<string>('')

  // 计算当前周的开始和结束日期
  const currentWeek = useMemo(() => {
    const now = new Date()
    const day = now.getDay()
    const diff = now.getDate() - day + (day === 0 ? -6 : 1)
    const monday = new Date(now.setDate(diff))
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
    next_week_plan: '',
    issues: ''
  })

  // 保存草稿
  const handleSaveDraft = useCallback(async (isAuto = false) => {
    if (!profile) return

    try {
      setSaving(true)

      const reportData = {
        user_id: profile.id,
        week_start_date: weekStartDate,
        week_end_date: weekEndDate,
        core_work: formData.work_completed || null,
        project_progress: formData.project_progress || null,
        next_week_plan: formData.next_week_plan || null,
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
        Taro.showToast({title: '保存失败', icon: 'none'})
      }
    } finally {
      setSaving(false)
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

  // 更新字段值
  const handleFieldChange = (fieldName: string, value: string) => {
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

  // 提交周报
  const handleSubmit = async () => {
    const errors = validateForm()

    if (errors.length > 0) {
      Taro.showToast({
        title: `请填写：${errors.join('、')}`,
        icon: 'none',
        duration: 3000
      })
      return
    }

    try {
      setLoading(true)

      const reportData = {
        user_id: profile?.id,
        week_start_date: weekStartDate,
        week_end_date: weekEndDate,
        core_work: formData.work_completed || null,
        project_progress: formData.project_progress || null,
        next_week_plan: formData.next_week_plan || null,
        issues: formData.issues || null,
        status: 'pending_review',
        review_status: 'pending',
        submitted_at: new Date().toISOString()
      }

      if (draftId) {
        // 更新现有草稿为已提交
        const {error} = await supabase
          .from('weekly_reports')
          .update(reportData)
          .eq('id', draftId)

        if (error) throw error
      } else {
        // 直接提交
        const {error} = await supabase.from('weekly_reports').insert(reportData)

        if (error) throw error
      }

      Taro.showToast({title: '提交成功', icon: 'success'})
      setTimeout(() => {
        Taro.navigateBack()
      }, 1500)
    } catch (error) {
      console.error('提交失败:', error)
      Taro.showToast({title: '提交失败', icon: 'none'})
    } finally {
      setLoading(false)
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
