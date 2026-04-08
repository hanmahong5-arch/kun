import {useState, useEffect, useMemo, useCallback} from 'react'
import {isAdmin, isLeaderOrAdmin} from '@/db/permissions-utils'
import Taro, {useDidShow} from '@tarojs/taro'
import {withRouteGuard} from '@/components/RouteGuard'
import {useAuth} from '@/contexts/AuthContext'
import {supabase} from '@/client/supabase'
import type {TemplateVersion, TemplateVersionField} from '@/db/types'

interface VersionData {
  version: TemplateVersion
  fields: TemplateVersionField[]
}

function TemplateCompare() {
  const {profile} = useAuth()
  const [version1Data, setVersion1Data] = useState<VersionData | null>(null)
  const [version2Data, setVersion2Data] = useState<VersionData | null>(null)
  const [loading, setLoading] = useState(true)

  const params = useMemo(() => {
    const router = Taro.getCurrentInstance().router
    return {
      v1: router?.params?.v1 || '',
      v2: router?.params?.v2 || ''
    }
  }, [])

  const hasAdminAccess = isAdmin(profile)

  const loadData = useCallback(async () => {
    if (!params.v1 || !params.v2) return

    try {
      setLoading(true)

      // 加载版本1
      const {data: v1, error: v1Error} = await supabase
        .from('template_versions')
        .select('*')
        .eq('id', params.v1)
        .maybeSingle()

      if (v1Error) throw v1Error

      const {data: v1Fields, error: v1FieldsError} = await supabase
        .from('template_version_fields')
        .select('*')
        .eq('version_id', params.v1)
        .order('display_order')

      if (v1FieldsError) throw v1FieldsError

      setVersion1Data({
        version: v1,
        fields: Array.isArray(v1Fields) ? v1Fields : []
      })

      // 加载版本2
      const {data: v2, error: v2Error} = await supabase
        .from('template_versions')
        .select('*')
        .eq('id', params.v2)
        .maybeSingle()

      if (v2Error) throw v2Error

      const {data: v2Fields, error: v2FieldsError} = await supabase
        .from('template_version_fields')
        .select('*')
        .eq('version_id', params.v2)
        .order('display_order')

      if (v2FieldsError) throw v2FieldsError

      setVersion2Data({
        version: v2,
        fields: Array.isArray(v2Fields) ? v2Fields : []
      })
    } catch (error) {
      console.error('加载版本数据失败:', error)
      Taro.showToast({title: '加载失败', icon: 'none'})
    } finally {
      setLoading(false)
    }
  }, [params.v1, params.v2])

  useDidShow(() => {
    loadData()
  })

  useEffect(() => {
    loadData()
  }, [loadData])

  // 对比字段差异
  const compareFields = () => {
    if (!version1Data || !version2Data) return {added: [], removed: [], modified: []}

    const v1FieldsMap = new Map(version1Data.fields.map((f) => [f.field_name, f]))
    const v2FieldsMap = new Map(version2Data.fields.map((f) => [f.field_name, f]))

    const added: TemplateVersionField[] = []
    const removed: TemplateVersionField[] = []
    const modified: {old: TemplateVersionField; new: TemplateVersionField}[] = []

    // 查找新增和修改的字段
    version1Data.fields.forEach((v1Field) => {
      const v2Field = v2FieldsMap.get(v1Field.field_name)
      if (!v2Field) {
        added.push(v1Field)
      } else {
        // 检查是否有修改
        if (
          v1Field.field_label !== v2Field.field_label ||
          v1Field.field_type !== v2Field.field_type ||
          v1Field.is_required !== v2Field.is_required ||
          v1Field.display_order !== v2Field.display_order ||
          v1Field.placeholder !== v2Field.placeholder
        ) {
          modified.push({old: v2Field, new: v1Field})
        }
      }
    })

    // 查找删除的字段
    version2Data.fields.forEach((v2Field) => {
      if (!v1FieldsMap.has(v2Field.field_name)) {
        removed.push(v2Field)
      }
    })

    return {added, removed, modified}
  }

  const diff = compareFields()

  const getFieldTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      text: '单行文本',
      textarea: '多行文本',
      number: '数字',
      date: '日期',
      file: '附件'
    }
    return labels[type] || type
  }

  if (!hasAdminAccess) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6">
        <div className="text-center">
          <div className="i-mdi-lock text-6xl text-muted-foreground mb-4" />
          <div className="text-xl text-foreground font-bold mb-2">无权限访问</div>
          <div className="text-base text-muted-foreground">仅管理员可查看版本对比</div>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-base text-muted-foreground">加载中...</div>
      </div>
    )
  }

  if (!version1Data || !version2Data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6">
        <div className="text-center">
          <div className="i-mdi-alert-circle text-6xl text-muted-foreground mb-4" />
          <div className="text-xl text-foreground font-bold mb-2">数据加载失败</div>
          <div className="text-base text-muted-foreground">版本数据不存在</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background pb-6">
      {/* 页面标题 */}
      <div className="px-6 py-6 bg-gradient-primary">
        <div className="text-2xl text-primary-foreground font-bold mb-2">版本对比</div>
        <div className="flex items-center gap-3 text-xl text-primary-foreground/80">
          <span>{version1Data.version.version_name || `v${version1Data.version.version_number}.0`}</span>
          <div className="i-mdi-arrow-left text-2xl" />
          <span>{version2Data.version.version_name || `v${version2Data.version.version_number}.0`}</span>
        </div>
      </div>

      {/* 对比结果 */}
      <div className="px-6 mt-4">
        {/* 新增字段 */}
        {diff.added.length > 0 && (
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="i-mdi-plus-circle text-2xl text-success" />
              <div className="text-xl text-foreground font-bold">新增字段 ({diff.added.length})</div>
            </div>
            <div className="flex flex-col gap-2">
              {diff.added.map((field) => (
                <div key={field.id} className="bg-success/10 rounded p-4 border-2 border-success/30">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xl text-foreground font-bold">{field.field_label}</div>
                    <span className="px-2 py-1 bg-success/20 text-success text-base rounded">
                      {getFieldTypeLabel(field.field_type)}
                    </span>
                  </div>
                  <div className="text-base text-muted-foreground">
                    字段名: {field.field_name}
                    {field.is_required && ' · 必填'}
                    {field.placeholder && ` · 提示: ${field.placeholder}`}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 删除字段 */}
        {diff.removed.length > 0 && (
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="i-mdi-minus-circle text-2xl text-destructive" />
              <div className="text-xl text-foreground font-bold">删除字段 ({diff.removed.length})</div>
            </div>
            <div className="flex flex-col gap-2">
              {diff.removed.map((field) => (
                <div key={field.id} className="bg-destructive/10 rounded p-4 border-2 border-destructive/30">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xl text-foreground font-bold line-through">{field.field_label}</div>
                    <span className="px-2 py-1 bg-destructive/20 text-destructive text-base rounded">
                      {getFieldTypeLabel(field.field_type)}
                    </span>
                  </div>
                  <div className="text-base text-muted-foreground">
                    字段名: {field.field_name}
                    {field.is_required && ' · 必填'}
                    {field.placeholder && ` · 提示: ${field.placeholder}`}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 修改字段 */}
        {diff.modified.length > 0 && (
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="i-mdi-pencil-circle text-2xl text-warning" />
              <div className="text-xl text-foreground font-bold">修改字段 ({diff.modified.length})</div>
            </div>
            <div className="flex flex-col gap-2">
              {diff.modified.map((item, index) => (
                <div key={index} className="bg-warning/10 rounded p-4 border-2 border-warning/30">
                  <div className="text-xl text-foreground font-bold mb-3">{item.new.field_label}</div>
                  
                  {/* 旧值 */}
                  <div className="bg-destructive/10 rounded p-3 mb-2">
                    <div className="text-base text-muted-foreground mb-1">旧值:</div>
                    <div className="text-base text-foreground">
                      类型: {getFieldTypeLabel(item.old.field_type)}
                      {item.old.is_required && ' · 必填'}
                      {item.old.placeholder && ` · 提示: ${item.old.placeholder}`}
                    </div>
                  </div>

                  {/* 新值 */}
                  <div className="bg-success/10 rounded p-3">
                    <div className="text-base text-muted-foreground mb-1">新值:</div>
                    <div className="text-base text-foreground">
                      类型: {getFieldTypeLabel(item.new.field_type)}
                      {item.new.is_required && ' · 必填'}
                      {item.new.placeholder && ` · 提示: ${item.new.placeholder}`}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 无变更 */}
        {diff.added.length === 0 && diff.removed.length === 0 && diff.modified.length === 0 && (
          <div className="bg-card rounded p-8 text-center border border-border">
            <div className="i-mdi-check-circle text-6xl text-success mb-2" />
            <div className="text-xl text-foreground font-bold mb-2">无字段变更</div>
            <div className="text-base text-muted-foreground">两个版本的字段配置完全相同</div>
          </div>
        )}
      </div>
    </div>
  )
}

export default withRouteGuard(TemplateCompare)
