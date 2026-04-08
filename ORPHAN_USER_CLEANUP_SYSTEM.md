# 孤儿用户自动清理系统 - 项目文档

## 项目概述

本项目实现了一个完整的孤儿用户自动检测、清理和监控系统，用于解决Auth用户创建成功但Profile创建失败导致的数据不一致问题。

## 系统架构

### 1. 数据库层

#### 1.1 cleanup_logs表
记录孤儿用户清理历史

**字段说明：**
- `id`: UUID主键
- `cleaned_at`: 清理时间
- `orphan_count`: 清理的孤儿用户数量
- `cleaned_user_ids`: 被清理的用户ID列表（数组）
- `trigger_type`: 触发类型（auto-自动定时任务，manual-手动触发）
- `status`: 执行状态（success-成功，failed-失败，partial-部分成功）
- `error_message`: 错误信息（如果有）
- `execution_time_ms`: 执行耗时（毫秒）
- `created_at`: 创建时间

**RLS策略：**
- 系统管理员可以查看所有清理日志

#### 1.2 consistency_check_logs表
记录数据一致性检查历史

**字段说明：**
- `id`: UUID主键
- `checked_at`: 检查时间
- `operator_id`: 操作人ID
- `operator_name`: 操作人姓名
- `orphan_auth_count`: 孤儿Auth用户数量
- `orphan_profile_count`: 孤儿Profile记录数量
- `orphan_auth_ids`: 孤儿Auth用户ID列表（数组）
- `orphan_profile_ids`: 孤儿Profile记录ID列表（数组）
- `fixed`: 是否已修复
- `fix_result`: 修复结果详情（JSON）
- `execution_time_ms`: 执行耗时（毫秒）
- `created_at`: 创建时间

**RLS策略：**
- 系统管理员可以查看所有一致性检查日志

#### 1.3 存储过程

**get_orphan_auth_users()**
- 功能：获取孤儿Auth用户列表（在auth.users中存在但在profiles中不存在）
- 返回：id, email, phone, created_at

**get_orphan_profiles()**
- 功能：获取孤儿Profile记录列表（在profiles中存在但在auth.users中不存在）
- 返回：id, phone, name, created_at

**auto_cleanup_orphan_users()**
- 功能：自动清理孤儿用户（由定时任务调用）
- 返回：JSON格式的清理结果
  - log_id: 清理日志ID
  - orphan_count: 孤儿用户数量
  - cleaned_user_ids: 清理的用户ID列表
  - execution_time_ms: 执行耗时
  - should_alert: 是否需要告警（孤儿用户数量>2）

### 2. 定时任务层

#### 2.1 pg_cron定时任务

**任务名称：** auto-cleanup-orphan-users

**执行时间：** 每天凌晨2点（UTC时间）

**Cron表达式：** `0 2 * * *`

**执行内容：**
```sql
SELECT auto_cleanup_orphan_users();
```

**功能说明：**
1. 自动检测孤儿用户
2. 记录检测结果到cleanup_logs表
3. 如果孤儿用户数量>2，设置should_alert标志

### 3. Edge Functions层

#### 3.1 cleanup-orphan-users

**路径：** `/supabase/functions/cleanup-orphan-users/index.ts`

**功能：**
- 查询孤儿Auth用户
- 删除孤儿Auth用户
- 记录清理日志
- 返回清理结果

**请求参数：**
```typescript
{
  action: 'list' | 'cleanup',  // 操作类型
  user_ids?: string[],         // 要清理的用户ID数组（可选）
  trigger_type?: 'auto' | 'manual'  // 触发类型（默认manual）
}
```

**返回结果：**
```typescript
{
  success: boolean,
  message: string,
  orphan_users: Array<{id, email, phone, created_at}>,
  cleaned_count: number,
  total_count: number,
  log_id: string,
  should_alert: boolean,
  execution_time_ms: number,
  errors?: Array<{user_id, error}>
}
```

#### 3.2 check-data-consistency

**路径：** `/supabase/functions/check-data-consistency/index.ts`

