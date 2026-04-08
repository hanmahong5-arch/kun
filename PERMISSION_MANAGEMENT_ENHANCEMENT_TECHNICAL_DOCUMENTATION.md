# 权限管理系统增强 - 技术文档

## 📋 项目概述

本项目对现有权限管理系统进行全面增强，新增权限预览、权限对比、权限模板和权限继承关系可视化等功能，大幅提升系统的易用性和管理效率。

### 核心功能

1. **权限预览面板** - 实时查看用户/角色的所有权限，区分直接权限和继承权限
2. **权限对比工具** - 对比两个用户/角色的权限差异，高亮显示交集和独有权限
3. **权限模板库** - 预设和自定义权限配置模板，支持快速应用和版本管理
4. **权限继承关系可视化** - 图形化展示用户-角色-权限的复杂继承关系

---

## 🗄️ 数据库设计

### 新增表结构

#### 1. permission_templates（权限模板表）

存储预设和自定义的权限配置模板。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| code | VARCHAR(100) | 模板代码，唯一 |
| name | VARCHAR(255) | 模板名称 |
| description | TEXT | 模板描述 |
| category | VARCHAR(50) | 模板分类（system/custom） |
| is_active | BOOLEAN | 是否启用 |
| version | INTEGER | 版本号 |
| created_by | UUID | 创建人ID |
| created_at | TIMESTAMPTZ | 创建时间 |
| updated_by | UUID | 更新人ID |
| updated_at | TIMESTAMPTZ | 更新时间 |

#### 2. permission_template_items（权限模板详情表）

存储模板包含的具体权限。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| template_id | UUID | 模板ID（外键） |
| permission_id | UUID | 权限ID（外键） |
| created_at | TIMESTAMPTZ | 创建时间 |

唯一约束：(template_id, permission_id)

#### 3. permission_template_versions（权限模板版本表）

用于版本管理和历史追溯。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| template_id | UUID | 模板ID（外键） |
| version | INTEGER | 版本号 |
| name | VARCHAR(255) | 版本名称 |
| description | TEXT | 版本描述 |
| permission_snapshot | JSONB | 权限快照 |
| created_by | UUID | 创建人ID |
| created_at | TIMESTAMPTZ | 创建时间 |

唯一约束：(template_id, version)

#### 4. permission_template_applications（权限模板应用记录表）

记录模板应用历史。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| template_id | UUID | 模板ID（外键） |
| template_version | INTEGER | 模板版本号 |
| target_type | VARCHAR(20) | 目标类型（user/role） |
| target_id | UUID | 目标ID |
| applied_by | UUID | 应用人ID |
| applied_at | TIMESTAMPTZ | 应用时间 |
| status | VARCHAR(20) | 状态（success/failed/rolled_back） |
| error_message | TEXT | 错误信息 |

### 数据库函数

#### 1. get_user_all_permissions(user_uuid UUID)

获取用户的所有权限（包括通过角色继承的权限）。

**返回字段**：
- permission_id - 权限ID
- permission_code - 权限代码
- permission_name - 权限名称
- permission_type - 权限类型（menu/operation/data）
- permission_description - 权限描述
- source - 权限来源（direct/inherited）
- source_role_id - 来源角色ID
- source_role_name - 来源角色名称

#### 2. get_role_all_permissions(role_uuid UUID)

获取角色的所有权限。

**返回字段**：
- permission_id - 权限ID
- permission_code - 权限代码
- permission_name - 权限名称
- permission_type - 权限类型
- permission_description - 权限描述

#### 3. compare_permission_sets(set1_ids UUID[], set2_ids UUID[])

对比两个权限集合，返回交集、差异和独有权限。

**返回字段**：
- permission_id - 权限ID
- permission_code - 权限代码
- permission_name - 权限名称
- permission_type - 权限类型
- in_set1 - 是否在集合1中
- in_set2 - 是否在集合2中
- comparison_result - 对比结果（both/only_set1/only_set2）

### 预设权限模板

系统预设了5个权限模板：

1. **employee_basic（普通员工）** - 适用于经营中心普通员工
2. **department_manager（部门经理）** - 适用于部门经理
3. **system_administrator（系统管理员）** - 适用于系统管理员
4. **data_clerk（资料员）** - 适用于资料员
5. **company_leader（公司领导）** - 适用于公司领导

---

