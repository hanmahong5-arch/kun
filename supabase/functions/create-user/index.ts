import {createClient} from 'jsr:@supabase/supabase-js@2'

/**
 * CORS配置
 * 允许跨域请求访问此Edge Function
 */
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
}

/**
 * 生成随机密码
 * @param length 密码长度，默认8位
 * @returns 随机密码字符串
 */
function generateRandomPassword(length = 8): string {
  const chars = 'ABCDEFGHJKMNPQRSTWXYZabcdefhijkmnprstwxyz2345678'
  let password = ''
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return password
}

/**
 * 回滚Auth用户
 * 当Profile创建失败时，删除已创建的Auth用户
 * 
 * @param supabaseAdmin Supabase管理员客户端
 * @param userId 用户ID
 * @param reason 回滚原因
 */
async function rollbackAuthUser(supabaseAdmin: any, userId: string, reason: string): Promise<void> {
  console.log(`开始回滚Auth用户 [用户ID: ${userId}] [原因: ${reason}]`)
  
  try {
    const {error: deleteError} = await supabaseAdmin.auth.admin.deleteUser(userId)
    
    if (deleteError) {
      console.error('回滚Auth用户失败:', deleteError)
      throw new Error(`回滚失败: ${deleteError.message}`)
    }
    
    console.log('Auth用户回滚成功')
  } catch (error) {
    console.error('回滚过程出错:', error)
    throw error
  }
}

/**
 * 回滚Profile和Auth用户
 * 当角色关联创建失败时，删除已创建的Profile和Auth用户
 * 
 * @param supabaseAdmin Supabase管理员客户端
 * @param userId 用户ID
 * @param reason 回滚原因
 */
async function rollbackProfileAndAuthUser(supabaseAdmin: any, userId: string, reason: string): Promise<void> {
  console.log(`开始回滚Profile和Auth用户 [用户ID: ${userId}] [原因: ${reason}]`)
  
  let profileDeleted = false
  let authDeleted = false
  
  try {
    // 步骤1：删除Profile
    const {error: profileDeleteError} = await supabaseAdmin
      .from('profiles')
      .delete()
      .eq('id', userId)
    
    if (profileDeleteError) {
      console.error('删除Profile失败:', profileDeleteError)
    } else {
      console.log('Profile删除成功')
      profileDeleted = true
    }
    
    // 步骤2：删除Auth用户
    const {error: authDeleteError} = await supabaseAdmin.auth.admin.deleteUser(userId)
    
    if (authDeleteError) {
      console.error('删除Auth用户失败:', authDeleteError)
    } else {
      console.log('Auth用户删除成功')
      authDeleted = true
    }
    
    // 检查回滚结果
    if (!profileDeleted || !authDeleted) {
      console.error(`回滚不完整 [Profile: ${profileDeleted ? '已删除' : '删除失败'}] [Auth: ${authDeleted ? '已删除' : '删除失败'}]`)
      throw new Error('回滚不完整，请联系技术人员手动清理数据')
    }
    
    console.log('Profile和Auth用户回滚成功')
  } catch (error) {
    console.error('回滚过程出错:', error)
    throw error
  }
}

/**
 * 创建新用户Edge Function
 * 
 * 功能说明：
 * 1. 系统管理员创建新用户账号
 * 2. 用户创建后状态为"已激活"（approved），可立即登录
 * 3. 支持固定密码或随机密码
 * 4. 支持多角色分配
 * 5. 支持小组分配
 * 6. 完善的事务处理和回滚机制
 * 7. 详细的日志记录
 * 
 * 请求参数：
 * - phone: 手机号（必填，11位数字）
 * - name: 姓名（必填）
 * - role_ids: 角色ID数组（必填，至少一个）
 * - password: 初始密码（可选，不传则使用默认密码123456）
 * - use_random_password: 是否使用随机密码（可选，默认false）
 * - job_level: 职级（可选）
 * - department: 部门（可选）
 * - team_ids: 小组ID数组（可选）
 * 
 * 返回结果：
 * - success: 是否成功
 * - message: 提示信息
 * - user_id: 用户ID
 * - password: 初始密码（仅当use_random_password=true时返回）
 * - log_id: 日志ID
 */
