import {useState, useEffect, useMemo, useCallback} from 'react'
import {isAdmin, isLeaderOrAdmin} from '@/db/permissions-utils'
import Taro, {useDidShow} from '@tarojs/taro'
import {withRouteGuard} from '@/components/RouteGuard'
import {useAuth} from '@/contexts/AuthContext'
import {supabase} from '@/client/supabase'
import type {TemplateVersion} from '@/db/types'

interface VersionWithProfile extends TemplateVersion {
  profiles?: {
    name: string
  }
}

function TemplateVersions() {
  const {profile} = useAuth()
  const [versions, setVersions] = useState<VersionWithProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [templateName, setTemplateName] = useState('')

  const templateId = useMemo(() => {
    return Taro.getCurrentInstance().router?.params?.templateId || ''
  }, [])

  const hasAdminAccess = isAdmin(profile)

  const loadData = useCallback(async () => {
    if (!templateId) return

    try {
      setLoading(true)

      // 加载模板名称
      const {data: templateData} = await supabase
        .from('weekly_report_templates')
        .select('name')
        .eq('id', templateId)
        .maybeSingle()

      if (templateData) {
        setTemplateName(templateData.name)
      }

      // 加载版本历史
      const {data: versionsData, error} = await supabase
        .from('template_versions')
        .select(`
          *,
          profiles:created_by(name)
        `)
        .eq('template_id', templateId)
        .order('version_number', {ascending: false})

      if (error) throw error

      setVersions(Array.isArray(versionsData) ? versionsData : [])
    } catch (error) {
      console.error('加载版本历史失败:', error)
      Taro.showToast({title: '加载失败', icon: 'none'})
    } finally {
      setLoading(false)
    }
  }, [templateId])

  useDidShow(() => {
    loadData()
  })

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleCompareVersions = (versionId1: string, versionId2: string) => {
    Taro.navigateTo({
      url: `/pages/report-templates/compare/index?v1=${versionId1}&v2=${versionId2}`
    })
  }

  const handleRollback = async (version: VersionWithProfile) => {
    const result = await Taro.showModal({
      title: '确认回滚',
      content: `确定要回滚到版本 ${version.version_name || `v${version.version_number}.0`} 吗？这将创建一个新版本。`,
      confirmText: '确定',
      cancelText: '取消'
    })

    if (!result.confirm) return

    try {
      setLoading(true)

      // 获取当前模板的最新版本号
      const {data: currentTemplate} = await supabase
        .from('weekly_report_templates')
        .select('current_version')
        .eq('id', templateId)
        .maybeSingle()

      const newVersionNumber = (currentTemplate?.current_version || 1) + 1

      // 获取要回滚的版本的字段
      const {data: versionFields} = await supabase
        .from('template_version_fields')
        .select('*')
        .eq('version_id', version.id)
        .order('display_order')

      if (!versionFields || versionFields.length === 0) {
        throw new Error('版本字段数据不存在')
      }

      // 更新模板基本信息
      const snapshot = version.template_snapshot
      const {error: updateError} = await supabase
        .from('weekly_report_templates')
        .update({
          name: snapshot.name,
          description: snapshot.description,
          current_version: newVersionNumber,
          updated_at: new Date().toISOString()
        })
        .eq('id', templateId)

      if (updateError) throw updateError

      // 删除当前字段
      const {error: deleteError} = await supabase
        .from('weekly_report_template_fields')
        .delete()
        .eq('template_id', templateId)

      if (deleteError) throw deleteError

      // 插入回滚的字段
      const {error: insertError} = await supabase.from('weekly_report_template_fields').insert(
        versionFields.map((f) => ({
          template_id: templateId,
          field_name: f.field_name,
          field_label: f.field_label,
          field_type: f.field_type,
          is_required: f.is_required,
          display_order: f.display_order,
          placeholder: f.placeholder
        }))
      )

      if (insertError) throw insertError

      // 创建新版本记录
      const {data: newVersion, error: versionError} = await supabase
        .from('template_versions')
        .insert({
          template_id: templateId,
          version_number: newVersionNumber,
          version_name: `v${newVersionNumber}.0`,
          change_description: `回滚到版本 ${version.version_name || `v${version.version_number}.0`}`,
          template_snapshot: snapshot,
          created_by: profile?.id
        })
        .select()
        .single()

      if (versionError) throw versionError

      // 插入新版本字段
      const {error: versionFieldsError} = await supabase.from('template_version_fields').insert(
        versionFields.map((f) => ({
          version_id: newVersion.id,
          field_name: f.field_name,
          field_label: f.field_label,
          field_type: f.field_type,
          is_required: f.is_required,
          display_order: f.display_order,
          placeholder: f.placeholder
        }))
      )

      if (versionFieldsError) throw versionFieldsError

      Taro.showToast({title: '回滚成功', icon: 'success'})
      loadData()
    } catch (error) {
      console.error('回滚失败:', error)
      Taro.showToast({title: '回滚失败', icon: 'none'})
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
  }

  if (!hasAdminAccess) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6">
        <div className="text-center">
          <div className="i-mdi-lock text-6xl text-muted-foreground mb-4" />
          <div className="text-xl text-foreground font-bold mb-2">无权限访问</div>
          <div className="text-base text-muted-foreground">仅管理员可查看版本历史</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background pb-6">
      {/* 页面标题 */}
      <div className="px-6 py-6 bg-gradient-primary">
        <div className="text-2xl text-primary-foreground font-bold mb-2">版本历史</div>
        <div className="text-xl text-primary-foreground/80">{templateName}</div>
      </div>

      {/* 版本列表 */}
      <div className="px-6 mt-4">
        {loading ? (
          <div className="text-center py-8">
            <div className="text-base text-muted-foreground">加载中...</div>
          </div>
        ) : versions.length === 0 ? (
          <div className="bg-card rounded p-8 text-center border border-border">
            <div className="i-mdi-history text-6xl text-muted-foreground mb-2" />
            <div className="text-base text-muted-foreground">暂无版本历史</div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {versions.map((version, index) => (
              <div key={version.id} className="bg-card rounded p-4 border border-border">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="text-xl text-foreground font-bold">
                        {version.version_name || `v${version.version_number}.0`}
                      </div>
                      {index === 0 && (
                        <span className="px-2 py-1 bg-primary/10 text-primary text-base rounded">当前版本</span>
                      )}
                    </div>
                    <div className="text-base text-muted-foreground mb-1">
                      {version.change_description}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {formatDate(version.created_at)} · {version.profiles?.name || '未知'}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {index < versions.length - 1 && (
                    <button
                      type="button"
                      onClick={() => handleCompareVersions(version.id, versions[index + 1].id)}
                      className="flex-1 py-3 bg-card border-2 border-border text-foreground text-xl rounded flex items-center justify-center leading-none">
                      <div className="i-mdi-compare text-2xl mr-2" />
                      对比上一版本
                    </button>
                  )}
                  {index !== 0 && (
                    <button
                      type="button"
                      onClick={() => handleRollback(version)}
                      className="flex-1 py-3 bg-card border-2 border-primary text-primary text-xl rounded flex items-center justify-center leading-none">
                      <div className="i-mdi-restore text-2xl mr-2" />
                      回滚到此版本
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

export default withRouteGuard(TemplateVersions)