## 🔌 Edge Functions API

### 1. get-user-permissions-preview

获取用户权限预览。

**请求方式**：GET

**请求参数**：
- `user_id` (必填) - 用户ID
- `permission_type` (可选) - 权限类型筛选（menu/operation/data）

**返回数据**：
```json
{
  "success": true,
  "data": {
    "userId": "uuid",
    "permissions": {
      "menu": [...],
      "operation": [...],
      "data": [...]
    },
    "statistics": {
      "total": 50,
      "menu": 20,
      "operation": 25,
      "data": 5,
      "direct": 10,
      "inherited": 40
    },
    "allPermissions": [...]
  }
}
```

**调用示例**：
```javascript
const { data, error } = await supabase.functions.invoke(
  'get-user-permissions-preview?user_id=xxx&permission_type=menu'
)
```

### 2. get-role-permissions-preview

获取角色权限预览。

**请求方式**：GET

**请求参数**：
- `role_id` (必填) - 角色ID
- `permission_type` (可选) - 权限类型筛选

**返回数据**：
```json
{
  "success": true,
  "data": {
    "roleId": "uuid",
    "permissions": {
      "menu": [...],
      "operation": [...],
      "data": [...]
    },
    "statistics": {
      "total": 30,
      "menu": 15,
      "operation": 12,
      "data": 3
    },
    "allPermissions": [...]
  }
}
```

### 3. compare-permissions

权限对比工具。

**请求方式**：GET

**请求参数**：
- `type1` (必填) - 对比对象1类型（user/role）
- `id1` (必填) - 对比对象1的ID
- `type2` (必填) - 对比对象2类型（user/role）
- `id2` (必填) - 对比对象2的ID

**返回数据**：
```json
{
  "success": true,
  "data": {
    "statistics": {
      "object1": {
        "type": "user",
        "id": "uuid",
        "name": "张三（13800138000）",
        "totalPermissions": 50
      },
      "object2": {
        "type": "role",
        "id": "uuid",
        "name": "系统管理员",
        "totalPermissions": 60
      },
      "comparison": {
        "intersection": 40,
        "onlyInObject1": 10,
        "onlyInObject2": 20
      }
    },
    "intersection": [...],
    "onlyInObject1": [...],
    "onlyInObject2": [...],
    "allPermissions": {
      "object1": [...],
      "object2": [...]
    }
  }
}
```

**调用示例**：
```javascript
const { data, error } = await supabase.functions.invoke(
  'compare-permissions?type1=user&id1=xxx&type2=role&id2=yyy'
)
```

### 4. permission-templates

权限模板管理（CRUD）。

#### 4.1 查询模板列表

**请求方式**：GET

**请求参数**：
- `category` (可选) - 模板分类（system/custom）
- `is_active` (可选) - 是否启用（true/false）

**返回数据**：
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "code": "employee_basic",
      "name": "普通员工",
      "description": "...",
      "category": "system",
      "is_active": true,
      "version": 1,
      "created_at": "2026-04-06T00:00:00Z"
    }
  ]
}
```

#### 4.2 查询单个模板详情

**请求方式**：GET

**请求参数**：
- `id` (必填) - 模板ID

**返回数据**：
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "code": "employee_basic",
    "name": "普通员工",
    "description": "...",
    "category": "system",
    "is_active": true,
    "version": 1,
    "permissions": [
      {
        "id": "uuid",
        "code": "project_view",
        "name": "查看项目",
        "type": "menu",
        "description": "..."
      }
    ]
  }
}
```

#### 4.3 创建模板

**请求方式**：POST

**请求体**：
```json
{
  "code": "custom_template_1",
  "name": "自定义模板1",
  "description": "...",
  "category": "custom",
  "permission_ids": ["uuid1", "uuid2", "uuid3"],
  "created_by": "uuid"
}
```

