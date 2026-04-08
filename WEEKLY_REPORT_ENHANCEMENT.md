# 周报功能增强 - 实现文档

## 📋 功能概述

本次增强包含四个主要改进：
1. **周报撤回功能**：允许用户撤回已提交的周报，变回草稿状态
2. **审阅意见回复功能**：用户可以回复领导的审阅意见，并重新提交
3. **表单验证优化**：只验证"本周核心工作完成情况"必填项
4. **审阅内容展示优化**：按照模板字段顺序展示，使用中文标签

---

## ✨ 功能特性

### 1. 周报撤回功能

#### 功能说明
- 用户可以撤回处于"待审阅"状态的周报
- 撤回后周报变为草稿状态，可以重新编辑
- 撤回操作会清除审阅相关信息

#### 使用场景
- 提交后发现内容有误
- 需要补充更多信息
- 暂时不想提交审阅

#### 操作流程
1. 在"我的周报"列表中找到待审阅的周报
2. 点击周报卡片右上角的撤回按钮（撤销图标）
3. 确认撤回操作
4. 周报变为草稿状态，可以重新编辑

### 2. 审阅意见回复功能

#### 功能说明
- 领导审阅后标记为"需修改"的周报，用户可以回复
- 回复时可以说明改进措施和补充说明
- 回复后周报重新提交给审阅领导

#### 使用场景
- 领导提出修改意见
- 需要补充说明
- 需要解释某些情况

#### 操作流程
1. 在"我的周报"列表中找到有审阅意见的周报
2. 点击"回复并重新提交"按钮
3. 查看领导的审阅意见
4. 填写回复内容
5. 提交回复

### 3. 表单验证优化

#### 优化前
- 验证所有标记为必填的字段
- 可能导致用户填写负担过重

#### 优化后
- 只验证"本周核心工作完成情况"一个字段
- 其他字段可选填写
- 提升填写效率

### 4. 审阅内容展示优化

#### 优化前
- 字段顺序不固定
- 使用英文字段名（如"Work Completed"）
- 不符合中文用户习惯

#### 优化后
- 按照模板定义的字段顺序展示
- 使用中文字段标签（如"本周核心工作完成情况"）
- 自动解析项目进展数据
- 更符合用户阅读习惯

---

## 🔧 技术实现

### 1. 周报撤回功能

#### 数据库操作

```typescript
// 撤回周报
const handleWithdrawReport = async (id: string) => {
  const {error} = await supabase
    .from('weekly_reports')
    .update({
      status: 'draft',
      review_status: 'pending',
      review_comment: null,
      reviewed_by: null,
      reviewed_at: null
    })
    .eq('id', id)
}
```

#### UI实现

```tsx
{/* 已提交状态显示撤回按钮 */}
{report.status === 'pending_review' && (
  <button
    type="button"
    onClick={(e) => {
      e.stopPropagation()
      handleWithdrawReport(report.id)
    }}
    className="p-2 text-warning">
    <div className="i-mdi-undo text-2xl" />
  </button>
)}
```

### 2. 审阅意见回复功能

#### 数据库迁移

```sql
-- 为weekly_reports表添加用户回复字段
ALTER TABLE weekly_reports ADD COLUMN IF NOT EXISTS user_reply TEXT;
ALTER TABLE weekly_reports ADD COLUMN IF NOT EXISTS replied_at TIMESTAMPTZ;

-- 添加注释
COMMENT ON COLUMN weekly_reports.user_reply IS '用户对审阅意见的回复';
COMMENT ON COLUMN weekly_reports.replied_at IS '用户回复时间';
```

#### 类型定义更新

```typescript
export interface WeeklyReport {
  // ... 其他字段
  user_reply: string | null
  replied_at: string | null
}
```

#### 回复页面实现

创建新页面：`/src/pages/reports/reply/index.tsx`

