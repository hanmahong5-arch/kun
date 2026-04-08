# 孤儿用户自动清理系统

## 📋 项目概述

本系统用于自动检测和清理"孤儿"用户（Auth用户创建成功但Profile创建失败的用户），防止手机号被占用无法重新添加的问题。

## ✨ 主要功能

### 1. 自动清理（已配置）

- ⏰ **执行时间**：每天凌晨2点（UTC时间）
- 🔍 **执行内容**：自动检测并记录孤儿用户
- 🚨 **告警阈值**：孤儿用户数量 > 2 时触发告警标志
- 🤖 **无需人工干预**：系统自动运行

### 2. 手动检查和修复

- 🔎 **立即检查**：管理员可以随时手动检查数据一致性
- 🛠️ **一键修复**：发现不一致数据后可以一键修复
- 📊 **详细报告**：显示孤儿Auth用户和孤儿Profile记录列表

### 3. 清理历史

- 📜 **历史记录**：查看所有清理操作的历史记录
- 🔍 **筛选功能**：按触发类型、状态筛选
- 📈 **统计分析**：查看清理趋势和统计数据

## 🚀 快速开始

### 管理员操作

#### 1. 手动检查数据一致性

```
1. 登录系统
2. 进入"系统设置" → "用户管理"
3. 在"数据一致性检查"模块中点击"立即检查"按钮
4. 查看检查结果
```

#### 2. 修复不一致数据

```
1. 执行数据一致性检查
2. 如果发现不一致数据，点击"一键修复"按钮
3. 确认修复操作（⚠️ 此操作不可恢复）
4. 查看修复结果
```

#### 3. 查看清理历史

```
1. 在用户管理页面点击"清理历史"按钮
2. 查看历史清理记录
3. 可以按触发类型、状态筛选
```

### 开发者操作

#### 浏览器控制台测试

```javascript
// 列出孤儿用户
const {data, error} = await supabase.functions.invoke('cleanup-orphan-users', {
  body: {action: 'list'}
})
console.log('孤儿用户列表:', data)

// 数据一致性检查
const {data, error} = await supabase.functions.invoke('check-data-consistency', {
  body: {action: 'check'}
})
console.log('检查结果:', data)
```

#### SQL查询

```sql
-- 查询孤儿用户
SELECT * FROM get_orphan_auth_users();

-- 查询清理日志
SELECT * FROM cleanup_logs ORDER BY cleaned_at DESC LIMIT 10;

-- 查询一致性检查日志
SELECT * FROM consistency_check_logs ORDER BY checked_at DESC LIMIT 10;
```

## 📁 项目结构

```
/workspace/app-aqrho2yuzfnl/
├── supabase/
│   ├── functions/
│   │   ├── cleanup-orphan-users/          # 清理孤儿用户Edge Function
│   │   └── check-data-consistency/        # 数据一致性检查Edge Function
│   └── migrations/
│       ├── create_cleanup_system_tables   # 创建清理系统表
│       └── create_pg_cron_cleanup_job_v2  # 创建定时任务
├── src/
│   └── pages/
│       └── system/
│           ├── cleanup-history/           # 清理历史页面
│           └── users/                     # 用户管理页面（已更新）
├── ORPHAN_USER_CLEANUP_SYSTEM.md          # 完整技术文档
├── ORPHAN_USER_CLEANUP_GUIDE.md           # 快速使用指南
├── ORPHAN_USER_CLEANUP_PROJECT_REPORT.md  # 项目完成报告
├── test-orphan-cleanup-system.js          # 测试脚本
└── VERIFY_ORPHAN_CLEANUP_SYSTEM.sql       # 验证脚本
```

## 📚 文档

### 用户文档

- **[快速使用指南](ORPHAN_USER_CLEANUP_GUIDE.md)** - 管理员和开发者的快速使用指南
- **[项目完成报告](ORPHAN_USER_CLEANUP_PROJECT_REPORT.md)** - 项目完成情况和交付清单

### 技术文档

- **[完整技术文档](ORPHAN_USER_CLEANUP_SYSTEM.md)** - 系统架构、数据库设计、API文档等
- **[测试脚本](test-orphan-cleanup-system.js)** - 浏览器控制台测试脚本
- **[验证脚本](VERIFY_ORPHAN_CLEANUP_SYSTEM.sql)** - SQL验证脚本

## 🔧 技术栈

### 数据库层

- PostgreSQL
- pg_cron（定时任务）
- RLS（行级安全策略）

### Edge Functions层

- Deno
- Supabase Edge Functions
- TypeScript

### 前端层

- Taro + React
- TypeScript
- Tailwind CSS

## 📊 系统架构