**返回数据**：
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "code": "custom_template_1",
    "name": "自定义模板1",
    ...
  }
}
```

#### 4.4 更新模板

**请求方式**：PUT

**请求体**：
```json
{
  "id": "uuid",
  "name": "更新后的名称",
  "description": "更新后的描述",
  "is_active": true,
  "permission_ids": ["uuid1", "uuid2", "uuid3"],
  "updated_by": "uuid"
}
```

#### 4.5 删除模板

**请求方式**：DELETE

**请求参数**：
- `id` (必填) - 模板ID

**注意**：系统预设模板不能删除。

#### 4.6 应用模板

**请求方式**：POST（路径包含 /apply）

**请求体**：
```json
{
  "template_id": "uuid",
  "target_type": "role",
  "target_id": "uuid",
  "applied_by": "uuid"
}
```

**返回数据**：
```json
{
  "success": true,
  "message": "模板应用成功"
}
```

**注意**：
- 应用到角色时，会删除角色现有权限并替换为模板权限
- 应用到用户时，建议先创建角色并应用模板，然后将角色分配给用户

### 5. get-permission-hierarchy

获取权限继承关系图谱。

**请求方式**：GET

**请求参数**：
- `user_id` (可选) - 指定用户ID（查询该用户的关系图谱）
- `role_id` (可选) - 指定角色ID（查询该角色的关系图谱）
- `scope` (可选) - 范围（all/user/role），默认all

**返回数据**：
```json
{
  "success": true,
  "data": {
    "nodes": [
      {
        "id": "uuid",
        "type": "user",
        "label": "张三",
        "data": {
          "name": "张三",
          "phone": "13800138000",
          "role": "system_admin"
        }
      },
      {
        "id": "uuid",
        "type": "role",
        "label": "系统管理员",
        "data": {
          "code": "system_admin",
          "name": "系统管理员",
          "description": "..."
        }
      },
      {
        "id": "uuid",
        "type": "permission",
        "label": "查看项目",
        "data": {
          "code": "project_view",
          "name": "查看项目",
          "type": "menu",
          "description": "..."
        }
      }
    ],
    "edges": [
      {
        "id": "user-uuid-role-uuid",
        "source": "user-uuid",
        "target": "role-uuid",
        "type": "user-role",
        "label": "拥有角色"
      },
      {
        "id": "role-uuid-permission-uuid",
        "source": "role-uuid",
        "target": "permission-uuid",
        "type": "role-permission",
        "label": "拥有权限"
      }
    ],
    "statistics": {
      "totalNodes": 100,
      "totalEdges": 150,
      "nodesByType": {
        "user": 10,
        "role": 5,
        "permission": 80,
        "team": 5
      },
      "edgesByType": {
        "userRole": 20,
        "rolePermission": 120,
        "userTeam": 10
      }
    }
  }
}
```

**调用示例**：
```javascript
// 查询指定用户的关系图谱
const { data, error } = await supabase.functions.invoke(
  'get-permission-hierarchy?user_id=xxx'
)

// 查询指定角色的关系图谱
const { data, error } = await supabase.functions.invoke(
  'get-permission-hierarchy?role_id=xxx'
)

// 查询全局关系图谱
const { data, error } = await supabase.functions.invoke(
  'get-permission-hierarchy?scope=all'
)
```

---

## 🎨 前端实现指南

### 技术栈

- **框架**：Taro + React + TypeScript
- **样式**：Tailwind CSS
- **图形库**：ReactFlow（用于权限继承关系可视化）
- **状态管理**：React Hooks

### 组件结构

```
src/
├── components/
│   └── permission/
│       ├── PermissionPreviewPanel.tsx      # 权限预览面板组件
│       ├── PermissionCompareResult.tsx     # 权限对比结果组件
│       ├── PermissionTemplateCard.tsx      # 权限模板卡片组件
│       └── PermissionHierarchyGraph.tsx    # 权限继承关系图谱组件
├── pages/
│   └── system/
│       ├── permission-compare/
│       │   └── index.tsx                   # 权限对比页面
│       ├── permission-templates/
│       │   ├── index.tsx                   # 权限模板管理页面
│       │   └── edit/
│       │       └── index.tsx               # 权限模板编辑页面
│       └── permission-hierarchy/
│           └── index.tsx                   # 权限继承关系可视化页面
└── db/
    └── permission-api.ts                   # 权限相关API封装
```

### 核心组件实现

#### 1. PermissionPreviewPanel（权限预览面板）

**功能**：
- 展示用户/角色的所有权限
- 按权限类型分类展示（菜单访问、操作按钮、数据范围）
- 标识权限来源（直接、继承）
- 支持权限类型筛选

**Props**：
```typescript
interface PermissionPreviewPanelProps {
  targetType: 'user' | 'role'
  targetId: string
  onClose?: () => void
}
```

**使用示例**：
```tsx
<PermissionPreviewPanel
  targetType="user"
  targetId={userId}
  onClose={() => setShowPreview(false)}
