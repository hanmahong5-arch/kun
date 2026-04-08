// ========================================
// 用户创建流程优化 - 测试脚本
// ========================================
//
// 使用方法：
// 1. 打开浏览器控制台
// 2. 复制并粘贴此脚本
// 3. 运行测试函数
//
// ========================================

// 测试1：正常创建用户
async function test1_createUserNormal() {
  console.log('========== 测试1：正常创建用户 ==========')
  
  const testPhone = `1${Math.floor(Math.random() * 9000000000 + 1000000000)}`
  
  const {data, error} = await supabase.functions.invoke('create-user', {
    body: {
      phone: testPhone,
      name: '测试用户',
      role_ids: ['role_id_here'],  // 替换为实际的角色ID
      password: '123456',
      job_level: '一级职员',
      department: '经营中心',
      team_ids: []
    }
  })
  
  if (error) {
    console.error('❌ 创建用户失败:', error)
    return
  }
  
  console.log('✅ 创建用户成功:', data)
  console.log('用户ID:', data.user_id)
  console.log('执行耗时:', data.execution_time_ms, 'ms')
  
  // 查询日志
  const {data: logs} = await supabase
    .from('user_creation_logs')
    .select('*')
    .eq('user_id', data.user_id)
    .single()
  
  console.log('日志记录:', logs)
  console.log('已完成步骤:', logs.completed_steps)
}

// 测试2：创建用户（使用随机密码）
async function test2_createUserWithRandomPassword() {
  console.log('========== 测试2：创建用户（使用随机密码） ==========')
  
  const testPhone = `1${Math.floor(Math.random() * 9000000000 + 1000000000)}`
  
  const {data, error} = await supabase.functions.invoke('create-user', {
    body: {
      phone: testPhone,
      name: '测试用户（随机密码）',
      role_ids: ['role_id_here'],  // 替换为实际的角色ID
      use_random_password: true,
      job_level: '二级职员',
      department: '经营中心'
    }
  })
  
  if (error) {
    console.error('❌ 创建用户失败:', error)
    return
  }
  
  console.log('✅ 创建用户成功:', data)
  console.log('用户ID:', data.user_id)
  console.log('随机密码:', data.password)
  console.log('执行耗时:', data.execution_time_ms, 'ms')
  
  // 查询日志
  const {data: logs} = await supabase
    .from('user_creation_logs')
    .select('*')
    .eq('user_id', data.user_id)
    .single()
  
  console.log('日志记录:', logs)
  console.log('密码类型:', logs.password_type)
}

// 测试3：创建用户（重复手机号，应该失败）
async function test3_createUserDuplicatePhone() {
  console.log('========== 测试3：创建用户（重复手机号） ==========')
  
  // 使用一个已存在的手机号
  const existingPhone = '13800138000'  // 替换为实际存在的手机号
  
  const {data, error} = await supabase.functions.invoke('create-user', {
    body: {
      phone: existingPhone,
      name: '测试用户（重复）',
      role_ids: ['role_id_here'],  // 替换为实际的角色ID
      password: '123456'
    }
  })
  
  if (error) {
    console.log('✅ 预期的错误:', error)
    
    // 查询日志
    const {data: logs} = await supabase
      .from('user_creation_logs')
      .select('*')
      .eq('phone', existingPhone)
      .order('created_at', {ascending: false})
      .limit(1)
      .single()
    
    console.log('日志记录:', logs)
    console.log('失败步骤:', logs.failed_step)
    console.log('错误信息:', logs.error_message)
    return
  }
  
  console.error('❌ 应该失败但成功了:', data)
}