```typescript
const handleSubmit = async () => {
  const {error} = await supabase
    .from('weekly_reports')
    .update({
      status: 'pending_review',
      review_status: 'pending',
      user_reply: replyContent.trim(),
      replied_at: new Date().toISOString()
    })
    .eq('id', report.id)
}
```

#### UI实现

```tsx
{/* 需修改状态显示回复按钮 */}
{report.review_comment && report.review_status === 'rejected' && (
  <button
    type="button"
    onClick={(e) => {
      e.stopPropagation()
      handleReplyReport(report.id)
    }}
    className="px-4 py-2 bg-primary text-primary-foreground text-base rounded flex items-center gap-2 leading-none">
    <div className="i-mdi-reply text-xl" />
    回复并重新提交
  </button>
)}
```

### 3. 表单验证优化

#### 验证逻辑修改

```typescript
// 验证必填项（只验证本周核心工作完成情况）
const validateForm = () => {
  const errors: string[] = []

  // 只验证"本周核心工作完成情况"字段
  const coreWorkField = templateFields.find(
    f => f.field_name === 'core_work' || 
         f.field_label.includes('本周') || 
         f.field_label.includes('核心工作')
  )
  
  if (coreWorkField && !formData[coreWorkField.field_name]?.trim()) {
    errors.push(coreWorkField.field_label)
  }

  return errors
}
```

### 4. 审阅内容展示优化

#### 加载模板字段

```typescript
// 加载模板字段
const loadTemplateFields = useCallback(async (templateIds: string[]) => {
  const {data, error} = await supabase
    .from('weekly_report_template_fields')
    .select('*')
    .in('template_id', templateIds)
    .order('display_order')

  // 按template_id分组
  const fieldsMap: Record<string, WeeklyReportTemplateField[]> = {}
  data?.forEach((field) => {
    if (!fieldsMap[field.template_id]) {
      fieldsMap[field.template_id] = []
    }
    fieldsMap[field.template_id].push(field)
  })

  setTemplateFieldsMap(fieldsMap)
}, [])
```

#### 按顺序展示内容

```tsx
{/* 动态字段内容（custom_fields），按模板字段顺序展示 */}
{report.custom_fields && report.template_id && templateFieldsMap[report.template_id] ? (
  <div className="flex flex-col gap-4">
    {templateFieldsMap[report.template_id].map((field) => {
      const value = (report.custom_fields as Record<string, string>)[field.field_name]
      if (!value) return null
      
      // 尝试解析项目进展数据
      let displayValue = value
      try {
        const parsed = JSON.parse(value)
        if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].projectId) {
          displayValue = parsed.map((p: {projectName: string; content: string}) => 
            `【${p.projectName}】\n${p.content}`
          ).join('\n\n')
        }
      } catch {
        // 不是JSON，保持原值
      }

      return (
        <div key={field.id}>
          <div className="text-base text-muted-foreground mb-2">{field.field_label}</div>
          <div className="text-base text-foreground whitespace-pre-wrap">
            {displayValue}
          </div>
        </div>
      )
    })}
  </div>
) : (
  // 降级方案：没有模板字段信息时的显示
)}
```

---

## 🎨 UI/UX 改进

### 1. 周报列表

#### 撤回按钮
- 位置：周报卡片右上角，状态标签旁边
- 图标：`i-mdi-undo`（撤销图标）
- 颜色：警告色（黄色）
- 仅在"待审阅"状态显示

#### 回复按钮
- 位置：审阅批复下方
- 样式：主色调按钮，带图标
- 图标：`i-mdi-reply`（回复图标）
- 文字："回复并重新提交"
- 仅在"需修改"状态显示

### 2. 回复页面

#### 页面结构
- 顶部：页面标题和周报周期
- 中部：领导审阅意见（黄色背景）
- 下部：回复内容输入框
- 底部：取消和提交按钮

#### 审阅意见展示
- 黄色背景（warning/10）
- 黄色边框（warning/30）
- 显示审阅时间
- 保留换行格式

