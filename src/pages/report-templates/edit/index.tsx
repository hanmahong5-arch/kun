import {useState, useEffect, useMemo} from 'react'
import {isAdmin, isLeaderOrAdmin} from '@/db/permissions-utils'
import Taro from '@tarojs/taro'
import {withRouteGuard} from '@/components/RouteGuard'
import {useAuth} from '@/contexts/AuthContext'
import {supabase} from '@/client/supabase'
import type {WeeklyReportTemplateField, TemplateFieldType} from '@/db/types'

interface FieldFormData {
  id?: string
  field_name: string
  field_label: string
  field_type: TemplateFieldType
  is_required: boolean
  display_order: number
  placeholder: string
}

function ReportTemplateEdit() {
  const {profile} = useAuth()
  const [templateName, setTemplateName] = useState('')
  const [templateDescription, setTemplateDescription] = useState('')
  const [fields, setFields] = useState<FieldFormData[]>([])
  const [loading, setLoading] = useState(false)
  const [isEdit, setIsEdit] = useState(false)
  const [showFieldDialog, setShowFieldDialog] = useState(false)
  const [editingField, setEditingField] = useState<FieldFormData | null>(null)
  const [departments, setDepartments] = useState<string[]>([])
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([])
  const [showChangeDialog, setShowChangeDialog] = useState(false)
  const [changeDescription, setChangeDescription] = useState('')
  const [currentVersion, setCurrentVersion] = useState(1)

  const templateId = useMemo(() => {
    return Taro.getCurrentInstance().router?.params?.id || ''
  }, [])

  const hasAdminAccess = isAdmin(profile)

  useEffect(() => {
    if (!templateId) return

    const loadTemplate = async () => {
      try {
        setLoading(true)
        setIsEdit(true)

        // 加载模板基本信息
        const {data: templateData, error: templateError} = await supabase
          .from('weekly_report_templates')
          .select('*')
          .eq('id', templateId)
          .maybeSingle()

        if (templateError) throw templateError
        if (templateData) {
          setTemplateName(templateData.name)
          setTemplateDescription(templateData.description || '')
          setCurrentVersion(templateData.current_version || 1)
        }

        // 加载模板字段
        const {data: fieldsData, error: fieldsError} = await supabase
          .from('weekly_report_template_fields')
          .select('*')
          .eq('template_id', templateId)
          .order('display_order')

        if (fieldsError) throw fieldsError
        setFields(
          Array.isArray(fieldsData)
            ? fieldsData.map((f) => ({
                id: f.id,
                field_name: f.field_name,
                field_label: f.field_label,
                field_type: f.field_type,
                is_required: f.is_required,
                display_order: f.display_order,
                placeholder: f.placeholder || ''
              }))
            : []
        )

        // 加载部门映射
        const {data: mappingData, error: mappingError} = await supabase
          .from('department_template_mapping')
          .select('department')
          .eq('template_id', templateId)

        if (mappingError) throw mappingError
        setSelectedDepartments(Array.isArray(mappingData) ? mappingData.map((m) => m.department) : [])
      } catch (error) {
        console.error('加载模板失败:', error)
        Taro.showToast({title: '加载失败', icon: 'none'})
      } finally {
        setLoading(false)
      }
    }

    loadTemplate()
  }, [templateId])

  useEffect(() => {
    // 加载所有部门
    const loadDepartments = async () => {
      try {
        const {data, error} = await supabase.from('profiles').select('department').not('department', 'is', null)

        if (error) throw error
        const uniqueDepts = Array.from(new Set(data?.map((p) => p.department).filter(Boolean) as string[]))
        setDepartments(uniqueDepts)
      } catch (error) {
        console.error('加载部门失败:', error)
      }
    }

    loadDepartments()
  }, [])

  const handleAddField = () => {
    setEditingField({
      field_name: '',
      field_label: '',
      field_type: 'text',
      is_required: false,
      display_order: fields.length + 1,
      placeholder: ''
    })
    setShowFieldDialog(true)
  }

  const handleEditField = (field: FieldFormData) => {
    setEditingField(field)
    setShowFieldDialog(true)
  }

  const handleSaveField = () => {
    if (!editingField) return

    if (!editingField.field_name || !editingField.field_label) {
      Taro.showToast({title: '请填写字段名称和标签', icon: 'none'})
      return
    }

    if (editingField.id) {
      // 编辑现有字段
      setFields(fields.map((f) => (f.id === editingField.id ? editingField : f)))
    } else {
      // 新增字段
      setFields([...fields, editingField])
    }

    setShowFieldDialog(false)
    setEditingField(null)
  }

  const handleDeleteField = (index: number) => {
    setFields(fields.filter((_, i) => i !== index))
  }

  const handleMoveFieldUp = (index: number) => {
    if (index === 0) return
    const newFields = [...fields]
    ;[newFields[index - 1], newFields[index]] = [newFields[index], newFields[index - 1]]
    // 更新display_order
    newFields.forEach((f, i) => {
      f.display_order = i + 1
    })
    setFields(newFields)
  }

  const handleMoveFieldDown = (index: number) => {
    if (index === fields.length - 1) return
    const newFields = [...fields]
    ;[newFields[index], newFields[index + 1]] = [newFields[index + 1], newFields[index]]
    // 更新display_order
    newFields.forEach((f, i) => {
      f.display_order = i + 1
    })
    setFields(newFields)
  }

  const handleToggleDepartment = (dept: string) => {
    if (selectedDepartments.includes(dept)) {
      setSelectedDepartments(selectedDepartments.filter((d) => d !== dept))
    } else {
      setSelectedDepartments([...selectedDepartments, dept])
    }
  }

  const handleSave = async () => {
    if (!templateName) {
      Taro.showToast({title: '请填写模板名称', icon: 'none'})
      return
    }

    if (fields.length === 0) {
      Taro.showToast({title: '请至少添加一个字段', icon: 'none'})
      return
    }

    // 编辑模式需要填写变更说明
    if (isEdit && templateId) {
      setShowChangeDialog(true)
      return
    }

    // 新建模式直接保存
    await performSave('初始版本')
  }

  const performSave = async (changeDesc: string) => {
    try {
      setLoading(true)

      if (isEdit && templateId) {
        // 计算新版本号
        const newVersionNumber = currentVersion + 1

        // 更新模板
        const {error: updateError} = await supabase
          .from('weekly_report_templates')
          .update({
            name: templateName,
            description: templateDescription,
            current_version: newVersionNumber,
            updated_at: new Date().toISOString()
          })
          .eq('id', templateId)

        if (updateError) throw updateError

        // 删除旧字段
        const {error: deleteError} = await supabase
          .from('weekly_report_template_fields')
          .delete()
          .eq('template_id', templateId)

        if (deleteError) throw deleteError

        // 插入新字段
        const {error: insertError} = await supabase.from('weekly_report_template_fields').insert(
          fields.map((f) => ({
            template_id: templateId,
            field_name: f.field_name,
            field_label: f.field_label,
            field_type: f.field_type,
            is_required: f.is_required,
            display_order: f.display_order,
            placeholder: f.placeholder || null
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
            change_description: changeDesc,
            template_snapshot: {
              name: templateName,
              description: templateDescription,
              is_default: false
            },
            created_by: profile?.id
          })
          .select()
          .single()

        if (versionError) throw versionError

        // 插入版本字段
        const {error: versionFieldsError} = await supabase.from('template_version_fields').insert(
          fields.map((f) => ({
            version_id: newVersion.id,
            field_name: f.field_name,
            field_label: f.field_label,
            field_type: f.field_type,
            is_required: f.is_required,
            display_order: f.display_order,
            placeholder: f.placeholder || null
          }))
        )

        if (versionFieldsError) throw versionFieldsError

        // 更新部门映射
        const {error: deleteMappingError} = await supabase
          .from('department_template_mapping')
          .delete()
          .eq('template_id', templateId)

        if (deleteMappingError) throw deleteMappingError

        if (selectedDepartments.length > 0) {
          const {error: insertMappingError} = await supabase.from('department_template_mapping').insert(
            selectedDepartments.map((dept) => ({
              department: dept,
              template_id: templateId
            }))
          )

          if (insertMappingError) throw insertMappingError
        }

        setShowChangeDialog(false)
        setChangeDescription('')
        Taro.showToast({title: '保存成功', icon: 'success'})
      } else {
        // 创建新模板
        const {data: newTemplate, error: createError} = await supabase
          .from('weekly_report_templates')
          .insert({
            name: templateName,
            description: templateDescription,
            is_default: false,
            current_version: 1,
            created_by: profile?.id
          })
          .select()
          .single()

        if (createError) throw createError

        // 插入字段
        const {error: insertError} = await supabase.from('weekly_report_template_fields').insert(
          fields.map((f) => ({
            template_id: newTemplate.id,
            field_name: f.field_name,
            field_label: f.field_label,
            field_type: f.field_type,
            is_required: f.is_required,
            display_order: f.display_order,
            placeholder: f.placeholder || null
          }))
        )

        if (insertError) throw insertError

        // 创建初始版本记录
        const {data: initialVersion, error: versionError} = await supabase
          .from('template_versions')
          .insert({
            template_id: newTemplate.id,
            version_number: 1,
            version_name: 'v1.0',
            change_description: changeDesc,
            template_snapshot: {
              name: templateName,
              description: templateDescription,
              is_default: false
            },
            created_by: profile?.id
          })
          .select()
          .single()

        if (versionError) throw versionError

        // 插入版本字段
        const {error: versionFieldsError} = await supabase.from('template_version_fields').insert(
          fields.map((f) => ({
            version_id: initialVersion.id,
            field_name: f.field_name,
            field_label: f.field_label,
            field_type: f.field_type,
            is_required: f.is_required,
            display_order: f.display_order,
            placeholder: f.placeholder || null
          }))
        )

        if (versionFieldsError) throw versionFieldsError

        // 插入部门映射
        if (selectedDepartments.length > 0) {
          const {error: insertMappingError} = await supabase.from('department_template_mapping').insert(
            selectedDepartments.map((dept) => ({
              department: dept,
              template_id: newTemplate.id
            }))
          )

          if (insertMappingError) throw insertMappingError
        }

        Taro.showToast({title: '创建成功', icon: 'success'})
      }

      setTimeout(() => {
        Taro.navigateBack()
      }, 1500)
    } catch (error) {
      console.error('保存模板失败:', error)
      Taro.showToast({title: '保存失败', icon: 'none'})
    } finally {
      setLoading(false)
    }
  }

  const getFieldTypeLabel = (type: TemplateFieldType) => {
    const labels: Record<TemplateFieldType, string> = {
      text: '单行文本',
      textarea: '多行文本',
      number: '数字',
      date: '日期',
      file: '附件'
    }
    return labels[type]
  }

  if (!hasAdminAccess) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6">
        <div className="text-center">
          <div className="i-mdi-lock text-6xl text-warning mb-4" />
          <div className="text-2xl text-foreground mb-2">无权限访问</div>
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
        <div className="text-2xl text-primary-foreground font-bold">{isEdit ? '编辑模板' : '新建模板'}</div>
        <div className="text-base text-primary-foreground/80 mt-1">配置周报字段与部门关联</div>
      </div>

      {/* 基本信息 */}
      <div className="px-6 mt-4">
        <div className="bg-card rounded p-4 border border-border">
          <div className="text-xl text-foreground font-bold mb-3">基本信息</div>

          <div className="mb-3">
            <div className="text-base text-muted-foreground mb-2">模板名称 *</div>
            <div className="border-2 border-input rounded px-4 py-3 bg-background overflow-hidden">
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
                placeholder="请输入模板名称"
                className="w-full text-xl text-foreground bg-transparent outline-none"
              />
            </div>
          </div>

          <div className="mb-3">
            <div className="text-base text-muted-foreground mb-2">模板描述</div>
            <div className="border-2 border-input rounded px-4 py-3 bg-background overflow-hidden">
              <textarea
                value={templateDescription}
                onInput={(e) => {
                  const ev = e as unknown
                  setTemplateDescription(
                    (ev as {detail?: {value?: string}}).detail?.value ??
                      (ev as {target?: {value?: string}}).target?.value ??
                      ''
                  )
                }}
                placeholder="请输入模板描述"
                className="w-full text-xl text-foreground bg-transparent outline-none"
                style={{minHeight: '80px'}}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 字段配置 */}
      <div className="px-6 mt-4">
        <div className="bg-card rounded p-4 border border-border">
          <div className="flex items-center justify-between mb-3">
            <div className="text-xl text-foreground font-bold">字段配置</div>
            <button
              type="button"
              onClick={handleAddField}
              className="px-4 py-2 bg-primary text-primary-foreground text-base rounded flex items-center justify-center leading-none">
              <div className="i-mdi-plus text-lg mr-1" />
              添加字段
            </button>
          </div>

          {fields.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">暂无字段，请点击上方按钮添加</div>
          ) : (
            <div className="flex flex-col gap-2">
              {fields.map((field, index) => (
                <div key={index} className="bg-muted/30 rounded p-3 border border-border">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="text-lg text-foreground font-bold">{field.field_label}</div>
                        {field.is_required && <span className="text-destructive text-base">*</span>}
                      </div>
                      <div className="text-base text-muted-foreground">
                        类型: {getFieldTypeLabel(field.field_type)} | 字段名: {field.field_name}
                      </div>
                      {field.placeholder && (
                        <div className="text-base text-muted-foreground">提示: {field.placeholder}</div>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => handleMoveFieldUp(index)}
                        disabled={index === 0}
                        className={`p-2 ${index === 0 ? 'text-muted-foreground' : 'text-primary'}`}>
                        <div className="i-mdi-arrow-up text-xl" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveFieldDown(index)}
                        disabled={index === fields.length - 1}
                        className={`p-2 ${index === fields.length - 1 ? 'text-muted-foreground' : 'text-primary'}`}>
                        <div className="i-mdi-arrow-down text-xl" />
                      </button>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleEditField(field)}
                      className="flex-1 py-2 bg-card border border-primary text-primary text-base rounded flex items-center justify-center leading-none">
                      编辑
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteField(index)}
                      className="flex-1 py-2 bg-destructive text-destructive-foreground text-base rounded flex items-center justify-center leading-none">
                      删除
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 部门关联 */}
      <div className="px-6 mt-4">
        <div className="bg-card rounded p-4 border border-border">
          <div className="text-xl text-foreground font-bold mb-3">部门关联</div>
          <div className="text-base text-muted-foreground mb-3">选择使用此模板的部门（不选择则所有部门可用）</div>

          {departments.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground">暂无部门数据</div>
          ) : (
            <div className="flex flex-col gap-2">
              {departments.map((dept) => (
                <div
                  key={dept}
                  onClick={() => handleToggleDepartment(dept)}
                  className="flex items-center gap-3 p-3 bg-muted/30 rounded border border-border">
                  <div
                    className={`w-6 h-6 rounded border-2 flex items-center justify-center ${
                      selectedDepartments.includes(dept) ? 'bg-primary border-primary' : 'border-border bg-background'
                    }`}>
                    {selectedDepartments.includes(dept) && <div className="i-mdi-check text-primary-foreground text-lg" />}
                  </div>
                  <div className="text-xl text-foreground">{dept}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 保存按钮 */}
      <div className="px-6 mt-6">
        <button
          type="button"
          onClick={handleSave}
          disabled={loading}
          className="w-full py-4 bg-primary text-primary-foreground text-xl rounded flex items-center justify-center leading-none">
          {loading ? '保存中...' : '保存模板'}
        </button>
      </div>

      {/* 字段编辑对话框 */}
      {showFieldDialog && editingField && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-6">
          <div className="bg-card rounded p-6 w-full max-w-md">
            <div className="text-2xl text-foreground font-bold mb-4">
              {editingField.id ? '编辑字段' : '新增字段'}
            </div>

            <div className="mb-3">
              <div className="text-base text-muted-foreground mb-2">字段名称（英文）*</div>
              <div className="border-2 border-input rounded px-4 py-3 bg-background overflow-hidden">
                <input
                  type="text"
                  value={editingField.field_name}
                  onInput={(e) => {
                    const ev = e as unknown
                    setEditingField({
                      ...editingField,
                      field_name:
                        (ev as {detail?: {value?: string}}).detail?.value ??
                        (ev as {target?: {value?: string}}).target?.value ??
                        ''
                    })
                  }}
                  placeholder="例如: work_summary"
                  className="w-full text-xl text-foreground bg-transparent outline-none"
                />
              </div>
            </div>

            <div className="mb-3">
              <div className="text-base text-muted-foreground mb-2">字段标签（中文）*</div>
              <div className="border-2 border-input rounded px-4 py-3 bg-background overflow-hidden">
                <input
                  type="text"
                  value={editingField.field_label}
                  onInput={(e) => {
                    const ev = e as unknown
                    setEditingField({
                      ...editingField,
                      field_label:
                        (ev as {detail?: {value?: string}}).detail?.value ??
                        (ev as {target?: {value?: string}}).target?.value ??
                        ''
                    })
                  }}
                  placeholder="例如: 工作总结"
                  className="w-full text-xl text-foreground bg-transparent outline-none"
                />
              </div>
            </div>

            <div className="mb-3">
              <div className="text-base text-muted-foreground mb-2">字段类型 *</div>
              <div className="border-2 border-input rounded px-4 py-3 bg-background overflow-hidden">
                <select
                  value={editingField.field_type}
                  onChange={(e) => {
                    const ev = e as unknown
                    setEditingField({
                      ...editingField,
                      field_type:
                        ((ev as {detail?: {value?: string}}).detail?.value ??
                          (ev as {target?: {value?: string}}).target?.value ??
                          'text') as TemplateFieldType
                    })
                  }}
                  className="w-full text-xl text-foreground bg-transparent outline-none">
                  <option value="text">单行文本</option>
                  <option value="textarea">多行文本</option>
                  <option value="number">数字</option>
                  <option value="date">日期</option>
                  <option value="file">附件</option>
                </select>
              </div>
            </div>

            <div className="mb-3">
              <div className="text-base text-muted-foreground mb-2">提示文字</div>
              <div className="border-2 border-input rounded px-4 py-3 bg-background overflow-hidden">
                <input
                  type="text"
                  value={editingField.placeholder}
                  onInput={(e) => {
                    const ev = e as unknown
                    setEditingField({
                      ...editingField,
                      placeholder:
                        (ev as {detail?: {value?: string}}).detail?.value ??
                        (ev as {target?: {value?: string}}).target?.value ??
                        ''
                    })
                  }}
                  placeholder="请输入提示文字"
                  className="w-full text-xl text-foreground bg-transparent outline-none"
                />
              </div>
            </div>

            <div
              onClick={() => setEditingField({...editingField, is_required: !editingField.is_required})}
              className="flex items-center gap-3 mb-4 p-3 bg-muted/30 rounded">
              <div
                className={`w-6 h-6 rounded border-2 flex items-center justify-center ${
                  editingField.is_required ? 'bg-primary border-primary' : 'border-border bg-background'
                }`}>
                {editingField.is_required && <div className="i-mdi-check text-primary-foreground text-lg" />}
              </div>
              <div className="text-xl text-foreground">必填项</div>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowFieldDialog(false)
                  setEditingField(null)
                }}
                className="flex-1 py-3 bg-card border-2 border-border text-foreground text-xl rounded flex items-center justify-center leading-none">
                取消
              </button>
              <button
                type="button"
                onClick={handleSaveField}
                className="flex-1 py-3 bg-primary text-primary-foreground text-xl rounded flex items-center justify-center leading-none">
                确定
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 变更说明对话框 */}
      {showChangeDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-6">
          <div className="bg-card rounded p-6 w-full max-w-md">
            <div className="text-xl text-foreground font-bold mb-4">填写变更说明</div>
            <div className="mb-4">
              <div className="text-base text-muted-foreground mb-2">
                本次修改将创建新版本 v{currentVersion + 1}.0，请说明主要变更内容
              </div>
              <div className="border-2 border-input rounded px-4 py-3 bg-background overflow-hidden">
                <textarea
                  value={changeDescription}
                  onInput={(e) => {
                    const ev = e as unknown
                    setChangeDescription(
                      (ev as {detail?: {value?: string}}).detail?.value ??
                        (ev as {target?: {value?: string}}).target?.value ??
                        ''
                    )
                  }}
                  placeholder="例如：新增工作总结字段、调整字段顺序、修改必填项设置等"
                  className="w-full text-xl text-foreground bg-transparent outline-none"
                  style={{minHeight: '100px'}}
                />
              </div>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowChangeDialog(false)
                  setChangeDescription('')
                }}
                className="flex-1 py-3 bg-card border-2 border-border text-foreground text-xl rounded flex items-center justify-center leading-none">
                取消
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!changeDescription.trim()) {
                    Taro.showToast({title: '请填写变更说明', icon: 'none'})
                    return
                  }
                  performSave(changeDescription.trim())
                }}
                className="flex-1 py-3 bg-primary text-primary-foreground text-xl rounded flex items-center justify-center leading-none">
                确定保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default withRouteGuard(ReportTemplateEdit)