**功能：**
- 检查auth.users和profiles表的数据一致性
- 识别孤儿Auth用户和孤儿Profile记录
- 可选：自动修复不一致数据
- 记录检查和修复日志

**请求参数：**
```typescript
{
  action: 'check' | 'fix',  // 操作类型
  operator_id?: string,     // 操作人ID
  operator_name?: string    // 操作人姓名
}
```

**返回结果：**
```typescript
{
  success: boolean,
  orphan_auth_users: Array<{id, email, phone, created_at}>,
  orphan_profiles: Array<{id, phone, name, created_at}>,
  orphan_auth_count: number,
  orphan_profile_count: number,
  fixed?: boolean,
  fix_result?: {
    auth_cleaned: number,
    auth_errors: Array<{user_id, error}>,
    profile_cleaned: number,
    profile_errors: Array<{profile_id, error}>
  },
  log_id: string,
  execution_time_ms: number
}
```

### 4. 前端页面层

#### 4.1 清理历史页面

**路径：** `/src/pages/system/cleanup-history/index.tsx`

**功能：**
- 展示cleanup_logs表中的所有清理记录
- 显示清理时间、数量、触发类型、状态等信息
- 支持查看清理的用户ID列表
- 支持筛选（按触发类型、状态）
- 支持刷新

**访问权限：** 仅系统管理员

**页面路由：** `/pages/system/cleanup-history/index`

#### 4.2 用户管理页面 - 数据一致性检查模块

**路径：** `/src/pages/system/users/index.tsx`

**新增功能：**
1. **立即检查按钮**
   - 调用check-data-consistency Edge Function
   - 显示检查结果（孤儿Auth用户、孤儿Profile记录）
   - 展示不一致数据列表

2. **一键修复按钮**
   - 确认后调用check-data-consistency Edge Function（action=fix）
   - 显示修复进度
   - 显示修复结果摘要

3. **清理历史按钮**
   - 跳转到清理历史页面

**访问权限：** 仅系统管理员

## 工作流程

### 自动清理流程

```
每天凌晨2点（UTC）
    ↓
pg_cron定时任务触发
    ↓
调用auto_cleanup_orphan_users()存储过程
    ↓
检测孤儿用户
    ↓
记录到cleanup_logs表
    ↓
如果孤儿用户数量>2，设置should_alert=true
    ↓
（可选）发送告警通知
```

### 手动检查和修复流程

```
管理员访问用户管理页面
    ↓
点击"立即检查"按钮
    ↓
调用check-data-consistency Edge Function (action=check)
    ↓
显示检查结果
    ↓
如果有不一致数据，点击"一键修复"按钮
    ↓
确认修复操作
    ↓
调用check-data-consistency Edge Function (action=fix)
    ↓
显示修复结果
    ↓
刷新用户列表
```

## 监控和告警

### 告警触发条件

当孤儿用户数量超过2个时，系统会设置`should_alert=true`标志。

### 告警实现方式

1. **定时任务检测**
   - pg_cron每天凌晨2点执行检测
   - 如果检测到孤儿用户数量>2，记录到cleanup_logs表并设置should_alert=true

2. **手动检查告警**
   - 管理员执行数据一致性检查时
   - 如果发现不一致数据，在界面上显示告警信息

### 告警通知（待实现）

可以通过以下方式实现告警通知：
1. 邮件通知
2. 微信通知
3. 系统内消息通知
4. 钉钉/企业微信机器人通知

## 使用指南

### 管理员操作指南

#### 1. 查看清理历史

1. 登录系统
2. 进入"系统设置" → "用户管理"
3. 点击"清理历史"按钮
4. 查看历史清理记录
5. 可以按触发类型、状态筛选
6. 点击记录查看详细信息

#### 2. 手动检查数据一致性

1. 登录系统
2. 进入"系统设置" → "用户管理"
3. 在"数据一致性检查"模块中点击"立即检查"按钮
4. 等待检查完成
5. 查看检查结果：
   - 孤儿Auth用户数量
   - 孤儿Profile记录数量
   - 不一致数据列表

