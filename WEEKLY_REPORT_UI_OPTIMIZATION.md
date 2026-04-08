# 周报功能优化 - 实现文档

## 📋 功能概述

本次优化包含两个主要改进：
1. **工作汇报页面布局优化**：在"周报审阅"和"模板配置"之间增加"周报填报"入口，并将"模板配置"下移
2. **审阅体验优化**：在填写审阅意见时，能够同时查看完整的周报内容

---

## ✨ 功能特性

### 1. 工作汇报页面布局优化

#### 优化前
- 周报审阅（领导/管理员可见）
- 模板配置（管理员可见，在快捷功能区）
- 缺少明显的周报填报入口

#### 优化后
- 周报审阅（领导/管理员可见）
- **周报填报**（新增，所有用户可见）
- 模板配置（管理员可见，独立卡片）

#### 视觉改进
- 周报填报使用渐变背景和边框，突出显示
- 模板配置改为独立卡片，不再使用网格布局
- 统一的图标和文字说明，提升用户体验

### 2. 审阅体验优化

#### 优化前
- 填写审阅意见时，只能看到周报的简短预览
- 需要点击"查看详情"才能看到完整内容
- 审阅效率较低

#### 优化后
- 填写审阅意见时，自动展开显示完整周报内容
- 周报内容区域支持滚动，最大高度60vh
- 支持动态模板字段（custom_fields）和固定字段
- 自动解析项目进展数据，格式化显示

---

## 🔧 技术实现

### 1. 工作汇报页面布局优化

#### 修改文件
`/src/pages/reports/index.tsx`

#### 关键代码

```tsx
{/* 周报审阅入口（领导和管理员可见） */}
{isLeaderOrAdmin && (
  <div className="px-6 mt-4">
    <div
      onClick={() => Taro.navigateTo({url: '/pages/reports/review/index'})}
      className="bg-gradient-primary rounded p-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="i-mdi-clipboard-check text-4xl text-primary-foreground" />
        <div>
          <div className="text-xl text-primary-foreground font-bold">周报审阅</div>
          <div className="text-base text-primary-foreground/80">查看和审阅团队周报</div>
        </div>
      </div>
      <div className="i-mdi-chevron-right text-3xl text-primary-foreground" />
    </div>
  </div>
)}

{/* 周报填报入口 */}
<div className="px-6 mt-4">
  <div
    onClick={handleCreateReport}
    className="bg-gradient-subtle rounded p-4 flex items-center justify-between border-2 border-primary/30">
    <div className="flex items-center gap-3">
      <div className="i-mdi-file-document-edit text-4xl text-primary" />
      <div>
        <div className="text-xl text-foreground font-bold">周报填报</div>
        <div className="text-base text-muted-foreground">填写本周工作汇报</div>
      </div>
    </div>
    <div className="i-mdi-chevron-right text-3xl text-primary" />
  </div>
</div>

{/* 模板配置（仅管理员） */}
{(profile?.role === 'system_admin' || profile?.role === 'system_admin') && (
  <div className="px-6 mt-4">
    <div
      onClick={() => Taro.navigateTo({url: '/pages/report-templates/list/index'})}
      className="bg-card rounded p-4 flex items-center justify-between border border-border">
      <div className="flex items-center gap-3">
        <div className="i-mdi-cog text-3xl text-foreground" />
        <div>
          <div className="text-xl text-foreground font-bold">模板配置</div>
          <div className="text-base text-muted-foreground">管理周报模板</div>
        </div>
      </div>
      <div className="i-mdi-chevron-right text-2xl text-muted-foreground" />
    </div>
  </div>
)}
```

### 2. 审阅体验优化

#### 修改文件
- `/src/pages/reports/review/index.tsx`
- `/src/db/types.ts`

#### 关键代码

##### 周报内容展示