/>
```

#### 2. PermissionCompareResult（权限对比结果）

**功能**：
- 展示两个对象的权限对比结果
- 高亮显示交集、差异、独有权限
- 支持导出对比报告

**Props**：
```typescript
interface PermissionCompareResultProps {
  comparisonData: ComparisonData
  onExport?: () => void
}
```

#### 3. PermissionTemplateCard（权限模板卡片）

**功能**：
- 展示单个权限模板的信息
- 支持应用模板、编辑模板、删除模板操作

**Props**：
```typescript
interface PermissionTemplateCardProps {
  template: PermissionTemplate
  onApply?: (templateId: string) => void
  onEdit?: (templateId: string) => void
  onDelete?: (templateId: string) => void
}
```

#### 4. PermissionHierarchyGraph（权限继承关系图谱）

**功能**：
- 使用ReactFlow渲染权限继承关系图谱
- 支持节点点击查看详情
- 支持图谱缩放、拖拽、搜索

**Props**：
```typescript
interface PermissionHierarchyGraphProps {
  nodes: Node[]
  edges: Edge[]
  onNodeClick?: (node: Node) => void
}
```

### API封装（src/db/permission-api.ts）

```typescript
import { supabase } from '@/client/supabase'

// 获取用户权限预览
export async function getUserPermissionsPreview(
  userId: string,
  permissionType?: string
) {
  const params = new URLSearchParams({ user_id: userId })
  if (permissionType) {
    params.append('permission_type', permissionType)
  }

  const { data, error } = await supabase.functions.invoke(
    `get-user-permissions-preview?${params.toString()}`
  )

  if (error) {
    const errorMsg = await error?.context?.text?.()
    throw new Error(errorMsg || error.message)
  }

  return data
}

// 获取角色权限预览
export async function getRolePermissionsPreview(
  roleId: string,
  permissionType?: string
) {
  const params = new URLSearchParams({ role_id: roleId })
  if (permissionType) {
    params.append('permission_type', permissionType)
  }

  const { data, error } = await supabase.functions.invoke(
    `get-role-permissions-preview?${params.toString()}`
  )

  if (error) {
    const errorMsg = await error?.context?.text?.()
    throw new Error(errorMsg || error.message)
  }

  return data
}

// 对比权限
export async function comparePermissions(
  type1: 'user' | 'role',
  id1: string,
  type2: 'user' | 'role',
  id2: string
) {
  const params = new URLSearchParams({
    type1,
    id1,
    type2,
    id2
  })

  const { data, error } = await supabase.functions.invoke(
    `compare-permissions?${params.toString()}`
  )

  if (error) {
    const errorMsg = await error?.context?.text?.()
    throw new Error(errorMsg || error.message)
  }

  return data
}

// 查询权限模板列表
export async function getPermissionTemplates(
  category?: string,
  isActive?: boolean
) {
  const params = new URLSearchParams()
  if (category) params.append('category', category)
  if (isActive !== undefined) params.append('is_active', String(isActive))

  const { data, error } = await supabase.functions.invoke(
    `permission-templates?${params.toString()}`
  )

  if (error) {
    const errorMsg = await error?.context?.text?.()
    throw new Error(errorMsg || error.message)
  }

  return data
}

// 查询单个模板详情
export async function getPermissionTemplateDetail(templateId: string) {
  const { data, error } = await supabase.functions.invoke(
    `permission-templates?id=${templateId}`
  )

  if (error) {
    const errorMsg = await error?.context?.text?.()
    throw new Error(errorMsg || error.message)
  }

  return data
}

// 创建权限模板
export async function createPermissionTemplate(templateData: {
  code: string
  name: string
  description?: string
  category?: string
  permission_ids: string[]
  created_by: string
}) {
  const { data, error } = await supabase.functions.invoke('permission-templates', {
    method: 'POST',
    body: templateData
  })

  if (error) {
    const errorMsg = await error?.context?.text?.()
    throw new Error(errorMsg || error.message)
  }

  return data
}

// 更新权限模板
export async function updatePermissionTemplate(templateData: {
  id: string
  name?: string
  description?: string
  is_active?: boolean
  permission_ids?: string[]
  updated_by: string
}) {
  const { data, error } = await supabase.functions.invoke('permission-templates', {
    method: 'PUT',
    body: templateData
  })

  if (error) {
    const errorMsg = await error?.context?.text?.()
    throw new Error(errorMsg || error.message)
  }

  return data
}

