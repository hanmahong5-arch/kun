import {useCallback, useEffect, useState} from 'react'
import {isAdmin, isLeaderOrAdmin} from '@/db/permissions-utils'
import Taro, {useDidShow} from '@tarojs/taro'
import {withRouteGuard} from '@/components/RouteGuard'
import {useAuth} from '@/contexts/AuthContext'
import {supabase} from '@/client/supabase'
import type {WeeklyReportTemplate} from '@/db/types'

function ReportTemplateList() {
  const {profile} = useAuth()
  const [templates, setTemplates] = useState<WeeklyReportTemplate[]>([])
  const [loading, setLoading] = useState(true)

  const hasAdminAccess = isAdmin(profile)

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      const {data, error} = await supabase
        .from('weekly_report_templates')
        .select('*')
        .order('created_at', {ascending: false})

      if (error) throw error
      setTemplates(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('加载模板列表失败:', error)
      Taro.showToast({title: '加载失败', icon: 'none'})
    } finally {
      setLoading(false)
    }
  }, [])

  useDidShow(() => {
    loadData()
  })

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleCreateTemplate = () => {
    Taro.navigateTo({url: '/pages/report-templates/edit/index'})
  }

  const handleEditTemplate = (id: string) => {
    Taro.navigateTo({url: `/pages/report-templates/edit/index?id=${id}`})
  }

  const handleViewVersions = (id: string) => {
    Taro.navigateTo({url: `/pages/report-templates/versions/index?templateId=${id}`})
  }

  const handleDeleteTemplate = async (id: string, isDefault: boolean) => {
    if (isDefault) {
      Taro.showToast({title: '默认模板不可删除', icon: 'none'})
      return
    }

    const result = await Taro.showModal({
      title: '确认删除',
      content: '删除模板将同时删除所有字段配置，此操作不可恢复',
      confirmText: '删除',
      cancelText: '取消'
    })

    if (!result.confirm) return

    try {
      const {error} = await supabase.from('weekly_report_templates').delete().eq('id', id)

      if (error) throw error

      Taro.showToast({title: '删除成功', icon: 'success'})
      loadData()
    } catch (error) {
      console.error('删除模板失败:', error)
      Taro.showToast({title: '删除失败', icon: 'none'})
    }
  }

  if (!hasAdminAccess) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6">
        <div className="text-center">
          <div className="i-mdi-lock text-6xl text-warning mb-4" />
          <div className="text-2xl text-foreground mb-2">无权限访问</div>
          <div className="text-xl text-muted-foreground mb-4">仅管理员可访问此页面</div>
          <button
            type="button"
            onClick={() => Taro.navigateBack()}
            className="px-6 py-3 bg-primary text-primary-foreground text-xl rounded flex items-center justify-center leading-none mx-auto">
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
        <div className="text-2xl text-primary-foreground font-bold">周报模板管理</div>
        <div className="text-base text-primary-foreground/80 mt-1">自定义周报字段与模板</div>
      </div>

      {/* 新建按钮 */}
      <div className="px-6 mt-4">
        <button
          type="button"
          onClick={handleCreateTemplate}
          className="w-full py-4 bg-primary text-primary-foreground text-xl rounded flex items-center justify-center leading-none">
          <div className="i-mdi-plus text-2xl mr-2" />
          新建模板
        </button>
      </div>

      {/* 模板列表 */}
      <div className="px-6 mt-4">
        {loading ? (
          <div className="text-center py-12">
            <div className="text-xl text-muted-foreground">加载中...</div>
          </div>
        ) : templates.length === 0 ? (
          <div className="bg-card rounded p-12 flex flex-col items-center">
            <div className="i-mdi-file-document-outline text-[100px] text-muted-foreground" />
            <div className="text-xl text-muted-foreground mt-4">暂无模板</div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {templates.map((template) => (
              <div key={template.id} className="bg-card rounded p-4 border border-border">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="text-xl text-foreground font-bold">{template.name}</div>
                      {template.is_default && (
                        <span className="px-2 py-1 bg-primary/10 text-primary text-base rounded">默认</span>
                      )}
                    </div>
                    {template.description && (
                      <div className="text-base text-muted-foreground">{template.description}</div>
                    )}
                    <div className="text-sm text-muted-foreground mt-1">
                      当前版本: v{template.current_version || 1}.0
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <button
                    type="button"
                    onClick={() => handleViewVersions(template.id)}
                    className="flex-1 py-3 bg-card border-2 border-border text-foreground text-xl rounded flex items-center justify-center leading-none">
                    <div className="i-mdi-history text-2xl mr-2" />
                    版本历史
                  </button>
                  <button
                    type="button"
                    onClick={() => handleEditTemplate(template.id)}
                    className="flex-1 py-3 bg-card border-2 border-primary text-primary text-xl rounded flex items-center justify-center leading-none">
                    <div className="i-mdi-pencil text-2xl mr-2" />
                    编辑
                  </button>
                  {!template.is_default && (
                    <button
                      type="button"
                      onClick={() => handleDeleteTemplate(template.id, template.is_default)}
                      className="flex-1 py-3 bg-destructive text-destructive-foreground text-xl rounded flex items-center justify-center leading-none">
                      <div className="i-mdi-delete text-2xl mr-2" />
                      删除
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

export default withRouteGuard(ReportTemplateList)
