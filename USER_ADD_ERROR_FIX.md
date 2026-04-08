# 用户添加错误修复指南

## 问题描述

在添加用户时遇到以下错误：

1. **错误1**: "A user with this email address has already been registered"（该邮箱地址已被注册）
2. **错误2**: "duplicate key value violates unique constraint \"profiles_pkey\""（违反profiles表主键唯一约束）

## 问题原因

这是由于之前创建用户时，Auth用户创建成功但Profile创建失败，导致产生了"孤儿"Auth用户。

**什么是"孤儿"Auth用户？**
- 在`auth.users`表中存在
- 但在`profiles`表中不存在
- 导致后续无法使用相同手机号创建用户

## 解决方案

### 方案1：使用清理Edge Function（推荐）

我们已经创建了一个专门的Edge Function来清理"孤儿"用户。

#### 步骤1：在浏览器控制台执行清理

1. 打开浏览器开发者工具（F12）
2. 切换到Console标签
3. 复制并执行以下代码：

```javascript
// 先查看有哪些"孤儿"用户
const listResponse = await fetch('https://aqrho2yuzfnl.supabase.co/functions/v1/cleanup-orphan-users', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    action: 'list'
  })
});

const listData = await listResponse.json();
console.log('孤儿用户列表:', listData);

// 如果确认要清理，执行清理操作
const cleanupResponse = await fetch('https://aqrho2yuzfnl.supabase.co/functions/v1/cleanup-orphan-users', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    action: 'cleanup'
  })
});

const cleanupData = await cleanupResponse.json();
console.log('清理结果:', cleanupData);
```

#### 步骤2：重新添加用户

清理完成后，就可以正常添加用户了。

### 方案2：使用SQL清理（需要数据库权限）

如果你有数据库访问权限，可以使用SQL脚本清理。

参考文件：`CLEANUP_ORPHAN_USERS.sql`

### 方案3：更换手机号

如果暂时无法清理，可以使用其他手机号创建用户。

## 已修复的问题

我们已经优化了Edge Function，添加了以下改进：

### 1. 创建前检查

在创建Auth用户之前，先检查手机号是否已存在：

```typescript
const {data: existingProfile} = await supabaseAdmin
  .from('profiles')
  .select('id, phone, name')
  .eq('phone', phone)
  .maybeSingle()

if (existingProfile) {
  throw new Error(`该手机号已被使用，用户姓名：${existingProfile.name}`)
}
```

### 2. 更友好的错误提示

优化了错误信息，提供更清晰的提示：

- "该手机号已被注册，请检查用户列表或使用其他手机号"
- "该手机号已存在，无法重复创建"
- "该用户已存在，无法重复创建。如果之前创建失败，请联系技术人员清理数据"

### 3. 更完善的回滚机制

当Profile创建失败时，会自动清理已创建的Auth用户：

```typescript
if (profileError) {
  console.error('创建用户档案失败:', profileError)
  
  // 清理Auth用户
  try {
    console.log('正在清理Auth用户:', userId)
    const {error: deleteError} = await supabaseAdmin.auth.admin.deleteUser(userId)
    if (deleteError) {
      console.error('清理Auth用户失败:', deleteError)
    } else {
      console.log('Auth用户清理成功')
    }
  } catch (cleanupError) {
    console.error('清理过程出错:', cleanupError)
  }
  
  throw new Error(`创建用户档案失败: ${profileError.message}`)
}
```

## 预防措施

为了防止将来再次出现"孤儿"用户：

1. ✅ **已实现**：Edge Function添加了完善的错误处理和回滚机制
2. ✅ **已实现**：创建前检查用户是否已存在
3. ✅ **已实现**：提供友好的错误提示
4. ✅ **已创建**：清理"孤儿"用户的Edge Function
5. 📋 **建议**：定期运行清理脚本检查"孤儿"用户
6. 📋 **建议**：监控Edge Function日志，及时发现问题

## 当前系统中的"孤儿"用户

根据查询结果，当前系统中有3个"孤儿"用户：

| 用户ID | 手机号 | 邮箱 | 创建时间 |
|--------|--------|------|---------|
| 3fbc7283-c94b-4a58-9e55-7d8df79315c2 | 15376780339 | 15376780339@phone.com | 2026-04-06 02:39:07 |
| 33333333-3333-3333-3333-333333333333 | 15610496919 | 15610496919@phone.com | 2026-04-05 00:31:08 |
| 11111111-1111-1111-1111-111111111111 | 13869824089 | 13869824089@phone.com | 2026-04-05 00:00:48 |

**建议**：使用方案1清理这些"孤儿"用户。

## 测试验证

清理完成后，请按以下步骤验证：

### 1. 验证"孤儿"用户已清理

在浏览器控制台执行：

```javascript
const response = await fetch('https://aqrho2yuzfnl.supabase.co/functions/v1/cleanup-orphan-users', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    action: 'list'
  })
});

const data = await response.json();
console.log('剩余孤儿用户数量:', data.count);
```

如果返回`count: 0`，说明清理成功。

### 2. 测试添加用户

使用之前失败的手机号重新添加用户，应该可以成功创建。

### 3. 验证用户可以登录

使用新创建的用户登录系统，确认可以正常访问。

## 常见问题

### Q1: 清理"孤儿"用户会影响现有用户吗？

**答**：不会。清理操作只删除在`auth.users`中存在但在`profiles`中不存在的用户。正常用户同时存在于两个表中，不会被清理。

### Q2: 清理操作可以撤销吗？

**答**：不可以。清理操作会永久删除Auth用户记录。但由于这些用户本身就是"孤儿"用户（没有完整的用户信息），删除它们不会造成数据丢失。

### Q3: 如何避免将来再次出现"孤儿"用户？

**答**：我们已经优化了Edge Function的错误处理逻辑。当Profile创建失败时，会自动清理已创建的Auth用户。但在极端情况下（如网络中断、服务器崩溃），仍可能产生"孤儿"用户。建议定期运行清理脚本。

### Q4: 可以手动删除"孤儿"用户吗？

**答**：可以。如果你知道具体的用户ID，可以使用以下代码删除：

```javascript
const response = await fetch('https://aqrho2yuzfnl.supabase.co/functions/v1/cleanup-orphan-users', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    action: 'cleanup',
    user_ids: ['用户ID1', '用户ID2']  // 指定要删除的用户ID
  })
});

const data = await response.json();
console.log('清理结果:', data);
```

## 技术细节

### Edge Function文件

- **创建用户**: `/supabase/functions/create-user/index.ts`
- **清理孤儿用户**: `/supabase/functions/cleanup-orphan-users/index.ts`

### 数据库表

- **Auth用户**: `auth.users`（Supabase内置表）
- **用户档案**: `profiles`（自定义表）

### 关键逻辑

1. **用户创建流程**:
   ```
   创建Auth用户 → 创建Profile → 分配角色 → 分配小组
   ```

2. **错误回滚流程**:
   ```
   Profile创建失败 → 删除Auth用户 → 返回错误
   ```

3. **"孤儿"用户产生原因**:
   - Auth用户创建成功
   - Profile创建失败
   - 回滚逻辑未执行或执行失败

## 联系支持

如果遇到其他问题，请联系技术支持，并提供以下信息：

1. 错误截图
2. 尝试添加的手机号
3. 浏览器控制台的错误日志
4. Edge Function日志（如果可以访问）

---

**文档更新时间**: 2026-04-06
**版本**: v1.0