// 删除权限模板
export async function deletePermissionTemplate(templateId: string) {
  const { data, error } = await supabase.functions.invoke(
    `permission-templates?id=${templateId}`,
    { method: 'DELETE' }
  )

  if (error) {
    const errorMsg = await error?.context?.text?.()
    throw new Error(errorMsg || error.message)
  }

  return data
}

// 应用权限模板
export async function applyPermissionTemplate(applicationData: {
  template_id: string
  target_type: 'user' | 'role'
  target_id: string
  applied_by: string
}) {
  const { data, error } = await supabase.functions.invoke('permission-templates/apply', {
    method: 'POST',
    body: applicationData
  })

  if (error) {
    const errorMsg = await error?.context?.text?.()
    throw new Error(errorMsg || error.message)
  }

  return data
}

// 获取权限继承关系图谱
export async function getPermissionHierarchy(params?: {
  user_id?: string
  role_id?: string
  scope?: string
}) {
  const searchParams = new URLSearchParams()
  if (params?.user_id) searchParams.append('user_id', params.user_id)
  if (params?.role_id) searchParams.append('role_id', params.role_id)
  if (params?.scope) searchParams.append('scope', params.scope)

  const { data, error } = await supabase.functions.invoke(
    `get-permission-hierarchy?${searchParams.toString()}`
  )

  if (error) {
    const errorMsg = await error?.context?.text?.()
    throw new Error(errorMsg || error.message)
  }

  return data
}
```

---

## 📱 页面实现指南

### 1. 权限对比页面（/pages/system/permission-compare/index.tsx）

**功能**：
- 选择两个对比对象（用户/角色）
- 展示对比结果（交集、差异、独有）
- 导出对比报告

**页面布局**：
```
┌─────────────────────────────────────────┐
│ 权限对比工具                              │
├─────────────────────────────────────────┤
│ 对比对象1：[用户/角色选择器]              │
│ 对比对象2：[用户/角色选择器]              │
│ [开始对比按钮]                            │
├─────────────────────────────────────────┤
│ 对比结果：                                │
│ ┌─────────────────────────────────────┐ │
│ │ 统计信息                             │ │
│ │ - 对象1：张三（50个权限）             │ │
│ │ - 对象2：系统管理员（60个权限）       │ │
│ │ - 交集：40个                         │ │
│ │ - 仅对象1：10个                      │ │
│ │ - 仅对象2：20个                      │ │
│ └─────────────────────────────────────┘ │
│ ┌─────────────────────────────────────┐ │
│ │ 交集权限（40个）                     │ │
│ │ [权限列表]                           │ │
│ └─────────────────────────────────────┘ │
│ ┌─────────────────────────────────────┐ │
│ │ 仅对象1拥有（10个）                  │ │
│ │ [权限列表]                           │ │
│ └─────────────────────────────────────┘ │
│ ┌─────────────────────────────────────┐ │
│ │ 仅对象2拥有（20个）                  │ │
│ │ [权限列表]                           │ │
│ └─────────────────────────────────────┘ │
│ [导出报告按钮]                           │
└─────────────────────────────────────────┘
```

### 2. 权限模板管理页面（/pages/system/permission-templates/index.tsx）

**功能**：
- 展示权限模板列表
- 创建/编辑/删除模板
- 应用模板到角色
- 查看模板版本历史

**页面布局**：
```
┌─────────────────────────────────────────┐
│ 权限模板管理                              │
│ [新建模板按钮]                            │
├─────────────────────────────────────────┤
│ 筛选：[系统预设/自定义] [启用/停用]       │
├─────────────────────────────────────────┤
│ ┌─────────────────────────────────────┐ │
│ │ 模板卡片1                            │ │
│ │ 名称：普通员工                       │ │
│ │ 分类：系统预设                       │ │
│ │ 权限数量：30个                       │ │
│ │ 版本：v1                             │ │
│ │ [查看详情] [应用] [编辑]             │ │
│ └─────────────────────────────────────┘ │
│ ┌─────────────────────────────────────┐ │
│ │ 模板卡片2                            │ │
│ │ ...                                  │ │
│ └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