// 测试4：创建用户（无效的角色ID，应该失败并回滚）
async function test4_createUserInvalidRole() {
  console.log('========== 测试4：创建用户（无效的角色ID） ==========')
  
  const testPhone = `1${Math.floor(Math.random() * 9000000000 + 1000000000)}`
  
  const {data, error} = await supabase.functions.invoke('create-user', {
    body: {
      phone: testPhone,
      name: '测试用户（无效角色）',
      role_ids: ['invalid-role-id'],  // 无效的角色ID
      password: '123456'
    }
  })
  
  if (error) {
    console.log('✅ 预期的错误:', error)
    
    // 查询日志
    const {data: logs} = await supabase
      .from('user_creation_logs')
      .select('*')
      .eq('phone', testPhone)
      .single()
    
    console.log('日志记录:', logs)
    console.log('失败步骤:', logs.failed_step)
    console.log('错误信息:', logs.error_message)
    console.log('是否尝试回滚:', logs.rollback_attempted)
    console.log('回滚是否成功:', logs.rollback_success)
    console.log('回滚详情:', logs.rollback_details)
    
    // 验证Auth用户是否被回滚
    console.log('验证：检查Auth用户是否被删除...')
    // 注意：这里无法直接查询auth.users表，需要在Supabase Dashboard中手动验证
    
    return
  }
  
  console.error('❌ 应该失败但成功了:', data)
}

// 测试5：查询用户创建日志
async function test5_queryCreationLogs() {
  console.log('========== 测试5：查询用户创建日志 ==========')
  
  // 查询最近10条日志
  const {data: logs, error} = await supabase
    .from('user_creation_logs')
    .select('*')
    .order('created_at', {ascending: false})
    .limit(10)
  
  if (error) {
    console.error('❌ 查询日志失败:', error)
    return
  }
  
  console.log(`✅ 查询到 ${logs.length} 条日志:`)
  
  logs.forEach((log, index) => {
    console.log(`\n--- 日志 ${index + 1} ---`)
    console.log('成功:', log.success ? '✅' : '❌')
    console.log('手机号:', log.phone)
    console.log('姓名:', log.name)
    console.log('密码类型:', log.password_type)
    console.log('执行耗时:', log.execution_time_ms, 'ms')
    
    if (!log.success) {
      console.log('失败步骤:', log.failed_step)
      console.log('错误信息:', log.error_message)
      console.log('是否尝试回滚:', log.rollback_attempted)
      console.log('回滚是否成功:', log.rollback_success)
    }
    
    console.log('已完成步骤:', log.completed_steps)
  })
}

// 测试6：统计用户创建成功率
async function test6_calculateSuccessRate() {
  console.log('========== 测试6：统计用户创建成功率 ==========')
  
  // 查询所有日志
  const {data: logs, error} = await supabase
    .from('user_creation_logs')
    .select('success')
  
  if (error) {
    console.error('❌ 查询日志失败:', error)
    return
  }
  
  const total = logs.length
  const success = logs.filter(log => log.success).length
  const failed = total - success
  const successRate = (success / total * 100).toFixed(2)
  
  console.log('✅ 统计结果:')
  console.log('总数:', total)
  console.log('成功:', success)
  console.log('失败:', failed)
  console.log('成功率:', successRate + '%')
}

// 测试7：分析失败原因
async function test7_analyzeFailureReasons() {
  console.log('========== 测试7：分析失败原因 ==========')
  
  // 查询所有失败日志
  const {data: logs, error} = await supabase
    .from('user_creation_logs')
    .select('failed_step, error_message')
    .eq('success', false)
  
  if (error) {
    console.error('❌ 查询日志失败:', error)
    return
  }
  
  if (logs.length === 0) {
    console.log('✅ 没有失败记录')
    return
  }
  
  // 统计失败原因
  const reasons = {}
  logs.forEach(log => {
    const key = `${log.failed_step}: ${log.error_message}`
    reasons[key] = (reasons[key] || 0) + 1
  })
  
  console.log('✅ 失败原因分布:')
  Object.entries(reasons)
    .sort((a, b) => b[1] - a[1])
    .forEach(([reason, count]) => {
      console.log(`${count}次 - ${reason}`)
    })
}

