/**
 * 孤儿用户清理系统 - 测试脚本
 * 
 * 使用方法：
 * 1. 在浏览器控制台中打开Supabase项目
 * 2. 复制并粘贴此脚本
 * 3. 运行测试函数
 * 
 * 注意：需要先初始化supabase客户端
 */

// ========================================
// 测试1：列出孤儿用户
// ========================================
async function test1_listOrphanUsers() {
  console.log('========================================')
  console.log('测试1：列出孤儿用户')
  console.log('========================================')

  try {
    const {data, error} = await supabase.functions.invoke('cleanup-orphan-users', {
      body: {action: 'list'}
    })

    if (error) {
      console.error('❌ 测试失败:', error)
      return
    }

    console.log('✅ 测试成功')
    console.log('孤儿用户数量:', data.total_count)
    console.log('孤儿用户列表:', data.orphan_users)
  } catch (error) {
    console.error('❌ 测试异常:', error)
  }
}

// ========================================
// 测试2：数据一致性检查
// ========================================
async function test2_checkConsistency() {
  console.log('========================================')
  console.log('测试2：数据一致性检查')
  console.log('========================================')

  try {
    const {data, error} = await supabase.functions.invoke('check-data-consistency', {
      body: {
        action: 'check',
        operator_id: 'test-user-id',
        operator_name: '测试用户'
      }
    })

    if (error) {
      console.error('❌ 测试失败:', error)
      return
    }

    console.log('✅ 测试成功')
    console.log('孤儿Auth用户数量:', data.orphan_auth_count)
    console.log('孤儿Profile记录数量:', data.orphan_profile_count)
    console.log('孤儿Auth用户列表:', data.orphan_auth_users)
    console.log('孤儿Profile记录列表:', data.orphan_profiles)
  } catch (error) {
    console.error('❌ 测试异常:', error)
  }
}

// ========================================
// 测试3：查询清理日志
// ========================================
async function test3_queryCleanupLogs() {
  console.log('========================================')
  console.log('测试3：查询清理日志')
  console.log('========================================')

  try {
    const {data, error} = await supabase
      .from('cleanup_logs')
      .select('*')
      .order('cleaned_at', {ascending: false})
      .limit(10)

    if (error) {
      console.error('❌ 测试失败:', error)
      return
    }

    console.log('✅ 测试成功')
    console.log('最近10条清理日志:', data)
  } catch (error) {
    console.error('❌ 测试异常:', error)
  }
}

// ========================================
// 测试4：查询一致性检查日志
// ========================================
async function test4_queryConsistencyLogs() {
  console.log('========================================')
  console.log('测试4：查询一致性检查日志')
  console.log('========================================')

  try {
    const {data, error} = await supabase
      .from('consistency_check_logs')
      .select('*')
      .order('checked_at', {ascending: false})
      .limit(10)

    if (error) {
      console.error('❌ 测试失败:', error)
      return
    }

    console.log('✅ 测试成功')
    console.log('最近10条一致性检查日志:', data)
  } catch (error) {
    console.error('❌ 测试异常:', error)
  }
}

// ========================================
// 测试5：调用存储过程
// ========================================
async function test5_callStoredProcedure() {
  console.log('========================================')
  console.log('测试5：调用存储过程')
  console.log('========================================')

  try {
    // 测试get_orphan_auth_users
    const {data: orphanAuthUsers, error: error1} = await supabase.rpc('get_orphan_auth_users')

    if (error1) {
      console.error('❌ get_orphan_auth_users失败:', error1)
    } else {
      console.log('✅ get_orphan_auth_users成功')
      console.log('孤儿Auth用户:', orphanAuthUsers)
    }

    // 测试get_orphan_profiles
    const {data: orphanProfiles, error: error2} = await supabase.rpc('get_orphan_profiles')

    if (error2) {
      console.error('❌ get_orphan_profiles失败:', error2)
    } else {
      console.log('✅ get_orphan_profiles成功')
      console.log('孤儿Profile记录:', orphanProfiles)
    }

    // 测试auto_cleanup_orphan_users
    const {data: cleanupResult, error: error3} = await supabase.rpc('auto_cleanup_orphan_users')

    if (error3) {
      console.error('❌ auto_cleanup_orphan_users失败:', error3)
    } else {
      console.log('✅ auto_cleanup_orphan_users成功')
      console.log('清理结果:', cleanupResult)
    }
  } catch (error) {
    console.error('❌ 测试异常:', error)
  }
}

// ========================================
// 测试6：查询定时任务
// ========================================
async function test6_queryCronJob() {
  console.log('========================================')
  console.log('测试6：查询定时任务')
  console.log('========================================')

  try {
    // 注意：这个查询需要数据库管理员权限
    const {data, error} = await supabase.rpc('exec_sql', {
      query: "SELECT * FROM cron.job WHERE jobname = 'auto-cleanup-orphan-users'"
    })

    if (error) {
      console.error('❌ 测试失败:', error)
      console.log('提示：此查询需要数据库管理员权限，可以在Supabase Dashboard的SQL Editor中执行')
      return
    }

    console.log('✅ 测试成功')
    console.log('定时任务信息:', data)
  } catch (error) {
    console.error('❌ 测试异常:', error)
    console.log('提示：此查询需要数据库管理员权限，可以在Supabase Dashboard的SQL Editor中执行')
  }
}

// ========================================
// 运行所有测试
// ========================================
async function runAllTests() {
  console.log('========================================')
  console.log('开始运行所有测试')
  console.log('========================================')

  await test1_listOrphanUsers()
  await test2_checkConsistency()
  await test3_queryCleanupLogs()
  await test4_queryConsistencyLogs()
  await test5_callStoredProcedure()
  await test6_queryCronJob()

  console.log('========================================')
  console.log('所有测试完成')
  console.log('========================================')
}

// ========================================
// 使用说明
// ========================================
console.log('========================================')
console.log('孤儿用户清理系统 - 测试脚本')
console.log('========================================')
console.log('可用的测试函数：')
console.log('1. test1_listOrphanUsers() - 列出孤儿用户')
console.log('2. test2_checkConsistency() - 数据一致性检查')
console.log('3. test3_queryCleanupLogs() - 查询清理日志')
console.log('4. test4_queryConsistencyLogs() - 查询一致性检查日志')
console.log('5. test5_callStoredProcedure() - 调用存储过程')
console.log('6. test6_queryCronJob() - 查询定时任务')
console.log('7. runAllTests() - 运行所有测试')
console.log('========================================')
console.log('使用方法：')
console.log('1. 在浏览器控制台中运行：await test1_listOrphanUsers()')
console.log('2. 或运行所有测试：await runAllTests()')
console.log('========================================')