```tsx
{/* 审阅输入区域 */}
{reviewingReportId === report.id && (
  <div className="mb-3 p-4 bg-muted/50 rounded border-2 border-primary">
    {/* 周报内容展示 */}
    <div className="mb-4 p-4 bg-background rounded border border-border max-h-[60vh] overflow-y-auto">
      <div className="text-xl text-foreground font-bold mb-3">周报内容</div>
      
      {/* 动态字段内容（custom_fields） */}
      {report.custom_fields && typeof report.custom_fields === 'object' && (
        <div className="flex flex-col gap-4">
          {Object.entries(report.custom_fields as Record<string, string>).map(([key, value]) => {
            if (!value) return null
            
            // 尝试解析项目进展数据（如果是JSON字符串）
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

            // 格式化字段名称
            const fieldLabel = key
              .replace(/_/g, ' ')
              .replace(/\b\w/g, (l) => l.toUpperCase())

            return (
              <div key={key}>
                <div className="text-base text-muted-foreground mb-2">{fieldLabel}</div>
                <div className="text-base text-foreground whitespace-pre-wrap">
                  {displayValue}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* 如果没有custom_fields，显示固定字段 */}
      {(!report.custom_fields || Object.keys(report.custom_fields as object).length === 0) && (
        <>
          {/* 本周核心工作完成情况 */}
          {report.core_work && (
            <div className="mb-4">
              <div className="text-base text-muted-foreground mb-2">本周核心工作完成情况</div>
              <div className="text-base text-foreground whitespace-pre-wrap">
                {report.core_work}
              </div>
            </div>
          )}
          {/* 其他固定字段... */}
        </>
      )}
    </div>

    {/* 审阅意见输入 */}
    <div className="text-xl text-foreground font-bold mb-3">填写审阅意见</div>
    <div className="border-2 border-input rounded px-4 py-3 bg-background overflow-hidden mb-3">
      <textarea
        value={reviewComment}
        onInput={(e) => setReviewComment(e.detail.value)}
        placeholder="请输入审阅意见（可选）"
        className="w-full text-xl text-foreground bg-transparent outline-none"
        style={{minHeight: '120px'}}
      />
    </div>
    
    {/* 审阅按钮 */}
    <div className="flex gap-2">
      <button type="button" onClick={handleCancelReview}>取消</button>
      <button type="button" onClick={() => handleSubmitReview(report.id, 'approved')}>通过</button>
      <button type="button" onClick={() => handleSubmitReview(report.id, 'rejected')}>需修改</button>
    </div>
  </div>
)}
```

##### 类型定义更新

```typescript
// /src/db/types.ts
export interface WeeklyReport {
  id: string
  user_id: string
  week_start_date: string
  week_end_date: string
  template_id?: string              // 新增：模板ID
  custom_fields?: Record<string, unknown>  // 新增：动态字段
  core_work: string
  project_progress: string
  bidding_work: string
  customer_contact: string
  next_week_plan: string
  issues: string | null
  attachments: unknown[]
  status: ReportStatus
  review_status: 'pending' | 'approved' | 'rejected'
  review_comment: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  created_at: string
  updated_at: string
}
```

---

## 🎨 UI/UX 改进

### 1. 工作汇报页面

#### 视觉层次
- **一级入口**：周报审阅（渐变背景，最突出）
- **二级入口**：周报填报（渐变背景+边框，次突出）
- **三级入口**：模板配置（普通卡片，管理功能）

#### 图标选择
- 周报审阅：`i-mdi-clipboard-check`（剪贴板+勾选）
- 周报填报：`i-mdi-file-document-edit`（文档+编辑）
- 模板配置：`i-mdi-cog`（齿轮）

#### 文字说明
- 主标题：功能名称（加粗）
- 副标题：功能说明（灰色）

### 2. 审阅页面

#### 内容展示区域
- 白色背景，与审阅输入区分开
- 最大高度60vh，超出部分可滚动
- 字段标签使用灰色，内容使用黑色
- 保留换行和空格（whitespace-pre-wrap）

#### 项目进展特殊处理
- 自动解析JSON格式的项目数据
- 格式化显示：【项目名称】+ 进展内容
- 多个项目之间用空行分隔

#### 审阅意见输入
- 明确的标题"填写审阅意见"
- 大尺寸输入框（120px最小高度）
- 占位符提示支持多行输入

---

## 📝 使用流程

### 1. 填写周报

1. 进入"工作汇报"页面
2. 点击"周报填报"卡片
3. 填写周报内容
4. 保存草稿或提交

### 2. 审阅周报

1. 进入"工作汇报"页面
2. 点击"周报审阅"卡片
3. 筛选待审阅的周报
4. 点击某条周报的"审阅"按钮
5. **自动展开显示完整周报内容**
6. 在下方输入审阅意见
7. 点击"通过"或"需修改"

### 3. 配置模板（管理员）

1. 进入"工作汇报"页面
2. 点击"模板配置"卡片
3. 管理周报模板

---

## ✅ 验证要点

### 功能验证

- [x] 工作汇报页面显示"周报填报"入口
- [x] "周报填报"位于"周报审阅"和"模板配置"之间
- [x] "模板配置"只对管理员可见
- [x] 点击"周报填报"跳转到创建页面
- [x] 审阅时能看到完整周报内容
- [x] 周报内容区域可滚动
- [x] 支持动态字段（custom_fields）
- [x] 支持固定字段（core_work等）
- [x] 项目进展数据正确解析和显示

### UI验证

- [x] 周报填报卡片样式正确
- [x] 图标和文字对齐
- [x] 模板配置改为独立卡片
- [x] 周报内容展示区域样式正确
- [x] 滚动条正常工作
- [x] 字段标签和内容区分明显
- [x] 审阅意见输入框大小合适

### 兼容性验证