Deno.serve(async (req) => {
  const startTime = Date.now()
  
  // 处理OPTIONS预检请求
  if (req.method === 'OPTIONS') {
    return new Response('ok', {headers: corsHeaders})
  }

  // 用于记录日志的变量
  let logData: any = {
    success: false,
    completed_steps: [],
    rollback_attempted: false
  }

  try {
    // 创建Supabase管理员客户端（拥有service_role权限）
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 解析请求参数
    const {
      phone,
      name,
      role_ids,
      password: customPassword,
      use_random_password = false,
      job_level,
      department,
      team_ids
    } = await req.json()

    // 记录基本信息到日志
    logData.phone = phone
    logData.name = name
    logData.role_ids = role_ids
    logData.job_level = job_level
    logData.department = department
    logData.team_ids = team_ids || []

    // ========== 参数验证 ==========
    
    // 验证必填字段
    if (!phone || !name) {
      throw new Error('缺少必填字段：手机号和姓名为必填项')
    }

    // 验证角色
    if (!role_ids || !Array.isArray(role_ids) || role_ids.length === 0) {
      throw new Error('请至少选择一个角色')
    }

    // 验证手机号格式（中国大陆手机号：1开头的11位数字）
    if (!/^1\d{10}$/.test(phone)) {
      throw new Error('手机号格式不正确，请输入11位手机号')
    }

    // ========== 检查用户是否已存在 ==========
    
    /**
     * 在创建用户之前，先检查该手机号是否已被使用
     * 这样可以提供更友好的错误提示
     */
    const {data: existingProfile, error: checkError} = await supabaseAdmin
      .from('profiles')
      .select('id, phone, name')
      .eq('phone', phone)
      .maybeSingle()

    if (checkError) {
      console.error('检查用户是否存在时出错:', checkError)
      // 不抛出错误，继续执行（可能是权限问题）
    }

    if (existingProfile) {
      throw new Error(`该手机号已被使用，用户姓名：${existingProfile.name}`)
    }

    // ========== 密码处理 ==========
    
    // 确定初始密码
    let initialPassword: string
    let passwordType: string
    
    if (use_random_password) {
      // 使用随机密码（8位，包含大小写字母和数字）
      initialPassword = generateRandomPassword(8)
      passwordType = 'random'
    } else if (customPassword) {
      // 使用自定义密码
      if (customPassword.length < 6) {
        throw new Error('密码长度不能少于6位')
      }
      initialPassword = customPassword
      passwordType = 'custom'
    } else {
      // 使用默认密码
      initialPassword = '123456'
      passwordType = 'default'
    }

    logData.password_type = passwordType

    // 构造邮箱（用于Supabase Auth）
    const email = `${phone}@phone.com`

    // ========== 步骤1：创建Supabase Auth用户 ==========
    
    logData.completed_steps.push('开始创建Auth用户')
    
    /**
     * 使用Supabase Admin API创建认证用户
     * 
     * 关键配置：
     * - email_confirm: true - 邮箱已确认（跳过邮箱验证）
     * - phone_confirm: true - 手机号已确认（跳过手机验证）
     * - user_metadata: 存储额外的用户元数据
     * 
     * 这样创建的用户可以立即登录，无需任何验证步骤
     */
    const {data: authData, error: authError} = await supabaseAdmin.auth.admin.createUser({
      email,
      password: initialPassword,
      phone,
      email_confirm: true,  // 关键：设置为true，用户无需邮箱验证
      phone_confirm: true,  // 关键：设置为true，用户无需手机验证
      user_metadata: {
        phone,
        created_by: 'system_admin',
        created_at: new Date().toISOString()
      }
    })

    // 检查Auth用户创建结果
    if (authError) {
      logData.failed_step = '创建Auth用户'
      logData.error_message = authError.message
      
      // 处理常见错误，提供友好的错误提示
      if (authError.message.includes('already registered') || authError.message.includes('already been registered')) {
        throw new Error('该手机号已被注册，请检查用户列表或使用其他手机号')
      }
      if (authError.message.includes('duplicate')) {
        throw new Error('该手机号已存在，无法重复创建')
      }
      throw new Error(`创建认证用户失败: ${authError.message}`)
    }

    if (!authData.user) {
      logData.failed_step = '创建Auth用户'
      logData.error_message = '未返回用户数据'
      throw new Error('创建用户失败：未返回用户数据')
    }

    const userId = authData.user.id
    logData.user_id = userId
    logData.completed_steps.push('Auth用户创建成功')
    console.log('Auth用户创建成功，用户ID:', userId)

    // ========== 步骤2：获取角色信息 ==========
    
    logData.completed_steps.push('开始获取角色信息')
    
    /**
     * 查询第一个角色的code
     * 用于设置profiles表的role字段（兼容旧系统）
     */
    const {data: firstRole, error: roleError} = await supabaseAdmin
      .from('roles')
      .select('code')
      .eq('id', role_ids[0])
      .single()

    if (roleError || !firstRole) {
      logData.failed_step = '获取角色信息'
      logData.error_message = roleError?.message || '角色不存在'
      
      // 如果角色不存在，需要清理已创建的Auth用户
      console.log('角色不存在，开始回滚Auth用户:', userId)
      logData.rollback_attempted = true
      
      try {
        await rollbackAuthUser(supabaseAdmin, userId, '选择的角色不存在')
        logData.rollback_success = true
        logData.rollback_details = 'Auth用户回滚成功'
      } catch (rollbackError: any) {
        logData.rollback_success = false
        logData.rollback_details = `Auth用户回滚失败: ${rollbackError.message}`
      }
      
      throw new Error('选择的角色不存在，请重新选择')
    }

    logData.completed_steps.push('角色信息获取成功')

    // ========== 步骤3：创建用户档案（profiles表） ==========
    
    logData.completed_steps.push('开始创建Profile')
    
    /**
     * 在profiles表中创建用户档案
     * 
     * 关键字段：
     * - status: 'approved' - 用户状态为"已激活"，可立即登录
     * - approved_at: 当前时间 - 记录激活时间
     * - role: 第一个角色的code - 兼容旧系统
     * 
     * 这是实现"用户创建后立即可用"的核心配置
     */
    const {error: profileError} = await supabaseAdmin.from('profiles').insert({
      id: userId,
      phone,
      name,
      role: firstRole.code,  // 兼容旧系统：使用第一个角色的code
      job_level: job_level || null,
      department: department || null,
      status: 'approved',  // 关键：状态设为approved，用户可立即登录
      approved_at: new Date().toISOString(),  // 记录激活时间
      approved_by: null  // 系统自动激活，无需审核人
    })

    if (profileError) {
      console.error('创建用户档案失败:', profileError)
      logData.failed_step = '创建Profile'
      logData.error_message = profileError.message
      
      // 如果创建档案失败，必须清理已创建的Auth用户，避免产生"孤儿"用户
      logData.rollback_attempted = true
      
      try {
        await rollbackAuthUser(supabaseAdmin, userId, `创建用户档案失败: ${profileError.message}`)
        logData.rollback_success = true
        logData.rollback_details = 'Auth用户回滚成功'
      } catch (rollbackError: any) {
        logData.rollback_success = false
        logData.rollback_details = `Auth用户回滚失败: ${rollbackError.message}`
      }
      
      // 提供友好的错误提示
      if (profileError.message.includes('duplicate') || profileError.message.includes('unique constraint')) {
        throw new Error('该用户已存在，无法重复创建。如果之前创建失败，请联系技术人员清理数据')
      }
      throw new Error(`创建用户档案失败: ${profileError.message}`)
    }

    logData.completed_steps.push('Profile创建成功')
    console.log('用户档案创建成功')

    // ========== 步骤4：创建角色关联（user_roles表） ==========
    
    logData.completed_steps.push('开始创建角色关联')
    
    /**
     * 在user_roles表中为用户分配角色
     * 支持多角色：一个用户可以拥有多个角色
     * 用户的最终权限 = 所有角色权限的并集
     * 
     * 优化：使用重试机制，提高成功率
     */
    const userRolesData = role_ids.map((roleId: string) => ({
      user_id: userId,
      role_id: roleId,
      assigned_at: new Date().toISOString(),
      assigned_by: null  // 系统管理员创建时分配
    }))

    let userRolesError = null
    let retryCount = 0
    const maxRetries = 3

    // 重试机制：最多重试3次
    while (retryCount < maxRetries) {
      const {error} = await supabaseAdmin.from('user_roles').insert(userRolesData)
      
      if (!error) {
        console.log('角色关联创建成功')
        userRolesError = null
        break
      }
      
      userRolesError = error
      retryCount++
      console.error(`创建角色关联失败（第${retryCount}次尝试）:`, error)
      
      if (retryCount < maxRetries) {
        // 等待一段时间后重试
        await new Promise(resolve => setTimeout(resolve, 500 * retryCount))
      }
    }

    if (userRolesError) {
      console.error('创建角色关联最终失败，开始回滚')
      logData.failed_step = '创建角色关联'
      logData.error_message = userRolesError.message
      logData.rollback_attempted = true
      
      // 回滚：删除Profile和Auth用户
      try {
        await rollbackProfileAndAuthUser(supabaseAdmin, userId, `创建角色关联失败: ${userRolesError.message}`)
        logData.rollback_success = true
        logData.rollback_details = 'Profile和Auth用户回滚成功'
      } catch (rollbackError: any) {
        logData.rollback_success = false
        logData.rollback_details = `Profile和Auth用户回滚失败: ${rollbackError.message}`
      }
      
      throw new Error(`创建角色关联失败: ${userRolesError.message}`)
    }

    logData.completed_steps.push('角色关联创建成功')

    // ========== 步骤5：添加用户到小组（user_teams表） ==========
    
    logData.completed_steps.push('开始添加用户到小组')
    
    /**
     * 如果指定了小组，将用户添加到对应小组
     * 小组分配是可选的，失败不影响用户创建
     * 
     * 优化：使用重试机制，提高成功率
     */
    if (team_ids && Array.isArray(team_ids) && team_ids.length > 0) {
      const userTeamsData = team_ids.map((teamId: string) => ({
        user_id: userId,
        team_id: teamId,
        joined_at: new Date().toISOString()
      }))

      let teamError = null
      retryCount = 0

      // 重试机制：最多重试3次
      while (retryCount < maxRetries) {
        const {error} = await supabaseAdmin.from('user_teams').insert(userTeamsData)
        
        if (!error) {
          console.log('小组分配成功')
          teamError = null
          break
        }
        
        teamError = error
        retryCount++
        console.error(`添加用户到小组失败（第${retryCount}次尝试）:`, error)
        
        if (retryCount < maxRetries) {
          // 等待一段时间后重试
          await new Promise(resolve => setTimeout(resolve, 500 * retryCount))
        }
      }

      if (teamError) {
        console.error('添加用户到小组最终失败:', teamError)
        logData.completed_steps.push('小组分配失败（不影响用户创建）')
        // 注意：小组分配失败不回滚，允许用户创建成功
        // 管理员可以后续手动分配小组
      } else {
        logData.completed_steps.push('小组分配成功')
      }
    } else {
      logData.completed_steps.push('无需分配小组')
    }

    // ========== 记录成功日志 ==========
    
    const executionTime = Date.now() - startTime
    logData.success = true
    logData.execution_time_ms = executionTime
    
    // 写入日志到数据库
    await supabaseAdmin.from('user_creation_logs').insert(logData)

    // ========== 返回成功结果 ==========
    
    /**
     * 构造返回数据
     * 
     * 如果使用随机密码，需要返回密码给管理员
     * 管理员需要将密码告知用户
     */
    const responseData: {
      success: boolean
      message: string
      user_id: string
      password?: string
      execution_time_ms?: number
    } = {
      success: true,
      message: '用户创建成功，可立即登录',
      user_id: userId,
      execution_time_ms: executionTime
    }

    // 如果使用随机密码，返回密码
    if (use_random_password) {
      responseData.password = initialPassword
    }

    return new Response(JSON.stringify(responseData), {
      headers: {...corsHeaders, 'Content-Type': 'application/json'},
      status: 200
    })
  } catch (error: any) {
    // ========== 错误处理 ==========
    
    console.error('创建用户失败:', error)
    
    // 记录失败日志
    const executionTime = Date.now() - startTime
    logData.execution_time_ms = executionTime
    
    if (!logData.error_message) {
      logData.error_message = error.message || '创建用户失败'
    }
    
    // 写入日志到数据库
    try {
      const supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      )
      await supabaseAdmin.from('user_creation_logs').insert(logData)
    } catch (logError) {
      console.error('写入日志失败:', logError)
    }
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || '创建用户失败，请重试'
      }),
      {
        headers: {...corsHeaders, 'Content-Type': 'application/json'},
        status: 400
      }
    )
  }
})