### 3. 权限继承关系可视化页面（/pages/system/permission-hierarchy/index.tsx）

**功能**：
- 图形化展示权限继承关系
- 支持节点点击查看详情
- 支持图谱缩放、拖拽、搜索

**页面布局**：
```
┌─────────────────────────────────────────┐
│ 权限继承关系图谱                          │
├─────────────────────────────────────────┤
│ 筛选：[用户ID] [角色ID] [范围]           │
│ 搜索：[搜索框]                            │
├─────────────────────────────────────────┤
│ ┌─────────────────────────────────────┐ │
│ │                                     │ │
│ │        [图谱渲染区域]                │ │
│ │                                     │ │
│ │   用户 → 角色 → 权限                 │ │
│ │                                     │ │
│ │   [节点和边的可视化]                 │ │
│ │                                     │ │
│ └─────────────────────────────────────┘ │
│ 图例：                                   │
│ ● 用户  ● 角色  ● 权限  ● 小组           │
│ [缩放控制] [重置视图]                     │
└─────────────────────────────────────────┘
```

---

## 🎯 集成指南

### 1. 在用户管理页面集成权限预览

在现有的用户管理页面（`/pages/system/users/index.tsx`）中，为每个用户添加"查看权限"按钮：

```tsx
import { PermissionPreviewPanel } from '@/components/permission/PermissionPreviewPanel'

// 在用户列表中添加操作按钮
<button
  type="button"
  onClick={() => {
    setSelectedUserId(user.id)
    setShowPermissionPreview(true)
  }}
>
  查看权限
</button>

// 添加权限预览面板
{showPermissionPreview && (
  <PermissionPreviewPanel
    targetType="user"
    targetId={selectedUserId}
    onClose={() => setShowPermissionPreview(false)}
  />
)}
```

### 2. 在角色管理页面集成权限预览

在现有的角色管理页面（`/pages/system/roles/index.tsx`）中，为每个角色添加"查看权限"按钮：

```tsx
import { PermissionPreviewPanel } from '@/components/permission/PermissionPreviewPanel'

// 在角色列表中添加操作按钮
<button
  type="button"
  onClick={() => {
    setSelectedRoleId(role.id)
    setShowPermissionPreview(true)
  }}
>
  查看权限
</button>

// 添加权限预览面板
{showPermissionPreview && (
  <PermissionPreviewPanel
    targetType="role"
    targetId={selectedRoleId}
    onClose={() => setShowPermissionPreview(false)}
  />
)}
```

### 3. 在系统设置中添加新功能入口

在系统设置页面（`/pages/system/index.tsx`）中，添加新功能的入口：

```tsx
// 添加权限对比工具入口
<div className="flex items-center gap-3" onClick={() => navigateTo('/pages/system/permission-compare/index')}>
  <div className="i-mdi-compare text-3xl text-primary" />
  <div className="flex-1">
    <div className="text-xl font-medium">权限对比工具</div>
    <div className="text-base text-muted-foreground">对比用户或角色的权限差异</div>
  </div>
  <div className="i-mdi-chevron-right text-2xl text-muted-foreground" />
</div>

// 添加权限模板管理入口
<div className="flex items-center gap-3" onClick={() => navigateTo('/pages/system/permission-templates/index')}>
  <div className="i-mdi-file-document-multiple text-3xl text-primary" />
  <div className="flex-1">
    <div className="text-xl font-medium">权限模板管理</div>
    <div className="text-base text-muted-foreground">管理权限配置模板</div>
  </div>
  <div className="i-mdi-chevron-right text-2xl text-muted-foreground" />
</div>

// 添加权限关系图谱入口
<div className="flex items-center gap-3" onClick={() => navigateTo('/pages/system/permission-hierarchy/index')}>
  <div className="i-mdi-graph text-3xl text-primary" />
  <div className="flex-1">
    <div className="text-xl font-medium">权限关系图谱</div>
    <div className="text-base text-muted-foreground">可视化查看权限继承关系</div>
  </div>
  <div className="i-mdi-chevron-right text-2xl text-muted-foreground" />
</div>
```

### 4. 更新app.config.ts

在`src/app.config.ts`中添加新页面的路由配置：

```typescript
export default defineAppConfig({
  pages: [
    // ... 现有页面
    'pages/system/permission-compare/index',
    'pages/system/permission-templates/index',
    'pages/system/permission-templates/edit/index',
    'pages/system/permission-hierarchy/index'
  ],
  // ...
})
```