#### 3. 修复不一致数据

1. 执行数据一致性检查
2. 如果发现不一致数据，点击"一键修复"按钮
3. 确认修复操作（此操作不可恢复）
4. 等待修复完成
5. 查看修复结果摘要

### 开发者操作指南

#### 1. 手动触发清理（浏览器控制台）

```javascript
// 列出孤儿用户
const {data, error} = await supabase.functions.invoke('cleanup-orphan-users', {
  body: {action: 'list'}
})
console.log('孤儿用户列表:', data)

// 清理所有孤儿用户
const {data, error} = await supabase.functions.invoke('cleanup-orphan-users', {
  body: {
    action: 'cleanup',
    trigger_type: 'manual'
  }
})
console.log('清理结果:', data)

// 清理指定的孤儿用户
const {data, error} = await supabase.functions.invoke('cleanup-orphan-users', {
  body: {
    action: 'cleanup',
    user_ids: ['user-id-1', 'user-id-2'],
    trigger_type: 'manual'
  }
})
console.log('清理结果:', data)
```

#### 2. 查询清理日志（SQL）

```sql
-- 查询最近10条清理日志
SELECT * FROM cleanup_logs
ORDER BY cleaned_at DESC
LIMIT 10;

-- 查询需要告警的清理记录
SELECT * FROM cleanup_logs
WHERE orphan_count > 2
ORDER BY cleaned_at DESC;

-- 查询自动清理记录
SELECT * FROM cleanup_logs
WHERE trigger_type = 'auto'
ORDER BY cleaned_at DESC;

-- 查询失败的清理记录
SELECT * FROM cleanup_logs
WHERE status IN ('failed', 'partial')
ORDER BY cleaned_at DESC;
```

#### 3. 查询一致性检查日志（SQL）

```sql
-- 查询最近10条一致性检查日志
SELECT * FROM consistency_check_logs
ORDER BY checked_at DESC
LIMIT 10;

-- 查询已修复的记录
SELECT * FROM consistency_check_logs
WHERE fixed = true
ORDER BY checked_at DESC;

-- 查询特定操作人的检查记录
SELECT * FROM consistency_check_logs
WHERE operator_name = '张三'
ORDER BY checked_at DESC;
```

#### 4. 手动调用存储过程（SQL）

```sql
-- 获取孤儿Auth用户列表
SELECT * FROM get_orphan_auth_users();

-- 获取孤儿Profile记录列表
SELECT * FROM get_orphan_profiles();

-- 执行自动清理
SELECT auto_cleanup_orphan_users();
```

## 维护和监控

### 日常维护

1. **定期检查清理日志**
   - 每周查看一次清理历史
   - 关注是否有频繁出现的孤儿用户
   - 如果孤儿用户数量持续增加，需要排查用户创建流程

2. **监控告警**
   - 关注should_alert=true的记录
   - 及时处理异常情况

3. **性能监控**
   - 关注execution_time_ms字段
   - 如果执行时间过长，考虑优化查询或增加索引

### 故障排查

#### 问题1：定时任务未执行

**排查步骤：**
1. 检查pg_cron扩展是否启用
   ```sql
   SELECT * FROM pg_extension WHERE extname = 'pg_cron';
   ```

2. 检查定时任务是否存在
   ```sql
   SELECT * FROM cron.job WHERE jobname = 'auto-cleanup-orphan-users';
   ```

3. 查看定时任务执行历史
   ```sql
   SELECT * FROM cron.job_run_details
   WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'auto-cleanup-orphan-users')
   ORDER BY start_time DESC
   LIMIT 10;
   ```

#### 问题2：清理失败

**排查步骤：**
1. 查看cleanup_logs表中的error_message字段
   ```sql
   SELECT * FROM cleanup_logs
   WHERE status IN ('failed', 'partial')
   ORDER BY cleaned_at DESC;
   ```

