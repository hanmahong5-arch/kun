import {useState, useEffect, useMemo, useCallback} from 'react'
import {isAdmin, isLeaderOrAdmin} from '@/db/permissions-utils'
import Taro, {useDidShow} from '@tarojs/taro'
import {Picker} from '@tarojs/components'
import {useAuth} from '@/contexts/AuthContext'
import {supabase} from '@/client/supabase'
import {createProjectTrackingRecord, getProjectTrackingRecords} from '@/db/api'
import type {ProjectClassification, ProjectStage} from '@/db/types'

export default function EditProject() {
  const {profile} = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [project, setProject] = useState<any>(null)
  const [trackingRecords, setTrackingRecords] = useState<any[]>([])

  const projectId = useMemo(() => {
    const instance = Taro.getCurrentInstance()
    return instance.router?.params?.id || ''
  }, [])

  // 表单数据
  const [name, setName] = useState('')
  const [classification, setClassification] = useState<ProjectClassification>('b_class')
  const [constructionUnit, setConstructionUnit] = useState('')
  const [engineeringType, setEngineeringType] = useState('市政')
  const [investmentAmount, setInvestmentAmount] = useState('')
  const [projectOverview, setProjectOverview] = useState('')
  const [trackingProgress, setTrackingProgress] = useState('')
  const [stage, setStage] = useState<ProjectStage>('方案设计')
  const [expectedOpeningDate, setExpectedOpeningDate] = useState('')

  const classificationOptions: {value: ProjectClassification; label: string}[] = [
    {value: 'a_lock', label: 'A锁项目'},
    {value: 'a_compete', label: 'A争项目'},
    {value: 'b_class', label: 'B类项目'},
    {value: 'c_class', label: 'C类项目'},
    {value: 'd_class', label: 'D类项目'}
  ]

  const engineeringTypeOptions = ['市政', '水利', '公路', '新能源', '房建', '其他']

  const stageOptions: ProjectStage[] = [
    '方案设计',
    '立项',
    '可研',
    '初步设计',
    '施工图设计',
    '招标控制价编制',
    '招标文件编制',
    '投标阶段',
    '已中标',
    '放弃跟踪'
  ]

  const loadData = useCallback(async () => {
    if (!projectId || !profile) return

    try {
      setLoading(true)
      const {data: projectData, error: projectError} = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .maybeSingle()

      if (projectError) throw projectError
      if (!projectData) {
        Taro.showToast({title: '项目不存在', icon: 'none'})
        setTimeout(() => Taro.navigateBack(), 1500)
        return
      }

      setProject(projectData)
      setName(projectData.name || '')
      setClassification(projectData.classification || 'b_class')
      setConstructionUnit(projectData.construction_unit || '')
      setEngineeringType(projectData.engineering_type || '市政')
      setInvestmentAmount(projectData.investment_amount ? String(projectData.investment_amount / 10000) : '')
      setProjectOverview(projectData.project_overview || '')
      setStage(projectData.stage || '方案设计')
      setExpectedOpeningDate(projectData.expected_opening_date || '')

      // 加载跟踪记录
      const records = await getProjectTrackingRecords(projectId)
      setTrackingRecords(records)
    } catch (error) {
      console.error('加载项目失败:', error)
      Taro.showToast({title: '加载失败', icon: 'none'})
    } finally {
      setLoading(false)
    }
  }, [projectId, profile])

  useDidShow(() => {
    loadData()
  })

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleSubmit = async () => {
    if (!profile || !project) return

    // 校验必填项
    if (!name || !constructionUnit || !engineeringType) {
      Taro.showToast({title: '请填写所有必填项', icon: 'none'})
      return
    }

    // 检查权限：仅录入人和管理员可编辑
    const isAdmin = profile.role === 'super_admin' || profile.role === 'system_admin'
    const isCreator = project.responsible_person_id === profile.id
    if (!isAdmin && !isCreator) {
      Taro.showToast({title: '无权限编辑此项目', icon: 'none'})
      return
    }

    setSaving(true)
    try {
      const projectData = {
        name,
        classification,
        construction_unit: constructionUnit,
        project_type: engineeringType,
        engineering_type: engineeringType,
        investment_amount: investmentAmount ? parseFloat(investmentAmount) * 10000 : null,
        project_overview: projectOverview || null,
        stage,
        expected_opening_date: expectedOpeningDate || null
      }

      const {error} = await supabase
        .from('projects')
        .update(projectData)
        .eq('id', projectId)

      if (error) throw error

      // 如果有新的跟踪进展，创建跟踪记录
      if (trackingProgress) {
        await createProjectTrackingRecord({
          project_id: projectId,
          tracking_content: trackingProgress,
          updated_by: profile.id as string
        })
      }

      Taro.showToast({title: '保存成功', icon: 'success'})
      setTimeout(() => {
        Taro.navigateBack()
      }, 1500)
    } catch (error) {
      console.error('保存项目失败:', error)
      Taro.showToast({title: '保存失败', icon: 'none'})
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-xl text-muted-foreground">加载中...</div>
      </div>
    )
  }

  if (!project) {
    return null
  }

  // 检查权限
  const hasAdminRole = isAdmin(profile)
  const isCreator = project.responsible_person_id === profile?.id
  const canEdit = hasAdminRole || isCreator

  return (
    <div className="min-h-screen bg-background pb-6">
      {/* 头部 */}
      <div className="bg-gradient-primary px-6 py-6">
        <div className="text-2xl text-primary-foreground font-bold">编辑项目</div>
        <div className="text-base text-primary-foreground/80 mt-1">
          {canEdit ? '修改项目信息' : '查看项目信息（仅管理员和录入人可编辑）'}
        </div>
      </div>

      {/* 表单内容 */}
      <div className="px-6 py-6 flex flex-col gap-6">
        {/* 项目名称 */}
        <div>
          <div className="flex items-center gap-1 mb-2">
            <span className="text-xl text-foreground">项目名称</span>
            <span className="text-destructive">*</span>
          </div>
          <div className="border-2 border-input rounded px-4 py-3 bg-card">
            <input
              type="text"
              value={name}
              disabled={!canEdit}
              onInput={(e) => {
                const ev = e as unknown
                setName(
                  (ev as {detail?: {value?: string}}).detail?.value ??
                    (ev as {target?: {value?: string}}).target?.value ??
                    ''
                )
              }}
              placeholder="请输入项目名称"
              className="w-full text-xl text-foreground bg-transparent outline-none"
            />
          </div>
        </div>

        {/* 项目分级（下拉菜单） */}
        <div>
          <div className="text-xl text-foreground mb-2">项目分级</div>
          {canEdit ? (
            <Picker
              mode="selector"
              range={classificationOptions.map((c) => c.label)}
              value={classificationOptions.findIndex((c) => c.value === classification)}
              onChange={(e: any) => {
                const ev = e as unknown
                const value = (ev as {detail?: {value?: number}}).detail?.value ?? 0
                setClassification(classificationOptions[value].value)
              }}>
              <div className="border-2 border-input rounded px-4 py-3 bg-card flex items-center justify-between">
                <span className="text-xl text-foreground">
                  {classificationOptions.find((c) => c.value === classification)?.label || '请选择'}
                </span>
                <div className="i-mdi-chevron-down text-2xl text-muted-foreground" />
              </div>
            </Picker>
          ) : (
            <div className="border-2 border-input rounded px-4 py-3 bg-muted">
              <span className="text-xl text-foreground">
                {classificationOptions.find((c) => c.value === classification)?.label || '未设置'}
              </span>
            </div>
          )}
        </div>

        {/* 建设单位 */}
        <div>
          <div className="flex items-center gap-1 mb-2">
            <span className="text-xl text-foreground">建设单位</span>
            <span className="text-destructive">*</span>
          </div>
          <div className="border-2 border-input rounded px-4 py-3 bg-card">
            <input
              type="text"
              value={constructionUnit}
              disabled={!canEdit}
              onInput={(e) => {
                const ev = e as unknown
                setConstructionUnit(
                  (ev as {detail?: {value?: string}}).detail?.value ??
                    (ev as {target?: {value?: string}}).target?.value ??
                    ''
                )
              }}
              placeholder="请输入建设单位"
              className="w-full text-xl text-foreground bg-transparent outline-none"
            />
          </div>
        </div>

        {/* 工程类型（下拉菜单） */}
        <div>
          <div className="flex items-center gap-1 mb-2">
            <span className="text-xl text-foreground">工程类型</span>
            <span className="text-destructive">*</span>
          </div>
          {canEdit ? (
            <Picker
              mode="selector"
              range={engineeringTypeOptions}
              value={engineeringTypeOptions.indexOf(engineeringType)}
              onChange={(e: any) => {
                const ev = e as unknown
                const value = (ev as {detail?: {value?: number}}).detail?.value ?? 0
                setEngineeringType(engineeringTypeOptions[value])
              }}>
              <div className="border-2 border-input rounded px-4 py-3 bg-card flex items-center justify-between">
                <span className="text-xl text-foreground">{engineeringType}</span>
                <div className="i-mdi-chevron-down text-2xl text-muted-foreground" />
              </div>
            </Picker>
          ) : (
            <div className="border-2 border-input rounded px-4 py-3 bg-muted">
              <span className="text-xl text-foreground">{engineeringType}</span>
            </div>
          )}
        </div>

        {/* 投资规模 */}
        <div>
          <div className="text-xl text-foreground mb-2">投资规模（亿元）</div>
          <div className="border-2 border-input rounded px-4 py-3 bg-card">
            <input
              type="number"
              value={investmentAmount}
              disabled={!canEdit}
              onInput={(e) => {
                const ev = e as unknown
                setInvestmentAmount(
                  (ev as {detail?: {value?: string}}).detail?.value ??
                    (ev as {target?: {value?: string}}).target?.value ??
                    ''
                )
              }}
              placeholder="请输入投资规模"
              className="w-full text-xl text-foreground bg-transparent outline-none"
            />
          </div>
        </div>

        {/* 工程概况 */}
        <div>
          <div className="text-xl text-foreground mb-2">工程概况</div>
          <div className="border-2 border-input rounded px-4 py-3 bg-card">
            <textarea
              value={projectOverview}
              disabled={!canEdit}
              onInput={(e) => {
                const ev = e as unknown
                setProjectOverview(
                  (ev as {detail?: {value?: string}}).detail?.value ??
                    (ev as {target?: {value?: string}}).target?.value ??
                    ''
                )
              }}
              placeholder="请输入工程概况"
              className="w-full text-xl text-foreground bg-transparent outline-none"
              style={{minHeight: '100px'}}
            />
          </div>
        </div>

        {/* 预计开标时间 */}
        <div>
          <div className="text-xl text-foreground mb-2">预计开标时间</div>
          <div className="border-2 border-input rounded px-4 py-3 bg-card">
            <input
              type="date"
              value={expectedOpeningDate}
              disabled={!canEdit}
              onInput={(e) => {
                const ev = e as unknown
                setExpectedOpeningDate(
                  (ev as {detail?: {value?: string}}).detail?.value ??
                    (ev as {target?: {value?: string}}).target?.value ??
                    ''
                )
              }}
              placeholder="请选择预计开标时间"
              className="w-full text-xl text-foreground bg-transparent outline-none"
            />
          </div>
        </div>

        {/* 历史跟踪进展 */}
        {trackingRecords.length > 0 && (
          <div>
            <div className="text-xl text-foreground mb-3">历史跟踪进展</div>
            <div className="flex flex-col gap-3">
              {trackingRecords.map((record) => (
                <div key={record.id} className="bg-card rounded shadow-card p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-base text-primary font-bold">
                      {record.profiles?.name || '未知用户'}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {new Date(record.created_at).toLocaleString('zh-CN', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>
                  <div className="text-xl text-foreground whitespace-pre-wrap">{record.tracking_content}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 新增跟踪进展 */}
        {canEdit && (
          <div>
            <div className="text-xl text-foreground mb-2">新增跟踪进展</div>
            <div className="border-2 border-input rounded px-4 py-3 bg-card">
              <textarea
                value={trackingProgress}
                onInput={(e) => {
                  const ev = e as unknown
                  setTrackingProgress(
                    (ev as {detail?: {value?: string}}).detail?.value ??
                      (ev as {target?: {value?: string}}).target?.value ??
                      ''
                  )
                }}
                placeholder="请输入本次跟踪进展"
                className="w-full text-xl text-foreground bg-transparent outline-none"
                style={{minHeight: '100px'}}
              />
            </div>
          </div>
        )}

        {/* 项目阶段（下拉菜单） */}
        <div>
          <div className="text-xl text-foreground mb-2">项目阶段</div>
          {canEdit ? (
            <Picker
              mode="selector"
              range={stageOptions}
              value={stageOptions.indexOf(stage)}
              onChange={(e: any) => {
                const ev = e as unknown
                const value = (ev as {detail?: {value?: number}}).detail?.value ?? 0
                setStage(stageOptions[value])
              }}>
              <div className="border-2 border-input rounded px-4 py-3 bg-card flex items-center justify-between">
                <span className="text-xl text-foreground">{stage}</span>
                <div className="i-mdi-chevron-down text-2xl text-muted-foreground" />
              </div>
            </Picker>
          ) : (
            <div className="border-2 border-input rounded px-4 py-3 bg-muted">
              <span className="text-xl text-foreground">{stage}</span>
            </div>
          )}
        </div>

        {/* 提交按钮 */}
        {canEdit && (
          <div className="flex gap-3 mt-4">
            <button
              type="button"
              onClick={() => Taro.navigateBack()}
              disabled={saving}
              className="flex-1 py-4 bg-card border-2 border-border text-foreground text-xl rounded flex items-center justify-center leading-none">
              取消
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={saving}
              className="flex-1 py-4 bg-primary text-primary-foreground text-xl rounded flex items-center justify-center leading-none">
              {saving ? '保存中...' : '保存'}
            </button>
          </div>
        )}

        {!canEdit && (
          <div className="mt-4">
            <button
              type="button"
              onClick={() => Taro.navigateBack()}
              className="w-full py-4 bg-card border-2 border-border text-foreground text-xl rounded flex items-center justify-center leading-none">
              返回
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