- [x] 支持旧版周报（固定字段）
- [x] 支持新版周报（动态字段）
- [x] 项目进展JSON解析容错
- [x] 空字段不显示

---

## 🔍 技术细节

### 1. 动态字段解析

```typescript
// 遍历custom_fields对象
Object.entries(report.custom_fields as Record<string, string>).map(([key, value]) => {
  if (!value) return null
  
  // 尝试解析JSON（项目进展数据）
  try {
    const parsed = JSON.parse(value)
    if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].projectId) {
      // 是项目进展数据，格式化显示
      displayValue = parsed.map((p: {projectName: string; content: string}) => 
        `【${p.projectName}】\n${p.content}`
      ).join('\n\n')
    }
  } catch {
    // 不是JSON，保持原值
  }
  
  // 格式化字段名称
  const fieldLabel = key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (l) => l.toUpperCase())
  
  return (
    <div key={key}>
      <div className="text-base text-muted-foreground mb-2">{fieldLabel}</div>
      <div className="text-base text-foreground whitespace-pre-wrap">
        {displayValue}
      </div>
    </div>
  )
})
```

### 2. 滚动区域实现

```tsx
<div className="mb-4 p-4 bg-background rounded border border-border max-h-[60vh] overflow-y-auto">
  {/* 周报内容 */}
</div>
```

- `max-h-[60vh]`：最大高度为视口高度的60%
- `overflow-y-auto`：垂直方向超出时显示滚动条

### 3. 兼容性处理

```typescript
{/* 动态字段内容（custom_fields） */}
{report.custom_fields && typeof report.custom_fields === 'object' && (
  // 显示动态字段
)}

{/* 如果没有custom_fields，显示固定字段 */}
{(!report.custom_fields || Object.keys(report.custom_fields as object).length === 0) && (
  // 显示固定字段
)}
```

---

## 🎯 后续优化建议

### 1. 周报内容展示

- 添加字段折叠/展开功能
- 支持富文本内容渲染
- 添加附件预览功能
- 支持导出为PDF

### 2. 审阅流程

- 支持批量审阅
- 添加审阅模板（常用意见）
- 支持@提及相关人员
- 添加审阅历史记录查看

### 3. 移动端优化

- 优化滚动体验
- 添加手势操作
- 优化长内容显示
- 添加快捷操作按钮

### 4. 数据统计

- 统计审阅效率
- 分析常见问题
- 生成审阅报告
- 提供改进建议

---

## 📊 数据结构

### 周报数据结构

```typescript
{
  id: "uuid",
  user_id: "uuid",
  week_start_date: "2026-04-06",
  week_end_date: "2026-04-12",
  template_id: "uuid",
  custom_fields: {
    "core_work": "完成了XXX工作",
    "project_progress": "[{\"projectId\":\"uuid\",\"projectName\":\"项目A\",\"content\":\"进展情况\"}]",
    "next_week_plan": "下周计划XXX",
    "issues": "存在XXX问题"
  },
  status: "submitted",
  review_status: "pending",
  review_comment: null,
  reviewed_by: null,
  reviewed_at: null,
  created_at: "2026-04-07T10:00:00Z",
  updated_at: "2026-04-07T10:00:00Z"
}
```

### 项目进展数据结构

```typescript
[
  {
    projectId: "uuid-1",
    projectName: "项目A",
    content: "本周完成了初步设计"
  },
  {
    projectId: "uuid-2",
    projectName: "项目B",
    content: "进行了现场勘查"
  }
]
```

---

## 📞 技术支持

### 相关文件

- **工作汇报页面**：`/src/pages/reports/index.tsx`
- **周报审阅页面**：`/src/pages/reports/review/index.tsx`
- **类型定义**：`/src/db/types.ts`

### 调试方法

1. **查看周报数据结构**
   ```typescript
   console.log('周报数据:', report)
   console.log('动态字段:', report.custom_fields)
   ```

2. **查看项目进展解析**
   ```typescript
   console.log('原始值:', value)
   console.log('解析后:', displayValue)
   ```

3. **查看滚动区域**
   ```typescript
   console.log('内容高度:', element.scrollHeight)
   console.log('可视高度:', element.clientHeight)
   ```

---

## 📝 总结

本次优化主要改进了两个方面：

1. **工作汇报页面布局**
   - 增加了明显的"周报填报"入口
   - 优化了功能卡片的视觉层次
   - 改善了用户操作流程

2. **审阅体验**
   - 填写审阅意见时可以同时查看完整周报内容
   - 支持动态模板字段和固定字段
   - 自动解析和格式化项目进展数据
   - 添加滚动功能，支持长内容

这些改进显著提升了用户体验和工作效率，使周报填写和审阅流程更加流畅。

---

**文档版本**：v1.0  
**最后更新**：2026-04-07  
**作者**：秒哒AI助手