---

## 🧪 测试指南

### 功能测试

#### 1. 权限预览功能测试

- [ ] 查看用户权限预览，验证权限分类正确
- [ ] 查看角色权限预览，验证权限列表完整
- [ ] 测试权限类型筛选功能
- [ ] 验证权限来源标识（直接/继承）正确

#### 2. 权限对比功能测试

- [ ] 对比两个用户的权限，验证交集、差异、独有权限计算正确
- [ ] 对比两个角色的权限，验证结果准确
- [ ] 对比用户和角色的权限，验证跨类型对比正常
- [ ] 测试导出对比报告功能

#### 3. 权限模板功能测试

- [ ] 查看权限模板列表，验证系统预设模板存在
- [ ] 创建自定义权限模板，验证创建成功
- [ ] 编辑权限模板，验证更新成功且版本号递增
- [ ] 删除自定义模板，验证删除成功
- [ ] 尝试删除系统预设模板，验证被阻止
- [ ] 应用模板到角色，验证角色权限更新正确
- [ ] 查看模板版本历史，验证历史记录完整

#### 4. 权限继承关系可视化测试

- [ ] 查看指定用户的关系图谱，验证节点和边渲染正确
- [ ] 查看指定角色的关系图谱，验证关系完整
- [ ] 查看全局关系图谱，验证数据量限制生效
- [ ] 测试节点点击查看详情功能
- [ ] 测试图谱缩放、拖拽功能
- [ ] 测试搜索功能

### 性能测试

- [ ] 测试大数据量场景（100+用户，50+角色，200+权限）
- [ ] 测试权限预览加载速度（< 2秒）
- [ ] 测试权限对比计算速度（< 3秒）
- [ ] 测试图谱渲染性能（100+节点，200+边）

### 浏览器兼容性测试

- [ ] Chrome浏览器测试
- [ ] Safari浏览器测试
- [ ] Firefox浏览器测试
- [ ] 微信开发者工具测试
- [ ] 真机测试（iOS/Android）

---

## 📚 用户使用文档

### 权限预览功能

**使用场景**：快速查看用户或角色拥有的所有权限。

**操作步骤**：
1. 进入用户管理或角色管理页面
2. 找到目标用户或角色
3. 点击"查看权限"按钮
4. 在弹出的权限预览面板中查看权限详情
5. 可以按权限类型筛选（菜单访问/操作按钮/数据范围）
6. 查看权限来源（直接拥有/通过角色继承）

### 权限对比功能

**使用场景**：对比两个用户或角色的权限差异，用于权限审计或权限调整。

**操作步骤**：
1. 进入系统设置 → 权限对比工具
2. 选择对比对象1（用户或角色）
3. 选择对比对象2（用户或角色）
4. 点击"开始对比"按钮
5. 查看对比结果：
   - 交集权限：两者都拥有的权限
   - 仅对象1拥有：对象1独有的权限
   - 仅对象2拥有：对象2独有的权限
6. 点击"导出报告"按钮，下载对比报告

### 权限模板功能

**使用场景**：快速配置角色权限，避免重复配置。

**操作步骤**：

#### 使用系统预设模板
1. 进入系统设置 → 权限模板管理
2. 查看系统预设模板列表
3. 选择合适的模板，点击"应用"按钮
4. 选择目标角色
5. 确认应用，角色权限将被替换为模板权限

#### 创建自定义模板
1. 进入系统设置 → 权限模板管理
2. 点击"新建模板"按钮
3. 填写模板信息：
   - 模板代码（唯一标识）
   - 模板名称
   - 模板描述
   - 选择权限（勾选需要包含的权限）
4. 点击"保存"按钮，创建成功

#### 编辑模板
1. 在模板列表中找到目标模板
2. 点击"编辑"按钮
3. 修改模板信息或权限配置
4. 点击"保存"按钮，版本号自动递增

#### 删除模板
1. 在模板列表中找到目标模板
2. 点击"删除"按钮
3. 确认删除（系统预设模板不能删除）

### 权限继承关系可视化

**使用场景**：直观了解用户、角色、权限之间的复杂继承关系。

