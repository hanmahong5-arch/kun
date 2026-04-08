import {useState, useEffect, useCallback} from 'react'
import Taro from '@tarojs/taro'
import {Picker} from '@tarojs/components'
import {useAuth} from '@/contexts/AuthContext'
import {supabase} from '@/client/supabase'
import {createProjectTrackingRecord, getAllProfiles} from '@/db/api'
import type {ProjectClassification, ProjectStage} from '@/db/types'

export default function CreateProject() {
  const {profile} = useAuth()
  const [loading, setLoading] = useState(false)
  const [allUsers, setAllUsers] = useState<any[]>([])

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
  const [responsiblePersonId, setResponsiblePersonId] = useState('')

  // 加载所有用户
  const loadUsers = useCallback(async () => {
    try {
      const users = await getAllProfiles()
      setAllUsers(Array.isArray(users) ? users : [])
      // 默认选择当前用户
      if (profile?.id) {
        setResponsiblePersonId(profile.id as string)
      }
    } catch (error) {
      console.error('加载用户列表失败:', error)
    }
  }, [profile])

  useEffect(() => {
    loadUsers()
  }, [loadUsers])

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

  const handleSubmit = async () => {
    if (!profile) return

    // 校验必填项
    if (!name || !constructionUnit || !engineeringType) {
      Taro.showToast({title: '请填写所有必填项', icon: 'none'})
      return
    }

    setLoading(true)
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
        responsible_person_id: responsiblePersonId || profile.id,
        expected_opening_date: expectedOpeningDate || null
      }

      const {data: newProject, error} = await supabase
        .from('projects')
        .insert(projectData)
        .select()
        .maybeSingle()

      if (error) throw error

      // 如果有跟踪进展，创建跟踪记录
      if (trackingProgress && newProject) {
        await createProjectTrackingRecord({
          project_id: newProject.id,
          tracking_content: trackingProgress,
          updated_by: profile.id as string
        })
      }

      Taro.showToast({title: '创建成功', icon: 'success'})
      setTimeout(() => {
        Taro.navigateBack()
      }, 1500)
    } catch (error) {
      console.error('创建项目失败:', error)
      Taro.showToast({title: '创建失败', icon: 'none'})
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background pb-6">
      {/* 头部 */}
      <div className="bg-gradient-primary px-6 py-6">
        <div className="text-2xl text-primary-foreground font-bold">新增项目</div>
        <div className="text-base text-primary-foreground/80 mt-1">填写项目基本信息</div>
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
        </div>

        {/* 投资规模 */}
        <div>
          <div className="text-xl text-foreground mb-2">投资规模（亿元）</div>
          <div className="border-2 border-input rounded px-4 py-3 bg-card">
            <input
              type="number"
              value={investmentAmount}
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

        {/* 项目负责人 */}
        <div>
          <div className="text-xl text-foreground mb-2">项目负责人</div>
          <Picker
            mode="selector"
            range={allUsers.map((u) => u.name || u.phone || '未命名')}
            value={allUsers.findIndex((u) => u.id === responsiblePersonId)}
            onChange={(e: any) => {
              const ev = e as unknown
              const value = (ev as {detail?: {value?: number}}).detail?.value ?? 0
              setResponsiblePersonId(allUsers[value]?.id || '')
            }}>
            <div className="border-2 border-input rounded px-4 py-3 bg-card flex items-center justify-between">
              <span className="text-xl text-foreground">
                {allUsers.find((u) => u.id === responsiblePersonId)?.name ||
                  allUsers.find((u) => u.id === responsiblePersonId)?.phone ||
                  '请选择负责人'}
              </span>
              <div className="i-mdi-chevron-down text-2xl text-muted-foreground" />
            </div>
          </Picker>
        </div>

        {/* 工程概况 */}
        <div>
          <div className="text-xl text-foreground mb-2">工程概况</div>
          <div className="border-2 border-input rounded px-4 py-3 bg-card">
            <textarea
              value={projectOverview}
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

        {/* 跟踪进展 */}
        <div>
          <div className="text-xl text-foreground mb-2">跟踪进展</div>
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
              placeholder="请输入当前跟踪进展"
              className="w-full text-xl text-foreground bg-transparent outline-none"
              style={{minHeight: '100px'}}
            />
          </div>
        </div>

        {/* 项目阶段（下拉菜单） */}
        <div>
          <div className="text-xl text-foreground mb-2">项目阶段</div>
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
        </div>

        {/* 提交按钮 */}
        <div className="flex gap-3 mt-4">
          <button
            type="button"
            onClick={() => Taro.navigateBack()}
            disabled={loading}
            className="flex-1 py-4 bg-card border-2 border-border text-foreground text-xl rounded flex items-center justify-center leading-none">
            取消
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1 py-4 bg-primary text-primary-foreground text-xl rounded flex items-center justify-center leading-none">
            {loading ? '提交中...' : '提交'}
          </button>
        </div>
      </div>
    </div>
  )
}