#### 回复输入
- 大尺寸输入框（150px最小高度）
- 必填标记（红色星号）
- 占位符提示
- 提示文字：回复后周报将重新提交给审阅领导

### 3. 审阅页面

#### 内容展示
- 按模板字段顺序排列
- 使用中文字段标签
- 字段标签灰色，内容黑色
- 项目进展特殊格式化
- 最大高度60vh，可滚动

---

## 📝 使用流程

### 1. 撤回周报

```
用户操作流程：
1. 进入"工作汇报"页面
2. 在"我的周报"列表中找到待审阅的周报
3. 点击周报卡片右上角的撤回按钮（撤销图标）
4. 在弹窗中确认撤回操作
5. 周报变为草稿状态
6. 可以点击编辑按钮重新编辑周报
```

### 2. 回复审阅意见

```
用户操作流程：
1. 进入"工作汇报"页面
2. 在"我的周报"列表中找到有审阅意见的周报
3. 查看审阅批复内容
4. 点击"回复并重新提交"按钮
5. 进入回复页面，查看完整的审阅意见
6. 在回复内容输入框中填写回复
7. 点击"提交回复"按钮
8. 周报重新提交给审阅领导
```

### 3. 填写周报（优化后）

```
用户操作流程：
1. 进入"工作汇报"页面
2. 点击"周报填报"卡片
3. 选择填报周期
4. 填写"本周核心工作完成情况"（必填）
5. 选择性填写其他字段
6. 点击"提交周报"
7. 系统只验证"本周核心工作完成情况"是否填写
8. 验证通过后提交成功
```

### 4. 审阅周报（优化后）

```
领导操作流程：
1. 进入"工作汇报"页面
2. 点击"周报审阅"卡片
3. 筛选待审阅的周报
4. 点击某条周报的"审阅"按钮
5. 查看周报内容（按模板字段顺序，中文标签）
6. 在下方输入审阅意见
7. 点击"通过"或"需修改"
8. 如果标记为"需修改"，用户可以回复
```

---

## ✅ 验证要点

### 功能验证

- [x] 待审阅周报显示撤回按钮
- [x] 点击撤回按钮弹出确认对话框
- [x] 撤回后周报变为草稿状态
- [x] 撤回后清除审阅相关信息
- [x] 需修改周报显示回复按钮
- [x] 点击回复按钮跳转到回复页面
- [x] 回复页面显示审阅意见
- [x] 回复页面可以填写回复内容
- [x] 提交回复后周报重新提交
- [x] 只验证"本周核心工作完成情况"
- [x] 其他字段可以为空
- [x] 审阅页面按模板字段顺序展示
- [x] 审阅页面使用中文字段标签
- [x] 项目进展数据正确解析

### UI验证

- [x] 撤回按钮位置正确
- [x] 撤回按钮图标和颜色正确
- [x] 回复按钮样式正确
- [x] 回复页面布局合理
- [x] 审阅意见展示清晰
- [x] 回复输入框大小合适
- [x] 审阅内容展示顺序正确
- [x] 字段标签使用中文

### 数据验证

- [x] 撤回操作正确更新数据库
- [x] 回复内容正确保存
- [x] 回复时间正确记录
- [x] 模板字段正确加载
- [x] 字段顺序正确排列

---

## 🔍 技术细节

### 1. 状态管理

#### 周报状态流转

```
草稿 (draft)
  ↓ 提交
待审阅 (pending_review)
  ↓ 撤回
草稿 (draft)
  ↓ 提交
待审阅 (pending_review)
  ↓ 审阅
已审阅 (reviewed) / 需修改 (rejected)
  ↓ 回复（如果是rejected）
待审阅 (pending_review)
```

#### 审阅状态

```typescript
review_status: 'pending' | 'approved' | 'rejected'
```

- `pending`: 待审阅
- `approved`: 已通过
- `rejected`: 需修改

### 2. 数据结构

#### 周报数据