```
┌─────────────────────────────────────────────────────────────┐
│                        前端层                                │
│  ┌──────────────────┐  ┌──────────────────┐                │
│  │  用户管理页面     │  │  清理历史页面     │                │
│  │  - 数据一致性检查 │  │  - 清理日志列表   │                │
│  │  - 一键修复       │  │  - 筛选和刷新     │                │
│  └──────────────────┘  └──────────────────┘                │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                    Edge Functions层                          │
│  ┌──────────────────────┐  ┌──────────────────────┐        │
│  │ cleanup-orphan-users │  │ check-data-consistency│        │
│  │ - 列出孤儿用户        │  │ - 检查数据一致性      │        │
│  │ - 清理孤儿用户        │  │ - 修复不一致数据      │        │
│  │ - 记录清理日志        │  │ - 记录审计日志        │        │
│  └──────────────────────┘  └──────────────────────┘        │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                        数据库层                              │
│  ┌──────────────────┐  ┌──────────────────┐                │
│  │  cleanup_logs    │  │ consistency_check │                │
│  │  清理日志表       │  │ _logs             │                │
│  │                  │  │ 一致性检查日志表   │                │
│  └──────────────────┘  └──────────────────┘                │
│  ┌──────────────────────────────────────────┐              │
│  │  存储过程                                 │              │
│  │  - get_orphan_auth_users()               │              │
│  │  - get_orphan_profiles()                 │              │
│  │  - auto_cleanup_orphan_users()           │              │
│  └──────────────────────────────────────────┘              │
│  ┌──────────────────────────────────────────┐              │
│  │  定时任务（pg_cron）                      │              │
│  │  - 每天凌晨2点自动执行清理                │              │
│  └──────────────────────────────────────────┘              │
└─────────────────────────────────────────────────────────────┘
```

## 🔒 安全性

### 权限控制

- ✅ 仅系统管理员可访问清理历史页面
- ✅ 仅系统管理员可执行数据一致性检查
- ✅ 修复操作需要确认
- ✅ 所有操作有审计日志

### 数据保护

- ✅ 删除前显示将要删除的数据数量
- ✅ 所有清理操作记录到cleanup_logs表
- ✅ 所有一致性检查和修复操作记录到consistency_check_logs表
- ✅ 记录操作人信息

## 📈 监控和告警

### 告警触发条件

当孤儿用户数量超过2个时，系统会设置`should_alert=true`标志。

### 监控建议

- **每周检查一次**清理历史
- **关注告警标志**（should_alert=true的记录）
- **监控孤儿用户数量趋势**

## ❓ 常见问题

### Q1: 什么是"孤儿"用户？

**A:** 当添加用户时，系统会先在auth.users表创建Auth用户，然后在profiles表创建Profile记录。如果Auth用户创建成功但Profile创建失败，就会产生"孤儿"用户。

### Q2: 为什么会产生"孤儿"用户？

**A:** 可能的原因包括：网络中断、数据库约束冲突、权限问题、代码错误。

### Q3: 多久检查一次？

**A:** 
- **自动检查**：每天凌晨2点自动执行
- **手动检查**：管理员可以随时手动检查

### Q4: 修复操作安全吗？

**A:** 
- 修复操作会删除孤儿数据
- 删除前会显示将要删除的数据数量
- 需要用户确认后才执行
- 所有操作都有审计日志
- ⚠️ 删除操作不可恢复，请谨慎操作

## 🛠️ 故障排查

### 问题1：定时任务未执行

**排查步骤：**
1. 检查pg_cron扩展是否启用
2. 检查定时任务是否存在
3. 查看定时任务执行历史

### 问题2：清理失败

**排查步骤：**
1. 查看cleanup_logs表中的error_message字段
2. 检查Edge Function日志
3. 手动测试清理功能

### 问题3：数据一致性检查失败

**排查步骤：**
1. 查看consistency_check_logs表
2. 检查Edge Function日志
3. 手动测试检查功能

详细的故障排查指南请参考：[完整技术文档](ORPHAN_USER_CLEANUP_SYSTEM.md)

## 📝 更新日志

### v1.0.0 (2026-04-06)

- ✅ 实现定时自动清理孤儿用户系统
- ✅ 实现用户管理页面数据一致性检查功能
- ✅ 创建清理历史页面
- ✅ 完善文档和测试脚本

## 👥 贡献者

- 秒哒AI助手

## 📄 许可证

Copyright © 2026 施工企业市场经营管理小程序

## 🔗 相关链接

- [Supabase文档](https://supabase.com/docs)
- [pg_cron文档](https://github.com/citusdata/pg_cron)
- [Taro文档](https://taro-docs.jd.com/)

---

**项目状态**：✅ 已完成并部署，可以投入使用

**最后更新**：2026-04-06
