import {useCallback, useEffect, useState, useMemo} from 'react'
import Taro, {useDidShow, getEnv} from '@tarojs/taro'
import {Picker} from '@tarojs/components'
import {withRouteGuard} from '@/components/RouteGuard'
import {useAuth} from '@/contexts/AuthContext'
import {supabase} from '@/client/supabase'
import {getAllProjects, getTeamProjects, getAllProfiles, getProjectTrackingRecords} from '@/db/api'
import type {Project, ProjectClassification, ProjectStage} from '@/db/types'
import {exportToExcel, exportToPDF, type ExportProject} from '@/utils/export'

function Projects() {
  const {profile} = useAuth()
  const [projects, setProjects] = useState<any[]>([])
  const [allUsers, setAllUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [classFilter, setClassFilter] = useState<ProjectClassification | 'all'>('all')
  const [personFilter, setPersonFilter] = useState<string>('all')
  const [searchKeyword, setSearchKeyword] = useState('')
  const [batchMode, setBatchMode] = useState(false)
  const [selectedProjects, setSelectedProjects] = useState<string[]>([])
  const [showBatchActions, setShowBatchActions] = useState(false)
  const [showExportConfig, setShowExportConfig] = useState(false)
  const [showFieldSelector, setShowFieldSelector] = useState(false)
  const [selectedFields, setSelectedFields] = useState<string[]>([
    '项目名称',
    '项目分级',
    '建设单位',
    '工程类型',
    '投资规模',
    '项目阶段',
    '负责人',
    '创建时间'
  ])
  const [exportTemplates, setExportTemplates] = useState<Array<{name: string; fields: string[]}>>([])
  const [templateName, setTemplateName] = useState('')
  const [showArchived, setShowArchived] = useState(false)

  const loadData = useCallback(async () => {
    if (!profile) return

    try {
      setLoading(true)
      const isLeaderOrAdmin = ['leader', 'system_admin'].includes(profile.role as string)
      const [projectsData, usersData] = await Promise.all([
        isLeaderOrAdmin ? getAllProjects() : getTeamProjects(profile.id as string),
        getAllProfiles()
      ])
      setProjects(Array.isArray(projectsData) ? projectsData : [])
      setAllUsers(Array.isArray(usersData) ? usersData : [])
    } catch (error) {
      console.error('加载项目失败:', error)
      Taro.showToast({title: '加载失败', icon: 'none'})
    } finally {
      setLoading(false)
    }
  }, [profile])

  useDidShow(() => {
    loadData()
  })

  useEffect(() => {
    loadData()
  }, [loadData])

  // 加载导出模板
  useEffect(() => {
    const savedTemplates = Taro.getStorageSync('export_templates')
    if (savedTemplates) {
      setExportTemplates(JSON.parse(savedTemplates))
    }
  }, [])

  const getClassificationLabel = (classification: string) => {
    const labels: Record<string, string> = {
      a_lock: 'A锁',
      a_compete: 'A争',
      b: 'B类'
    }
    return labels[classification] || classification
  }

  // 所有可导出字段
  const availableFields = [
    '项目名称',
    '项目分级',
    '建设单位',
    '工程类型',
    '投资规模',
    '项目阶段',
    '负责人',
    '工程概况',
    '项目简介',
    '历史跟踪进展',
    '创建时间',
    '更新时间',
    '项目地址',
    '联系人',
    '联系电话'
  ]

  // 项目阶段选项
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

  // 筛选项目
  let filteredProjects = projects.filter((project) => {
    // 默认隐藏归档项目，除非开启显示归档项目开关
    if (!showArchived && project.is_archived) return false
    // 隐藏"已中标"和"放弃跟踪"状态的项目
    if (project.stage === '已中标' || project.stage === '放弃跟踪') return false
    if (classFilter !== 'all' && project.classification !== classFilter) return false
    if (personFilter !== 'all' && project.responsible_person_id !== personFilter) return false
    if (searchKeyword && !project.name.includes(searchKeyword)) return false
    return true
  })

  // 按项目分级排序：A锁 > A争 > B类 > C类 > D类
  const classificationOrder: Record<string, number> = {
    a_lock: 1,
    a_compete: 2,
    b_class: 3,
    c_class: 4,
    d_class: 5
  }
  
  filteredProjects = filteredProjects.sort((a, b) => {
    const orderA = classificationOrder[a.classification] || 999
    const orderB = classificationOrder[b.classification] || 999
    return orderA - orderB
  })

  // 统计数据（排除"已中标"和"放弃跟踪"状态的项目）
  const stats = useMemo(() => {
    // 过滤出未中标的项目（排除"已中标"和"放弃跟踪"）
    const activeProjects = projects.filter((p) => p.stage !== '已中标' && p.stage !== '放弃跟踪')
    
    const total = activeProjects.length
    const aLockCount = activeProjects.filter((p) => p.classification === 'a_lock').length
    const aCompeteCount = activeProjects.filter((p) => p.classification === 'a_compete').length
    
    // 计算合计合同额（未中标项目的投资规模总和）
    const totalAmount = activeProjects
      .filter((p) => p.investment_amount)
      .reduce((sum, p) => sum + (p.investment_amount || 0), 0)
    
    // 计算A锁项目合计金额（未中标的A锁项目的投资规模总和）
    const aLockAmount = activeProjects
      .filter((p) => p.classification === 'a_lock' && p.investment_amount)
      .reduce((sum, p) => sum + (p.investment_amount || 0), 0)
    
    // 计算A争项目合计金额（未中标的A争项目的投资规模总和）
    const aCompeteAmount = activeProjects
      .filter((p) => p.classification === 'a_compete' && p.investment_amount)
      .reduce((sum, p) => sum + (p.investment_amount || 0), 0)
    
    return {total, aLockCount, aCompeteCount, totalAmount, aLockAmount, aCompeteAmount}
  }, [projects])

  const handleViewProject = (id: string) => {
    Taro.navigateTo({url: `/pages/projects/detail/index?id=${id}`})
  }

  const handleAddProject = () => {
    Taro.navigateTo({url: '/pages/projects/create/index'})
  }

  const handleExport = () => {
    // 检查是否在H5环境
    const env = getEnv()
    if (env !== 'WEB') {
      Taro.showToast({title: '导出功能仅支持H5版本', icon: 'none'})
      return
    }
    setShowExportConfig(true)
  }

  const handleToggleField = (field: string) => {
    if (selectedFields.includes(field)) {
      setSelectedFields(selectedFields.filter((f) => f !== field))
    } else {
      setSelectedFields([...selectedFields, field])
    }
  }

  const handleMoveFieldUp = (index: number) => {
    if (index === 0) return
    const newFields = [...selectedFields]
    const temp = newFields[index]
    newFields[index] = newFields[index - 1]
    newFields[index - 1] = temp
    setSelectedFields(newFields)
  }

  const handleMoveFieldDown = (index: number) => {
    if (index === selectedFields.length - 1) return
    const newFields = [...selectedFields]
    const temp = newFields[index]
    newFields[index] = newFields[index + 1]
    newFields[index + 1] = temp
    setSelectedFields(newFields)
  }

  const handleSaveTemplate = () => {
    if (!templateName.trim()) {
      Taro.showToast({title: '请输入模板名称', icon: 'none'})
      return
    }
    const newTemplate = {name: templateName, fields: selectedFields}
    const newTemplates = [...exportTemplates, newTemplate]
    setExportTemplates(newTemplates)
    Taro.setStorageSync('export_templates', JSON.stringify(newTemplates))
    setTemplateName('')
    Taro.showToast({title: '模板保存成功', icon: 'success'})
  }

  const handleLoadTemplate = (template: {name: string; fields: string[]}) => {
    setSelectedFields(template.fields)
    Taro.showToast({title: `已加载模板: ${template.name}`, icon: 'success'})
  }

  const handleDeleteTemplate = (index: number) => {
    const newTemplates = exportTemplates.filter((_, i) => i !== index)
    setExportTemplates(newTemplates)
    Taro.setStorageSync('export_templates', JSON.stringify(newTemplates))
    Taro.showToast({title: '模板删除成功', icon: 'success'})
  }

  const prepareExportData = async (): Promise<ExportProject[]> => {
    const exportProjects: ExportProject[] = []

    for (const project of filteredProjects) {
      // 获取跟踪记录
      const trackingRecords = await getProjectTrackingRecords(project.id)

      exportProjects.push({
        id: project.id,
        name: project.name,
        classification: getClassificationLabel(project.classification),
        construction_unit: project.construction_unit || '',
        project_type: project.project_type || '',
        investment_amount: project.investment_amount,
        stage: project.stage || '',
        responsible_person: project.profiles?.name || '',
        project_overview: project.project_overview || '',
        project_introduction: project.project_introduction || '',
        created_at: project.created_at,
        tracking_records: trackingRecords.map((r: any) => ({
          content: r.content || '',
          created_at: r.created_at,
          creator_name: r.profiles?.name || ''
        })),
        bidding_info: {
          bid_amount: project.bid_amount || null,
          bid_date: project.bid_date || null,
          bid_result: project.bid_result || null
        }
      })
    }

    return exportProjects
  }

  const handleExportExcel = async () => {
    try {
      Taro.showLoading({title: '准备导出数据...'})
      const exportData = await prepareExportData()
      exportToExcel(exportData, selectedFields)
      Taro.hideLoading()
      Taro.showToast({title: '导出成功', icon: 'success'})
      setShowExportConfig(false)
      setShowFieldSelector(false)
    } catch (error) {
      console.error('导出Excel失败:', error)
      Taro.hideLoading()
      Taro.showToast({title: '导出失败', icon: 'none'})
    }
  }

  const handleExportPDF = async () => {
    try {
      Taro.showLoading({title: '准备导出数据...'})
      const exportData = await prepareExportData()
      exportToPDF(exportData, selectedFields)
      Taro.hideLoading()
      Taro.showToast({title: '导出成功', icon: 'success'})
      setShowExportConfig(false)
      setShowFieldSelector(false)
    } catch (error) {
      console.error('导出PDF失败:', error)
      Taro.hideLoading()
      Taro.showToast({title: '导出失败', icon: 'none'})
    }
  }

  const handleExportCSV = () => {
    // 准备导出数据
    const exportData = filteredProjects.map((project) => {
      return {
        项目名称: project.name,
        项目分级: getClassificationLabel(project.classification),
        建设单位: project.construction_unit || '',
        工程类型: project.project_type || '',
        投资规模: project.investment_amount ? `${project.investment_amount}万元` : '',
        对接负责人: project.profiles?.name || '',
        项目阶段: project.stage || '',
        工程概况: project.project_overview || '',
        项目简介: project.project_introduction || '',
        创建时间: new Date(project.created_at).toLocaleDateString('zh-CN')
      }
    })

    // 转换为CSV格式
    const headers = Object.keys(exportData[0] || {})
    const csvContent = [
      headers.join(','),
      ...exportData.map((row) => headers.map((h) => `"${(row as any)[h] || ''}"`).join(','))
    ].join('\n')

    // 创建下载
    const blob = new Blob(['\ufeff' + csvContent], {type: 'text/csv;charset=utf-8;'})
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `项目列表_${new Date().toLocaleDateString('zh-CN').replace(/\//g, '')}.csv`
    link.click()
    URL.revokeObjectURL(url)

    Taro.showToast({title: '导出成功', icon: 'success'})
    setShowExportConfig(false)
  }

  const handleToggleBatchMode = () => {
    setBatchMode(!batchMode)
    setSelectedProjects([])
    setShowBatchActions(false)
  }

  const handleSelectProject = (projectId: string) => {
    if (selectedProjects.includes(projectId)) {
      setSelectedProjects(selectedProjects.filter((id) => id !== projectId))
    } else {
      setSelectedProjects([...selectedProjects, projectId])
    }
  }

  const handleSelectAll = () => {
    if (selectedProjects.length === filteredProjects.length) {
      setSelectedProjects([])
    } else {
      setSelectedProjects(filteredProjects.map((p) => p.id))
    }
  }

  const handleBatchDelete = async () => {
    if (selectedProjects.length === 0) {
      Taro.showToast({title: '请选择项目', icon: 'none'})
      return
    }

    const res = await Taro.showModal({
      title: '确认删除',
      content: `确定要删除选中的${selectedProjects.length}个项目吗？此操作不可恢复`,
      confirmText: '删除',
      cancelText: '取消'
    })

    if (!res.confirm) return

    try {
      await Promise.all(selectedProjects.map((id) => supabase.from('projects').delete().eq('id', id)))
      Taro.showToast({title: '删除成功', icon: 'success'})
      setSelectedProjects([])
      setBatchMode(false)
      loadData()
    } catch (error) {
      console.error('批量删除失败:', error)
      Taro.showToast({title: '删除失败', icon: 'none'})
    }
  }

  const handleBatchUpdateClassification = async (classification: ProjectClassification) => {
    if (selectedProjects.length === 0) {
      Taro.showToast({title: '请选择项目', icon: 'none'})
      return
    }

    try {
      await Promise.all(selectedProjects.map((id) => supabase.from('projects').update({classification}).eq('id', id)))
      Taro.showToast({title: '修改成功', icon: 'success'})
      setSelectedProjects([])
      setBatchMode(false)
      setShowBatchActions(false)
      loadData()
    } catch (error) {
      console.error('批量修改分级失败:', error)
      Taro.showToast({title: '修改失败', icon: 'none'})
    }
  }

  const handleBatchUpdateStage = async (stage: ProjectStage) => {
    if (selectedProjects.length === 0) {
      Taro.showToast({title: '请选择项目', icon: 'none'})
      return
    }

    try {
      await Promise.all(selectedProjects.map((id) => supabase.from('projects').update({stage}).eq('id', id)))
      Taro.showToast({title: '修改成功', icon: 'success'})
      setSelectedProjects([])
      setBatchMode(false)
      setShowBatchActions(false)
      loadData()
    } catch (error) {
      console.error('批量修改阶段失败:', error)
      Taro.showToast({title: '修改失败', icon: 'none'})
    }
  }

  const handleBatchAssignPerson = async (personId: string) => {
    if (selectedProjects.length === 0) {
      Taro.showToast({title: '请选择项目', icon: 'none'})
      return
    }

    try {
      await Promise.all(selectedProjects.map((id) => supabase.from('projects').update({responsible_person_id: personId}).eq('id', id)))
      Taro.showToast({title: '分配成功', icon: 'success'})
      setSelectedProjects([])
      setBatchMode(false)
      setShowBatchActions(false)
      loadData()
    } catch (error) {
      console.error('批量分配负责人失败:', error)
      Taro.showToast({title: '分配失败', icon: 'none'})
    }
  }

  const isAdmin = profile && ['system_admin', 'admin'].includes(profile.role as string)

  return (
    <div className="min-h-screen bg-background pb-6">
      {/* 头部 */}
      <div className="bg-gradient-primary px-6 py-6">
        <div className="flex items-center justify-between mb-2">
          <div className="text-2xl text-primary-foreground font-bold">项目管理</div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => Taro.navigateTo({url: '/pages/projects/analytics/index'})}
              className="px-4 py-2 bg-primary-foreground/20 text-primary-foreground text-base rounded flex items-center gap-1 leading-none">
              <div className="i-mdi-chart-line text-lg" />
              <span>分析</span>
            </button>
            <button
              type="button"
              onClick={() => Taro.navigateTo({url: '/pages/projects/timeline/index'})}
              className="px-4 py-2 bg-primary-foreground/20 text-primary-foreground text-base rounded flex items-center gap-1 leading-none">
              <div className="i-mdi-timeline text-lg" />
              <span>时间轴</span>
            </button>
            {isAdmin && (
              <button
                type="button"
                onClick={handleToggleBatchMode}
                className="px-4 py-2 bg-primary-foreground/20 text-primary-foreground text-base rounded flex items-center gap-1 leading-none">
                <div className={`${batchMode ? 'i-mdi-close' : 'i-mdi-checkbox-multiple-marked'} text-lg`} />
                <span>{batchMode ? '取消' : '批量'}</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleExport}
              className="px-4 py-2 bg-primary-foreground/20 text-primary-foreground text-base rounded flex items-center gap-1 leading-none">
              <div className="i-mdi-download text-lg" />
              <span>导出</span>
            </button>
          </div>
        </div>
        <div className="text-base text-primary-foreground/80">项目台账与跟进记录</div>
      </div>
      {/* 批量操作栏 */}
      {batchMode && (
        <div className="px-6 py-4 bg-card border-b border-border">
          <div className="flex items-center justify-between mb-3">
            <div className="text-xl text-foreground">
              已选择 <span className="text-primary font-bold">{selectedProjects.length}</span> 个项目
            </div>
            <button
              type="button"
              onClick={handleSelectAll}
              className="px-4 py-2 bg-primary text-primary-foreground text-base rounded flex items-center justify-center leading-none">
              {selectedProjects.length === filteredProjects.length ? '取消全选' : '全选'}
            </button>
          </div>
          <div className="flex gap-2 overflow-x-auto">
            <button
              type="button"
              onClick={handleBatchDelete}
              className="px-4 py-2 bg-destructive text-destructive-foreground text-base rounded flex items-center justify-center leading-none break-keep">
              删除
            </button>
            <button
              type="button"
              onClick={() => setShowBatchActions(!showBatchActions)}
              className="px-4 py-2 bg-primary text-primary-foreground text-base rounded flex items-center justify-center leading-none break-keep">
              更多操作
            </button>
          </div>
          {showBatchActions && (
            <div className="mt-3 p-4 bg-background rounded">
              <div className="mb-3">
                <div className="text-base text-muted-foreground mb-2">修改分级</div>
                <div className="flex gap-2 overflow-x-auto">
                  <button
                    type="button"
                    onClick={() => handleBatchUpdateClassification('a_lock')}
                    className="px-4 py-2 bg-card border border-border text-foreground text-base rounded flex items-center justify-center leading-none break-keep">
                    A锁
                  </button>
                  <button
                    type="button"
                    onClick={() => handleBatchUpdateClassification('a_compete')}
                    className="px-4 py-2 bg-card border border-border text-foreground text-base rounded flex items-center justify-center leading-none break-keep">
                    A争
                  </button>
                  <button
                    type="button"
                    onClick={() => handleBatchUpdateClassification('b_class')}
                    className="px-4 py-2 bg-card border border-border text-foreground text-base rounded flex items-center justify-center leading-none break-keep">
                    B类
                  </button>
                </div>
              </div>
              <div className="mb-3">
                <div className="text-base text-muted-foreground mb-2">修改阶段</div>
                <div className="flex gap-2 overflow-x-auto">
                  {stageOptions.map((stage) => (
                    <button
                      key={stage}
                      type="button"
                      onClick={() => handleBatchUpdateStage(stage)}
                      className="px-4 py-2 bg-card border border-border text-foreground text-base rounded flex items-center justify-center leading-none break-keep">
                      {stage}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-base text-muted-foreground mb-2">分配负责人</div>
                <div className="flex gap-2 overflow-x-auto">
                  {allUsers.map((user) => (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => handleBatchAssignPerson(user.id)}
                      className="px-4 py-2 bg-card border border-border text-foreground text-base rounded flex items-center justify-center leading-none break-keep">
                      {user.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      {/* 统计看板 */}
      <div className="px-6 py-4 bg-card">
        <div className="grid grid-cols-3 gap-3">
          <div
            onClick={() => setClassFilter('all')}
            className="bg-gradient-primary rounded p-4 flex flex-col items-center">
            <div className="text-3xl text-primary-foreground font-bold">{stats.total}</div>
            <div className="text-base text-primary-foreground/80 mt-1">项目总数</div>
          </div>
          <div
            onClick={() => setClassFilter('a_lock')}
            className="bg-gradient-subtle rounded p-4 flex flex-col items-center">
            <div className="text-3xl text-primary font-bold">{stats.aLockCount}</div>
            <div className="text-base text-muted-foreground mt-1">A锁项目</div>
          </div>
          <div
            onClick={() => setClassFilter('a_compete')}
            className="bg-gradient-subtle rounded p-4 flex flex-col items-center">
            <div className="text-3xl text-success font-bold">{stats.aCompeteCount}</div>
            <div className="text-base text-muted-foreground mt-1">A争项目</div>
          </div>
        </div>

        {/* 合计金额显示 */}
        <div className="mt-4 grid grid-cols-3 gap-3">
          <div className="bg-gradient-subtle rounded p-4 flex flex-col items-center">
            <div className="text-2xl text-foreground font-bold">
              {stats.totalAmount >= 10000 
                ? `${(stats.totalAmount / 10000).toFixed(1)}亿` 
                : `${stats.totalAmount}万元`}
            </div>
            <div className="text-base text-muted-foreground mt-1">合计合同额</div>
          </div>
          <div className="bg-gradient-subtle rounded p-4 flex flex-col items-center">
            <div className="text-2xl text-primary font-bold">
              {stats.aLockAmount >= 10000 
                ? `${(stats.aLockAmount / 10000).toFixed(1)}亿` 
                : `${stats.aLockAmount}万元`}
            </div>
            <div className="text-base text-muted-foreground mt-1">A锁合计</div>
          </div>
          <div className="bg-gradient-subtle rounded p-4 flex flex-col items-center">
            <div className="text-2xl text-success font-bold">
              {stats.aCompeteAmount >= 10000 
                ? `${(stats.aCompeteAmount / 10000).toFixed(1)}亿` 
                : `${stats.aCompeteAmount}万元`}
            </div>
            <div className="text-base text-muted-foreground mt-1">A争合计</div>
          </div>
        </div>
      </div>
      {/* 筛选区 */}
      <div className="px-6 py-4 bg-card">
        {/* 搜索框 */}
        <div className="border-2 border-input rounded px-4 py-3 bg-background mb-3">
          <input
            type="text"
            value={searchKeyword}
            onInput={(e) => {
              const ev = e as unknown
              setSearchKeyword(
                (ev as {detail?: {value?: string}}).detail?.value ??
                  (ev as {target?: {value?: string}}).target?.value ??
                  ''
              )
            }}
            placeholder="搜索项目名称"
            className="w-full text-xl text-foreground bg-transparent outline-none"
          />
        </div>

        {/* 项目分级筛选 */}
        <div className="mb-3">
          <div className="text-base text-muted-foreground mb-2">项目分级</div>
          <div className="border-2 border-input rounded px-4 py-3 bg-background overflow-hidden">
            <select
              value={classFilter}
              onChange={(e) => {
                const ev = e as unknown
                setClassFilter(
                  ((ev as {detail?: {value?: string}}).detail?.value ??
                    (ev as {target?: {value?: string}}).target?.value ??
                    'all') as ProjectClassification | 'all'
                )
              }}
              className="w-full text-xl text-foreground bg-transparent outline-none">
              <option value="all">全部</option>
              <option value="a_lock">A锁项目</option>
              <option value="a_compete">A争项目</option>
              <option value="b">B类项目</option>
            </select>
          </div>
        </div>

        {/* 负责人筛选 */}
        {allUsers.length > 0 && (
          <div className="mb-3">
            <div className="text-base text-muted-foreground mb-2">负责人</div>
            <div className="border-2 border-input rounded px-4 py-3 bg-background overflow-hidden">
              <select
                value={personFilter}
                onChange={(e) => {
                  const ev = e as unknown
                  setPersonFilter(
                    (ev as {detail?: {value?: string}}).detail?.value ??
                      (ev as {target?: {value?: string}}).target?.value ??
                      'all'
                  )
                }}
                className="w-full text-xl text-foreground bg-transparent outline-none">
                <option value="all">全部</option>
                {allUsers.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* 显示归档项目开关 */}
        <div className="flex items-center justify-between bg-card rounded px-4 py-3 border border-border mt-3">
          <div className="flex items-center gap-2">
            <div className="i-mdi-archive text-2xl text-muted-foreground" />
            <span className="text-xl text-foreground">显示归档项目</span>
          </div>
          <button
            type="button"
            onClick={() => setShowArchived(!showArchived)}
            className={`w-14 h-8 rounded-full transition-colors relative ${
              showArchived ? 'bg-primary' : 'bg-muted'
            }`}>
            <div
              className={`absolute top-1 w-6 h-6 rounded-full bg-white transition-transform ${
                showArchived ? 'translate-x-7' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

      </div>
      {/* 项目列表 */}
      <div className="px-6 mt-4">
        {loading ? (
          <div className="text-center py-12">
            <div className="text-xl text-muted-foreground">加载中...</div>
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="text-center py-12">
            <div className="i-mdi-folder-outline text-6xl text-muted-foreground mb-4" />
            <div className="text-xl text-muted-foreground mb-4">暂无项目</div>
            <button
              type="button"
              onClick={handleAddProject}
              className="px-6 py-3 bg-primary text-primary-foreground text-xl rounded flex items-center justify-center leading-none mx-auto">
              <div className="i-mdi-plus text-2xl mr-2" />
              新增项目
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filteredProjects.map((project) => (
              <div
                key={project.id}
                className={`rounded p-4 border ${
                  project.is_archived
                    ? 'bg-muted/30 border-muted opacity-70'
                    : 'bg-card border-border'
                }`}>
                <div className="flex items-start gap-3">
                  {batchMode && (
                    <div
                      onClick={(e) => {
                        e.stopPropagation()
                        handleSelectProject(project.id)
                      }}
                      className="flex-shrink-0 pt-1">
                      <div
                        className={`w-6 h-6 rounded border-2 flex items-center justify-center ${
                          selectedProjects.includes(project.id)
                            ? 'bg-primary border-primary'
                            : 'border-border bg-background'
                        }`}>
                        {selectedProjects.includes(project.id) && (
                          <div className="i-mdi-check text-primary-foreground text-lg" />
                        )}
                      </div>
                    </div>
                  )}
                  <div
                    className="flex-1"
                    onClick={() => !batchMode && handleViewProject(project.id)}>
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="text-xl text-foreground font-bold mb-1">{project.name}</div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-2 py-1 bg-primary/10 text-primary text-base rounded">
                            {getClassificationLabel(project.classification)}
                          </span>
                          {project.stage && (
                            <span className="px-2 py-1 bg-muted text-muted-foreground text-base rounded">{project.stage}</span>
                          )}
                          {project.is_archived && (
                            <span className="px-2 py-1 bg-muted text-muted-foreground text-base rounded flex items-center gap-1">
                              <div className="i-mdi-archive text-base" />
                              已归档
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                <div className="flex items-center gap-2 mb-2">
                  <div className="i-mdi-domain text-xl text-muted-foreground" />
                  <span className="text-base text-foreground">{project.construction_unit}</span>
                </div>

                <div className="flex items-center gap-2 mb-2">
                  <div className="i-mdi-tag text-xl text-muted-foreground" />
                  <span className="text-base text-foreground">{project.project_type}</span>
                </div>

                    {project.investment_amount && (
                      <div className="flex items-center gap-2 mb-2">
                        <div className="i-mdi-currency-cny text-xl text-muted-foreground" />
                        <span className="text-base text-foreground">{project.investment_amount} 万元</span>
                      </div>
                    )}

                    {project.team_group && (
                      <div className="flex items-center gap-2">
                        <div className="i-mdi-account-group text-xl text-muted-foreground" />
                        <span className="text-base text-muted-foreground">{project.team_group}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {/* 导出配置对话框 */}
      {showExportConfig && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowExportConfig(false)}>
          <div className="bg-card rounded-lg p-6 m-6 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <div className="text-2xl text-foreground font-bold mb-4">选择导出格式</div>
            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowExportConfig(false)
                  setShowFieldSelector(true)
                }}
                className="px-6 py-4 bg-card border-2 border-primary text-primary text-xl rounded flex items-center justify-center leading-none">
                <div className="i-mdi-cog text-2xl mr-2" />
                自定义字段
              </button>
              <button
                type="button"
                onClick={handleExportCSV}
                className="px-6 py-4 bg-primary text-primary-foreground text-xl rounded flex items-center justify-center leading-none">
                <div className="i-mdi-file-delimited text-2xl mr-2" />
                导出为 CSV
              </button>
              <button
                type="button"
                onClick={handleExportExcel}
                className="px-6 py-4 bg-success text-white text-xl rounded flex items-center justify-center leading-none">
                <div className="i-mdi-file-excel text-2xl mr-2" />
                导出为 Excel
              </button>
              <button
                type="button"
                onClick={handleExportPDF}
                className="px-6 py-4 bg-destructive text-destructive-foreground text-xl rounded flex items-center justify-center leading-none">
                <div className="i-mdi-file-pdf text-2xl mr-2" />
                导出为 PDF
              </button>
              <button
                type="button"
                onClick={() => setShowExportConfig(false)}
                className="px-6 py-4 bg-muted text-muted-foreground text-xl rounded flex items-center justify-center leading-none">
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 字段选择对话框 */}
      {showFieldSelector && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowFieldSelector(false)}>
          <div className="bg-card rounded-lg p-6 m-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="text-2xl text-foreground font-bold mb-4">自定义导出字段</div>
            
            {/* 已保存的模板 */}
            {exportTemplates.length > 0 && (
              <div className="mb-4">
                <div className="text-base text-muted-foreground mb-2">已保存的模板</div>
                <div className="flex flex-col gap-2">
                  {exportTemplates.map((template, index) => (
                    <div key={index} className="flex items-center justify-between bg-background rounded px-4 py-2">
                      <span className="text-base text-foreground">{template.name}</span>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleLoadTemplate(template)}
                          className="px-3 py-1 bg-primary text-primary-foreground text-sm rounded flex items-center justify-center leading-none">
                          加载
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteTemplate(index)}
                          className="px-3 py-1 bg-destructive text-destructive-foreground text-sm rounded flex items-center justify-center leading-none">
                          删除
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 字段选择 */}
            <div className="mb-4">
              <div className="text-base text-muted-foreground mb-2">选择导出字段</div>
              <div className="grid grid-cols-2 gap-2">
                {availableFields.map((field) => (
                  <div
                    key={field}
                    onClick={() => handleToggleField(field)}
                    className={`px-4 py-2 rounded border-2 cursor-pointer ${
                      selectedFields.includes(field)
                        ? 'bg-primary/10 border-primary text-primary'
                        : 'bg-background border-border text-foreground'
                    }`}>
                    <div className="flex items-center gap-2">
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                        selectedFields.includes(field) ? 'bg-primary border-primary' : 'border-border'
                      }`}>
                        {selectedFields.includes(field) && (
                          <div className="i-mdi-check text-primary-foreground text-sm" />
                        )}
                      </div>
                      <span className="text-base">{field}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 字段排序 */}
            {selectedFields.length > 0 && (
              <div className="mb-4">
                <div className="text-base text-muted-foreground mb-2">字段顺序（拖动调整）</div>
                <div className="flex flex-col gap-2">
                  {selectedFields.map((field, index) => (
                    <div key={field} className="flex items-center gap-2 bg-background rounded px-4 py-2">
                      <span className="text-base text-foreground flex-1">{field}</span>
                      <button
                        type="button"
                        onClick={() => handleMoveFieldUp(index)}
                        disabled={index === 0}
                        className={`px-2 py-1 rounded ${
                          index === 0 ? 'bg-muted text-muted-foreground' : 'bg-primary text-primary-foreground'
                        }`}>
                        <div className="i-mdi-arrow-up text-lg" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveFieldDown(index)}
                        disabled={index === selectedFields.length - 1}
                        className={`px-2 py-1 rounded ${
                          index === selectedFields.length - 1 ? 'bg-muted text-muted-foreground' : 'bg-primary text-primary-foreground'
                        }`}>
                        <div className="i-mdi-arrow-down text-lg" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 保存为模板 */}
            <div className="mb-4">
              <div className="text-base text-muted-foreground mb-2">保存为模板</div>
              <div className="flex gap-2">
                <div className="flex-1 border-2 border-input rounded px-4 py-3 bg-background">
                  <input
                    type="text"
                    value={templateName}
                    onInput={(e) => {
                      const ev = e as unknown
                      setTemplateName(
                        (ev as {detail?: {value?: string}}).detail?.value ??
                          (ev as {target?: {value?: string}}).target?.value ??
                          ''
                      )
                    }}
                    placeholder="输入模板名称"
                    className="w-full text-xl text-foreground bg-transparent outline-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleSaveTemplate}
                  className="px-6 py-3 bg-primary text-primary-foreground text-xl rounded flex items-center justify-center leading-none">
                  保存
                </button>
              </div>
            </div>

            {/* 操作按钮 */}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowFieldSelector(false)}
                className="flex-1 px-6 py-4 bg-muted text-muted-foreground text-xl rounded flex items-center justify-center leading-none">
                取消
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowFieldSelector(false)
                  setShowExportConfig(true)
                }}
                className="flex-1 px-6 py-4 bg-primary text-primary-foreground text-xl rounded flex items-center justify-center leading-none">
                确定
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 悬浮添加按钮 */}
      {filteredProjects.length > 0 && (
        <div
          onClick={handleAddProject}
          className="fixed right-6 bottom-24 w-16 h-16 bg-primary rounded-full flex items-center justify-center"
          style={{boxShadow: 'var(--shadow-elegant)'}}>
          <div className="i-mdi-plus text-4xl text-primary-foreground" />
        </div>
      )}
    </div>
  );
}

export default withRouteGuard(Projects)