// 测试8：分析回滚情况
async function test8_analyzeRollbackStatus() {
  console.log('========== 测试8：分析回滚情况 ==========')
  
  // 查询所有失败日志
  const {data: logs, error} = await supabase
    .from('user_creation_logs')
    .select('rollback_attempted, rollback_success')
    .eq('success', false)
  
  if (error) {
    console.error('❌ 查询日志失败:', error)
    return
  }
  
  if (logs.length === 0) {
    console.log('✅ 没有失败记录')
    return
  }
  
  const attempted = logs.filter(log => log.rollback_attempted).length
  const success = logs.filter(log => log.rollback_success).length
  const failed = attempted - success
  const successRate = attempted > 0 ? (success / attempted * 100).toFixed(2) : 0
  
  console.log('✅ 回滚统计:')
  console.log('尝试回滚:', attempted)
  console.log('回滚成功:', success)
  console.log('回滚失败:', failed)
  console.log('回滚成功率:', successRate + '%')
}

// 测试9：分析执行耗时
async function test9_analyzeExecutionTime() {
  console.log('========== 测试9：分析执行耗时 ==========')
  
  // 查询所有日志
  const {data: logs, error} = await supabase
    .from('user_creation_logs')
    .select('success, execution_time_ms')
  
  if (error) {
    console.error('❌ 查询日志失败:', error)
    return
  }
  
  const successLogs = logs.filter(log => log.success)
  const failedLogs = logs.filter(log => !log.success)
  
  const calculateStats = (logs) => {
    if (logs.length === 0) return null
    
    const times = logs.map(log => log.execution_time_ms)
    const sum = times.reduce((a, b) => a + b, 0)
    const avg = sum / times.length
    const min = Math.min(...times)
    const max = Math.max(...times)
    
    return {avg, min, max}
  }
  
  console.log('✅ 执行耗时统计:')
  
  const successStats = calculateStats(successLogs)
  if (successStats) {
    console.log('\n成功记录:')
    console.log('平均耗时:', successStats.avg.toFixed(2), 'ms')
    console.log('最短耗时:', successStats.min, 'ms')
    console.log('最长耗时:', successStats.max, 'ms')
  }
  
  const failedStats = calculateStats(failedLogs)
  if (failedStats) {
    console.log('\n失败记录:')
    console.log('平均耗时:', failedStats.avg.toFixed(2), 'ms')
    console.log('最短耗时:', failedStats.min, 'ms')
    console.log('最长耗时:', failedStats.max, 'ms')
  }
}

// 运行所有测试
async function runAllTests() {
  console.log('========================================')
  console.log('开始运行所有测试')
  console.log('========================================\n')
  
  // 注意：测试1-4会创建/尝试创建用户，请谨慎运行
  // await test1_createUserNormal()
  // await test2_createUserWithRandomPassword()
  // await test3_createUserDuplicatePhone()
  // await test4_createUserInvalidRole()
  
  // 查询和分析测试（安全）
  await test5_queryCreationLogs()
  await test6_calculateSuccessRate()
  await test7_analyzeFailureReasons()
  await test8_analyzeRollbackStatus()
  await test9_analyzeExecutionTime()
  
  console.log('\n========================================')
  console.log('所有测试完成')
  console.log('========================================')
}

// 导出测试函数
console.log('用户创建流程优化测试脚本已加载')
console.log('可用的测试函数:')
console.log('- test1_createUserNormal() - 正常创建用户')
console.log('- test2_createUserWithRandomPassword() - 创建用户（使用随机密码）')
console.log('- test3_createUserDuplicatePhone() - 创建用户（重复手机号）')
console.log('- test4_createUserInvalidRole() - 创建用户（无效角色ID）')
console.log('- test5_queryCreationLogs() - 查询用户创建日志')
console.log('- test6_calculateSuccessRate() - 统计用户创建成功率')
console.log('- test7_analyzeFailureReasons() - 分析失败原因')
console.log('- test8_analyzeRollbackStatus() - 分析回滚情况')
console.log('- test9_analyzeExecutionTime() - 分析执行耗时')
console.log('- runAllTests() - 运行所有测试（仅查询和分析）')