**操作步骤**：
1. 进入系统设置 → 权限关系图谱
2. 选择查看范围：
   - 指定用户：查看该用户的权限继承关系
   - 指定角色：查看该角色的权限分配情况
   - 全局视图：查看整个系统的权限关系
3. 在图谱中：
   - 蓝色节点：用户
   - 绿色节点：角色
   - 黄色节点：权限
   - 紫色节点：小组
4. 点击节点查看详细信息
5. 使用鼠标滚轮缩放图谱
6. 拖拽节点调整布局
7. 使用搜索框快速定位节点

---

## 🔧 故障排查

### 常见问题

#### 1. Edge Function调用失败

**问题**：调用Edge Function时返回错误。

**排查步骤**：
1. 检查网络连接
2. 确认Edge Function已部署
3. 查看浏览器控制台错误信息
4. 查看Edge Function日志：
   ```bash
   supabase functions logs get-user-permissions-preview
   ```

#### 2. 权限预览数据不完整

**问题**：权限预览面板显示的权限数量不正确。

**排查步骤**：
1. 检查用户是否关联了角色
2. 检查角色是否配置了权限
3. 查询数据库验证数据：
   ```sql
   SELECT * FROM get_user_all_permissions('user_id');
   ```

#### 3. 权限对比结果不准确

**问题**：权限对比的交集、差异计算不正确。

**排查步骤**：
1. 确认对比对象的ID正确
2. 检查对比对象的权限数据
3. 查询数据库验证：
   ```sql
   SELECT * FROM compare_permission_sets(
     ARRAY['perm_id_1', 'perm_id_2'],
     ARRAY['perm_id_3', 'perm_id_4']
   );
   ```

#### 4. 模板应用失败

**问题**：应用权限模板时报错。

**排查步骤**：
1. 检查模板是否存在
2. 检查目标角色是否存在
3. 检查是否有权限执行操作
4. 查看Edge Function日志

#### 5. 图谱渲染性能问题

**问题**：权限继承关系图谱加载缓慢或卡顿。

**解决方案**：
1. 限制查询范围（指定用户或角色）
2. 减少显示的节点数量
3. 优化图谱布局算法
4. 使用虚拟滚动技术

---

## 📝 开发注意事项

### 1. 数据库操作

- 所有权限相关的数据库操作必须使用service_role权限
- 使用数据库函数进行复杂查询，避免在应用层进行大量数据处理
- 注意RLS策略，确保数据安全

### 2. Edge Function开发

- 所有Edge Function必须处理CORS
- 使用try-catch捕获异常，返回友好的错误信息
- 记录详细的日志，便于问题排查
- 注意性能优化，避免N+1查询问题

### 3. 前端开发

- 使用TypeScript类型定义，确保类型安全
- 组件设计遵循单一职责原则
- 使用React Hooks管理状态
- 注意性能优化，避免不必要的重渲染
- 使用Tailwind CSS进行样式开发，保持风格一致

### 4. 测试

- 编写单元测试覆盖核心逻辑
- 进行集成测试验证API调用
- 进行端到端测试验证用户流程
- 性能测试确保大数据量场景下的响应速度

---

## 🚀 部署清单

### 数据库

- [x] 创建权限模板相关表
- [x] 创建数据库函数
- [x] 配置RLS策略
- [x] 插入预设权限模板数据

### Edge Functions

- [x] 部署get-user-permissions-preview
- [x] 部署get-role-permissions-preview
- [x] 部署compare-permissions
- [x] 部署permission-templates
- [x] 部署get-permission-hierarchy

### 前端

- [ ] 创建权限预览组件
- [ ] 创建权限对比页面
- [ ] 创建权限模板管理页面
- [ ] 创建权限继承关系可视化页面
- [ ] 集成到现有页面
- [ ] 更新路由配置
- [ ] 运行lint检查
- [ ] 构建生产版本

### 测试

- [ ] 功能测试
- [ ] 性能测试
- [ ] 浏览器兼容性测试
- [ ] 真机测试

### 文档

- [x] 技术文档
- [ ] 用户使用文档
- [ ] API文档
- [ ] 部署文档

---

## 📞 技术支持

如遇到问题，请参考以下资源：
1. 查看Edge Function日志
2. 查看数据库日志
3. 查看浏览器控制台错误信息
4. 参考本技术文档
5. 联系技术支持团队

---

**文档版本**：v1.0  
**最后更新**：2026-04-06  
**作者**：秒哒AI助手