2. 检查Edge Function日志
   - 在Supabase Dashboard中查看Edge Function日志
   - 搜索关键词：cleanup-orphan-users

3. 手动测试清理功能
   ```javascript
   const {data, error} = await supabase.functions.invoke('cleanup-orphan-users', {
     body: {action: 'list'}
   })
   console.log('测试结果:', data, error)
   ```

#### 问题3：数据一致性检查失败

**排查步骤：**
1. 查看consistency_check_logs表
   ```sql
   SELECT * FROM consistency_check_logs
   ORDER BY checked_at DESC
   LIMIT 10;
   ```

2. 检查Edge Function日志
   - 在Supabase Dashboard中查看Edge Function日志
   - 搜索关键词：check-data-consistency

3. 手动测试检查功能
   ```javascript
   const {data, error} = await supabase.functions.invoke('check-data-consistency', {
     body: {action: 'check'}
   })
   console.log('测试结果:', data, error)
   ```

## 安全考虑

### 权限控制

1. **数据库层**
   - cleanup_logs和consistency_check_logs表启用RLS
   - 仅系统管理员可以查看日志

2. **Edge Functions层**
   - 使用SUPABASE_SERVICE_ROLE_KEY进行认证
   - 仅授权用户可以调用

3. **前端层**
   - 清理历史页面仅系统管理员可访问
   - 数据一致性检查模块仅系统管理员可见

### 数据保护

1. **删除确认**
   - 一键修复前需要用户确认
   - 显示将要删除的数据数量

2. **审计日志**
   - 所有清理操作记录到cleanup_logs表
   - 所有一致性检查和修复操作记录到consistency_check_logs表
   - 记录操作人信息

3. **错误处理**
   - 清理失败时记录详细错误信息
   - 部分成功时标记为partial状态

## 性能优化

### 数据库优化

1. **索引**
   - cleanup_logs表：cleaned_at, trigger_type, status
   - consistency_check_logs表：checked_at, operator_id, fixed

2. **查询优化**
   - 使用LEFT JOIN查询孤儿用户
   - 限制查询结果数量（LIMIT）

3. **定时任务优化**
   - 选择低峰时段执行（凌晨2点）
   - 避免与其他定时任务冲突

### Edge Functions优化

1. **批量处理**
   - 使用循环批量删除用户
   - 避免一次性加载大量数据

2. **错误处理**
   - 单个用户删除失败不影响其他用户
   - 记录详细的错误信息

3. **超时控制**
   - 设置合理的超时时间
   - 避免长时间阻塞

## 未来改进

### 功能增强

1. **告警通知**
   - 实现邮件/微信/钉钉告警
   - 支持自定义告警阈值
   - 支持告警规则配置

2. **数据分析**
   - 统计孤儿用户产生的原因
   - 分析清理趋势
   - 生成清理报表

3. **自动修复**
   - 定时任务自动修复孤儿用户
   - 支持配置自动修复策略

### 性能优化

1. **批量清理**
   - 支持批量删除Auth用户
   - 减少API调用次数

2. **增量检测**
   - 仅检测最近创建的用户
   - 减少全表扫描

3. **缓存优化**
   - 缓存孤儿用户列表
   - 减少数据库查询

## 总结

本系统实现了完整的孤儿用户自动检测、清理和监控功能，包括：

1. **自动化清理**：通过pg_cron定时任务每天自动检测和清理孤儿用户
2. **手动检查**：管理员可以随时手动检查数据一致性
3. **一键修复**：发现不一致数据后可以一键修复
4. **历史追溯**：完整的清理历史记录和审计日志
5. **告警机制**：孤儿用户数量超过阈值时触发告警

系统设计遵循以下原则：
- **安全性**：严格的权限控制和数据保护
- **可靠性**：完善的错误处理和日志记录
- **可维护性**：清晰的代码结构和详细的文档
- **可扩展性**：模块化设计，易于扩展新功能

通过本系统，可以有效解决用户创建过程中的数据不一致问题，保证系统数据的完整性和一致性。
