# 周报模板功能实现说明

## 已完成功能

### 1. 数据库设计 ✅
- 创建了 `weekly_report_templates` 表（模板主表）
- 创建了 `weekly_report_template_fields` 表（模板字段表）
- 创建了 `department_template_mapping` 表（部门模板映射表）
- 在 `weekly_reports` 表添加了 `custom_fields` JSONB字段和 `template_id` 字段
- 插入了默认模板和默认字段
- 配置了完整的RLS策略

### 2. 模板配置页面 ✅
- 创建了模板列表页面 (`/pages/report-templates/list/index.tsx`)
  - 显示所有模板
  - 支持新建、编辑、删除模板
  - 默认模板不可删除
  
- 创建了模板编辑页面 (`/pages/report-templates/edit/index.tsx`)
  - 支持配置模板基本信息（名称、描述）
  - 支持添加、编辑、删除字段
  - 支持字段上下移动排序
  - 支持设置字段类型（text, textarea, number, date, file）
  - 支持设置必填项
  - 支持关联部门

- 在工作汇报主页添加了模板配置入口（仅管理员可见）

### 3. 首页功能增强 ✅
- 添加了小组年度目标展示区域
  - 管理员可编辑目标内容
  - 使用 `annual_goals` 表存储数据
  - 实现了目标编辑对话框
  
- 指派任务情况功能（已有实现）
  - 显示任务统计数据
  - 提供指派任务入口

## 待完成功能

### 周报填报页面改造
由于现有周报创建页面已经有430行代码且逻辑复杂，完整改造需要较长时间。建议的实现方案：

#### 方案一：渐进式改造（推荐）
1. 保留现有周报填报功能不变
2. 添加"使用自定义模板"选项
3. 用户选择使用自定义模板时，加载模板字段并动态渲染
4. 保存时将自定义字段数据存储到 `custom_fields` 字段

#### 方案二：完全重构
1. 完全基于模板系统重构周报填报页面
2. 根据用户部门自动加载对应模板
3. 动态渲染所有字段
4. 实现完整的必填项校验

#### 实现要点
```typescript
// 1. 加载模板
const loadTemplate = async () => {
  // 根据用户部门查找映射的模板
  const {data: mapping} = await supabase
    .from('department_template_mapping')
    .select('template_id')
    .eq('department', profile.department)
    .maybeSingle()

  const templateId = mapping?.template_id || defaultTemplateId

  // 加载模板字段
  const {data: fields} = await supabase
    .from('weekly_report_template_fields')
    .select('*')
    .eq('template_id', templateId)
    .order('display_order')

  return fields
}

// 2. 动态渲染字段
const renderField = (field) => {
  switch (field.field_type) {
    case 'text':
      return <input type="text" ... />
    case 'textarea':
      return <textarea ... />
    case 'number':
      return <input type="number" ... />
    case 'date':
      return <Picker mode="date" ... />
    case 'file':
      return <button onClick={handleFileUpload} ... />
  }
}

// 3. 必填项校验
const validateFields = () => {
  const errors = []
  fields.forEach(field => {
    if (field.is_required && !formData[field.field_name]) {
      errors.push(field.field_label)
    }
  })
  return errors
}

// 4. 保存数据
const saveReport = async () => {
  const {error} = await supabase
    .from('weekly_reports')
    .insert({
      user_id: profile.id,
      template_id: templateId,
      custom_fields: formData, // JSONB字段
      ...otherFields
    })
}
```

## 使用说明

### 管理员配置模板
1. 进入工作汇报主页
2. 点击"模板配置"按钮
3. 创建新模板或编辑现有模板
4. 添加字段并设置属性
5. 关联部门（可选）
6. 保存模板

### 用户填报周报
当前版本：使用现有的固定字段填报
未来版本：根据部门自动加载对应模板，动态显示字段

## 技术架构

### 数据库表结构
- `weekly_report_templates`: 模板主表
- `weekly_report_template_fields`: 模板字段表
- `department_template_mapping`: 部门模板映射表
- `annual_goals`: 年度目标表
- `weekly_reports.custom_fields`: JSONB字段存储自定义数据
- `weekly_reports.template_id`: 关联使用的模板

### 权限控制
- 所有用户可查看模板
- 仅管理员（super_admin, system_admin）可管理模板
- 所有用户可查看年度目标
- 仅管理员可编辑年度目标

### 页面路由
- `/pages/report-templates/list/index`: 模板列表
- `/pages/report-templates/edit/index`: 模板编辑
- `/pages/reports/create/index`: 周报填报（待改造）

## 后续优化建议

1. **周报填报页面改造**
   - 实现完整的模板驱动表单
   - 支持文件上传字段
   - 优化用户体验

2. **模板功能增强**
   - 支持字段验证规则（如数字范围、文本长度）
   - 支持字段依赖关系
   - 支持字段分组显示

3. **数据分析**
   - 基于自定义字段的数据统计
   - 跨模板的数据对比分析

4. **模板版本管理**
   - 支持模板版本控制
   - 历史版本回滚
