import {useState, useEffect, useMemo} from 'react'
import Taro from '@tarojs/taro'
import {useAuth} from '@/contexts/AuthContext'
import {supabase} from '@/client/supabase'
import {deleteProject} from '@/db/api'
import {isLeader} from '@/db/permissions-utils'

export default function ProjectDetail() {
  const {profile} = useAuth()
  const [project, setProject] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const projectId = useMemo(() => {
    return Taro.getCurrentInstance().router?.params?.id || ''
  }, [])

  useEffect(() => {
    if (!projectId) return

    const loadProject = async () => {
      try {
        setLoading(true)
        const {data, error} = await supabase
          .from('projects')
          .select('*, profiles!projects_responsible_person_id_fkey(name)')
          .eq('id', projectId)
          .maybeSingle()

        if (error) throw error
        setProject(data)
      } catch (error) {
        console.error('加载项目详情失败:', error)
        Taro.showToast({title: '加载失败', icon: 'none'})
      } finally {
        setLoading(false)
      }
    }

    loadProject()
  }, [projectId])

  const handleDelete = async () => {
    if (!profile || !project) return

    // 权限检查：仅管理员和项目负责人可以删除
    const isAdmin = ['system_admin', 'admin'].includes(profile.role as string)
    const isResponsible = project.responsible_person_id === profile.id

    if (!isAdmin && !isResponsible) {
      Taro.showToast({title: '无权限删除', icon: 'none'})
      return
    }

    // 确认对话框
    const res = await Taro.showModal({
      title: '确认删除',
      content: '删除项目将同时删除所有跟踪记录，此操作不可恢复',
      confirmText: '删除',
      cancelText: '取消'
    })

    if (!res.confirm) return

    try {
      await deleteProject(projectId)
      Taro.showToast({title: '删除成功', icon: 'success'})
      setTimeout(() => {
        Taro.navigateBack()
      }, 1500)
    } catch (error) {
      console.error('删除项目失败:', error)
      Taro.showToast({title: '删除失败', icon: 'none'})
    }
  }

  const handleArchive = async () => {
    if (!profile || !project) return

    // 权限检查：仅管理员可以归档
    const isAdmin = ['system_admin', 'system_admin'].includes(profile.role as string)

    if (!isAdmin) {
      Taro.showToast({title: '无权限操作', icon: 'none'})
      return
    }

    const action = project.is_archived ? '取消归档' : '归档'
    const res = await Taro.showModal({
      title: `确认${action}`,
      content: project.is_archived
        ? '取消归档后，项目将重新出现在项目列表中'
        : '归档后，项目将从项目列表中隐藏，可通过"显示归档项目"开关查看',
      confirmText: action,
      cancelText: '取消'
    })

    if (!res.confirm) return

    try {
      const {error} = await supabase
        .from('projects')
        .update({
          is_archived: !project.is_archived,
          archived_at: project.is_archived ? null : new Date().toISOString()
        })
        .eq('id', projectId)

      if (error) throw error

      Taro.showToast({title: `${action}成功`, icon: 'success'})
      // 重新加载项目数据
      const {data} = await supabase
        .from('projects')
        .select('*, profiles!projects_responsible_person_id_fkey(name)')
        .eq('id', projectId)
        .maybeSingle()
      setProject(data)
    } catch (error) {
      console.error(`${action}失败:`, error)
      Taro.showToast({title: `${action}失败`, icon: 'none'})
    }
  }

  const getClassificationLabel = (classification: string) => {
    const labels: Record<string, string> = {
      a_lock: 'A锁项目',
      a_compete: 'A争项目',
      b: 'B类项目'
    }
    return labels[classification] || classification
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-xl text-muted-foreground">加载中...</div>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6">
        <div className="text-center">
          <div className="i-mdi-alert-circle text-6xl text-warning mb-4" />
          <div className="text-2xl text-foreground mb-2">项目不存在</div>
          <button
            type="button"
            onClick={() => Taro.navigateBack()}
            className="px-6 py-3 bg-primary text-primary-foreground text-xl rounded flex items-center justify-center leading-none mx-auto mt-4">
            返回
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background pb-6">
      {/* 头部 */}
      <div className="bg-gradient-primary px-6 py-6">
        <div className="text-2xl text-primary-foreground font-bold">{project.name}</div>
        <div className="flex items-center gap-2 mt-2">
          <span className="px-3 py-1 bg-primary-foreground/20 text-primary-foreground text-base rounded">
            {getClassificationLabel(project.classification)}
          </span>
          {project.stage && (
            <span className="px-3 py-1 bg-primary-foreground/20 text-primary-foreground text-base rounded">{project.stage}</span>
          )}
        </div>
      </div>

      {/* 基本信息 */}
      <div className="px-6 py-4 bg-card mt-4 mx-6 rounded">
        <div className="text-xl text-foreground font-bold mb-4">基本信息</div>

        <div className="mb-3">
          <div className="text-base text-muted-foreground mb-1">建设单位</div>
          <div className="text-xl text-foreground">{project.construction_unit}</div>
        </div>

        <div className="mb-3">
          <div className="text-base text-muted-foreground mb-1">工程类型</div>
          <div className="text-xl text-foreground">{project.project_type}</div>
        </div>

        {project.investment_amount && (
          <div className="mb-3">
            <div className="text-base text-muted-foreground mb-1">预计中标合同额</div>
            <div className="text-xl text-foreground">{project.investment_amount} 万元</div>
          </div>
        )}

        {project.team_group && (
          <div className="mb-3">
            <div className="text-base text-muted-foreground mb-1">所属小组</div>
            <div className="text-xl text-foreground">{project.team_group}</div>
          </div>
        )}

        {project.profiles && (
          <div className="mb-3">
            <div className="text-base text-muted-foreground mb-1">负责人</div>
            <div className="text-xl text-foreground">{project.profiles.name}</div>
          </div>
        )}

        {project.project_overview && (
          <div>
            <div className="text-base text-muted-foreground mb-1">工程概况</div>
            <div className="text-xl text-foreground whitespace-pre-wrap">{project.project_overview}</div>
          </div>
        )}
      </div>

      {/* 操作按钮 - 公司领导仅查看，不显示编辑/删除 */}
      {!isLeader(profile) && (
      <div className="px-6 mt-6 pb-6 flex flex-col gap-3">
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => Taro.navigateTo({url: `/pages/projects/edit/index?id=${project.id}`})}
            className="flex-1 py-4 bg-card border-2 border-primary text-primary text-xl rounded flex items-center justify-center leading-none">
            <div className="i-mdi-pencil text-2xl mr-2" />
            编辑项目
          </button>
          {profile && (['system_admin', 'admin'].includes(profile.role as string) || project.responsible_person_id === profile.id) && (
            <button
              type="button"
              onClick={handleDelete}
              className="flex-1 py-4 bg-destructive text-destructive-foreground text-xl rounded flex items-center justify-center leading-none">
              <div className="i-mdi-delete text-2xl mr-2" />
              删除项目
            </button>
          )}
        </div>
        {/* 归档按钮（仅管理员可见） */}
        {profile && ['system_admin', 'system_admin'].includes(profile.role as string) && (
          <button
            type="button"
            onClick={handleArchive}
            className={`w-full py-4 text-xl rounded flex items-center justify-center leading-none ${
              project.is_archived
                ? 'bg-success text-white'
                : 'bg-muted text-muted-foreground border-2 border-muted'
            }`}>
            <div className={`${project.is_archived ? 'i-mdi-archive-arrow-up' : 'i-mdi-archive'} text-2xl mr-2`} />
            {project.is_archived ? '取消归档' : '归档项目'}
          </button>
        )}
      </div>
      )}
    </div>
  )
}
