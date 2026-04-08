import {createClient} from 'jsr:@supabase/supabase-js@2'

/**
 * CORS配置
 */
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
}

/**
 * 数据一致性检查Edge Function
 * 
 * 功能说明：
 * 1. 检查auth.users和profiles表的数据一致性
 * 2. 识别孤儿Auth用户（在auth.users中存在但在profiles中不存在）
 * 3. 识别孤儿Profile记录（在profiles中存在但在auth.users中不存在）
 * 4. 可选：自动修复不一致数据
 * 5. 记录检查和修复日志
 * 
 * 请求参数：
 * - action: 'check' | 'fix' - 操作类型（检查或修复）
 * - operator_id: string - 操作人ID（可选）
 * - operator_name: string - 操作人姓名（可选）
 * 
 * 返回结果：
 * - success: 是否成功
 * - orphan_auth_users: 孤儿Auth用户列表
 * - orphan_profiles: 孤儿Profile记录列表
 * - orphan_auth_count: 孤儿Auth用户数量
 * - orphan_profile_count: 孤儿Profile记录数量
 * - fixed: 是否已修复（仅fix操作）
 * - fix_result: 修复结果详情（仅fix操作）
 * - log_id: 检查日志ID
 */
Deno.serve(async (req) => {
  // 处理OPTIONS预检请求
  if (req.method === 'OPTIONS') {
    return new Response('ok', {headers: corsHeaders})
  }

  try {
    // 创建Supabase管理员客户端
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 解析请求参数
    const {action = 'check', operator_id, operator_name} = await req.json()

    // 记录开始时间
    const startTime = Date.now()

    // ========== 步骤1：检查孤儿Auth用户 ==========

    // 先获取所有profiles的ID
    const {data: profiles, error: profilesError} = await supabaseAdmin
      .from('profiles')
      .select('id')

    if (profilesError) {
      throw new Error(`查询profiles失败: ${profilesError.message}`)
    }

    const profileIds = new Set(profiles?.map((p: {id: string}) => p.id) || [])

    // 获取所有auth用户
    const {data: authUsers, error: authError} = await supabaseAdmin.auth.admin.listUsers()

    if (authError) {
      throw new Error(`查询auth用户失败: ${authError.message}`)
    }

    // 筛选出孤儿Auth用户
    const orphanAuthUsers = authUsers.users
      .filter((u) => !profileIds.has(u.id))
      .map((u) => ({
        id: u.id,
        email: u.email,
        phone: u.phone,
        created_at: u.created_at
      }))

    // ========== 步骤2：检查孤儿Profile记录 ==========

    const authUserIds = new Set(authUsers.users.map((u) => u.id))

    // 筛选出孤儿Profile记录
    const orphanProfiles = profiles
      ?.filter((p: {id: string}) => !authUserIds.has(p.id))
      .map((p: {id: string}) => p.id) || []

    // 如果有孤儿Profile，获取详细信息
    let orphanProfileDetails: Array<{id: string; phone: string; name: string; created_at: string}> = []
    if (orphanProfiles.length > 0) {
      const {data: profileDetails, error: profileDetailsError} = await supabaseAdmin
        .from('profiles')
        .select('id, phone, name, created_at')
        .in('id', orphanProfiles)

      if (!profileDetailsError && profileDetails) {
        orphanProfileDetails = profileDetails
      }
    }

    // 计算执行时间
    const executionTimeMs = Date.now() - startTime

    // ========== 步骤3：如果是check操作，记录日志并返回 ==========

    if (action === 'check') {
      // 记录检查日志
      const {data: logData, error: logError} = await supabaseAdmin
        .from('consistency_check_logs')
        .insert({
          checked_at: new Date().toISOString(),
          operator_id: operator_id || null,
          operator_name: operator_name || null,
          orphan_auth_count: orphanAuthUsers.length,
          orphan_profile_count: orphanProfileDetails.length,
          orphan_auth_ids: orphanAuthUsers.map((u) => u.id),
          orphan_profile_ids: orphanProfileDetails.map((p) => p.id),
          fixed: false,
          execution_time_ms: executionTimeMs
        })
        .select('id')
        .single()

      if (logError) {
        console.error('记录检查日志失败:', logError)
      }

      return new Response(
        JSON.stringify({
          success: true,
          orphan_auth_users: orphanAuthUsers,
          orphan_profiles: orphanProfileDetails,
          orphan_auth_count: orphanAuthUsers.length,
          orphan_profile_count: orphanProfileDetails.length,
          log_id: logData?.id,
          execution_time_ms: executionTimeMs
        }),
        {
          headers: {...corsHeaders, 'Content-Type': 'application/json'},
          status: 200
        }
      )
    }

    // ========== 步骤4：如果是fix操作，执行修复 ==========

    const fixResult: {
      auth_cleaned: number
      auth_errors: Array<{user_id: string; error: string}>
      profile_cleaned: number
      profile_errors: Array<{profile_id: string; error: string}>
    } = {
      auth_cleaned: 0,
      auth_errors: [],
      profile_cleaned: 0,
      profile_errors: []
    }

    // 修复孤儿Auth用户（删除）
    for (const user of orphanAuthUsers) {
      try {
        const {error: deleteError} = await supabaseAdmin.auth.admin.deleteUser(user.id)

        if (deleteError) {
          fixResult.auth_errors.push({
            user_id: user.id,
            error: deleteError.message
          })
        } else {
          fixResult.auth_cleaned++
          console.log(`成功删除孤儿Auth用户: ${user.id}`)
        }
      } catch (error) {
        fixResult.auth_errors.push({
          user_id: user.id,
          error: error.message
        })
      }
    }

    // 修复孤儿Profile记录（删除）
    for (const profile of orphanProfileDetails) {
      try {
        const {error: deleteError} = await supabaseAdmin
          .from('profiles')
          .delete()
          .eq('id', profile.id)

        if (deleteError) {
          fixResult.profile_errors.push({
            profile_id: profile.id,
            error: deleteError.message
          })
        } else {
          fixResult.profile_cleaned++
          console.log(`成功删除孤儿Profile记录: ${profile.id}`)
        }
      } catch (error) {
        fixResult.profile_errors.push({
          profile_id: profile.id,
          error: error.message
        })
      }
    }

    // 计算总执行时间
    const totalExecutionTimeMs = Date.now() - startTime

    // 记录修复日志
    const {data: logData, error: logError} = await supabaseAdmin
      .from('consistency_check_logs')
      .insert({
        checked_at: new Date().toISOString(),
        operator_id: operator_id || null,
        operator_name: operator_name || null,
        orphan_auth_count: orphanAuthUsers.length,
        orphan_profile_count: orphanProfileDetails.length,
        orphan_auth_ids: orphanAuthUsers.map((u) => u.id),
        orphan_profile_ids: orphanProfileDetails.map((p) => p.id),
        fixed: true,
        fix_result: fixResult,
        execution_time_ms: totalExecutionTimeMs
      })
      .select('id')
      .single()

    if (logError) {
      console.error('记录修复日志失败:', logError)
    }

    // 返回修复结果
    return new Response(
      JSON.stringify({
        success: true,
        message: `成功修复 ${fixResult.auth_cleaned + fixResult.profile_cleaned} 条不一致数据`,
        orphan_auth_users: orphanAuthUsers,
        orphan_profiles: orphanProfileDetails,
        orphan_auth_count: orphanAuthUsers.length,
        orphan_profile_count: orphanProfileDetails.length,
        fixed: true,
        fix_result: fixResult,
        log_id: logData?.id,
        execution_time_ms: totalExecutionTimeMs
      }),
      {
        headers: {...corsHeaders, 'Content-Type': 'application/json'},
        status: 200
      }
    )
  } catch (error) {
    console.error('数据一致性检查失败:', error)

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || '数据一致性检查失败'
      }),
      {
        headers: {...corsHeaders, 'Content-Type': 'application/json'},
        status: 400
      }
    )
  }
})