```typescript
{
  id: "uuid",
  user_id: "uuid",
  week_start_date: "2026-04-06",
  week_end_date: "2026-04-12",
  template_id: "uuid",
  custom_fields: {
    "core_work": "完成了XXX工作",
    "project_progress": "[{...}]",
    // ...
  },
  status: "pending_review",
  review_status: "rejected",
  review_comment: "需要补充更多细节",
  reviewed_by: "uuid",
  reviewed_at: "2026-04-07T10:00:00Z",
  user_reply: "已补充相关细节",
  replied_at: "2026-04-07T11:00:00Z"
}
```

#### 模板字段数据

```typescript
{
  id: "uuid",
  template_id: "uuid",
  field_name: "core_work",
  field_label: "本周核心工作完成情况",
  field_type: "textarea",
  is_required: true,
  display_order: 1,
  placeholder: "请详细描述本周完成的主要工作内容"
}
```

### 3. 路由配置

```typescript
// app.config.ts
const pages = [
  // ...
  'pages/reports/reply/index',  // 新增回复页面
  // ...
]
```

---

## 🎯 后续优化建议

### 1. 撤回功能增强

- 添加撤回次数限制
- 记录撤回历史
- 撤回时保留审阅意见（仅供参考）
- 支持撤回原因填写

### 2. 回复功能增强

- 支持多轮对话
- 显示回复历史
- 支持@提及审阅人
- 添加回复模板

### 3. 验证功能增强

- 支持自定义必填字段
- 支持字段级别的验证规则
- 添加字段依赖验证
- 支持异步验证

### 4. 展示功能增强

- 支持字段分组展示
- 添加字段折叠/展开
- 支持富文本内容渲染
- 添加字段权重排序

---

## 📊 数据库变更

### 新增字段

```sql
-- weekly_reports表
ALTER TABLE weekly_reports ADD COLUMN user_reply TEXT;
ALTER TABLE weekly_reports ADD COLUMN replied_at TIMESTAMPTZ;
```

### 字段说明

| 字段名 | 类型 | 说明 | 可空 |
|--------|------|------|------|
| user_reply | TEXT | 用户对审阅意见的回复 | 是 |
| replied_at | TIMESTAMPTZ | 用户回复时间 | 是 |

---

## 📞 技术支持

### 相关文件

- **工作汇报页面**：`/src/pages/reports/index.tsx`
- **周报创建页面**：`/src/pages/reports/create/index.tsx`
- **周报审阅页面**：`/src/pages/reports/review/index.tsx`
- **周报回复页面**：`/src/pages/reports/reply/index.tsx`（新增）
- **类型定义**：`/src/db/types.ts`
- **数据库迁移**：`/supabase/migrations/00041_add_user_reply_to_weekly_reports.sql`

### 调试方法

1. **查看周报状态**
   ```typescript
   console.log('周报状态:', report.status)
   console.log('审阅状态:', report.review_status)
   ```

2. **查看回复数据**
   ```typescript
   console.log('用户回复:', report.user_reply)
   console.log('回复时间:', report.replied_at)
   ```

3. **查看模板字段**
   ```typescript
   console.log('模板字段:', templateFieldsMap[report.template_id])
   ```

---

## 📝 总结

本次功能增强主要改进了四个方面：

1. **周报撤回功能**
   - 允许用户撤回已提交的周报
   - 撤回后可以重新编辑
   - 提升了用户的操作灵活性

2. **审阅意见回复功能**
   - 用户可以回复领导的审阅意见
   - 支持重新提交审阅
   - 形成完整的沟通闭环

3. **表单验证优化**
   - 只验证核心必填项
   - 减轻用户填写负担
   - 提升填写效率

4. **审阅内容展示优化**
   - 按模板字段顺序展示
   - 使用中文字段标签
   - 提升阅读体验

这些改进显著提升了周报系统的易用性和用户体验，使周报填写、审阅、反馈流程更加完善。

---

**文档版本**：v1.0  
**最后更新**：2026-04-07  
**作者**：秒哒AI助手
