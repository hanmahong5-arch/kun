import {createClient} from 'jsr:@supabase/supabase-js@2'

/**
 * CORS配置
 */
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
}

/**
 * 清理"孤儿"Auth用户Edge Function
 * 
 * 功能说明：
 * 1. 查询在auth.users中存在但在profiles中不存在的用户
 * 2. 删除这些"孤儿"用户
 * 3. 记录清理日志到cleanup_logs表
 * 4. 返回清理结果
 * 
 * 使用场景：
 * - 当Auth用户创建成功但Profile创建失败时，会产生"孤儿"用户
 * - 这些用户会导致后续无法使用相同手机号创建用户
 * - 定期运行此函数可以清理这些"孤儿"用户
 * - 由pg_cron定时任务自动调用（每天凌晨2点UTC）
 * 
 * 请求参数：
 * - action: 'list' | 'cleanup' - 操作类型（列表或清理）
 * - user_ids: string[] - 要清理的用户ID数组（可选，不传则清理所有）
 * - trigger_type: 'auto' | 'manual' - 触发类型（自动或手动，默认manual）
 * 
 * 返回结果：
 * - success: 是否成功
 * - orphan_users: 孤儿用户列表
 * - cleaned_count: 清理数量
 * - log_id: 清理日志ID
 * - should_alert: 是否需要告警（孤儿用户数量>2）
 * - errors: 错误列表
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
    const {action = 'list', user_ids, trigger_type = 'manual'} = await req.json()

    // 记录开始时间
    const startTime = Date.now()

    // ========== 步骤1：查询"孤儿"用户 ==========
    
    // 查询在auth.users中存在但在profiles中不存在的用户
    const {data: orphanUsers, error: queryError} = await supabaseAdmin.rpc('get_orphan_auth_users')

    if (queryError) {
      // 如果RPC函数不存在，使用备用查询方法
      console.log('RPC函数不存在，使用备用查询方法')
      
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

      // 筛选出"孤儿"用户
      const orphans = authUsers.users
        .filter((u) => !profileIds.has(u.id))
        .map((u) => ({
          id: u.id,
          email: u.email,
          phone: u.phone,
          created_at: u.created_at
        }))

      // 如果只是列表操作，直接返回
      if (action === 'list') {
        return new Response(
          JSON.stringify({
            success: true,
            orphan_users: orphans,
            count: orphans.length
          }),
          {
            headers: {...corsHeaders, 'Content-Type': 'application/json'},
            status: 200
          }
        )
      }

      // ========== 步骤2：清理"孤儿"用户 ==========

      const errors: Array<{user_id: string; error: string}> = []
      let cleanedCount = 0

      // 确定要清理的用户ID列表
      const idsToClean = user_ids && Array.isArray(user_ids) && user_ids.length > 0
        ? orphans.filter((u) => user_ids.includes(u.id))
        : orphans

      // 逐个删除"孤儿"用户
      for (const user of idsToClean) {
        try {
          const {error: deleteError} = await supabaseAdmin.auth.admin.deleteUser(user.id)

          if (deleteError) {
            errors.push({
              user_id: user.id,
              error: deleteError.message
            })
          } else {
            cleanedCount++
            console.log(`成功删除孤儿用户: ${user.id} (${user.phone})`)
          }
        } catch (error) {
          errors.push({
            user_id: user.id,
            error: error.message
          })
        }
      }

      // 计算执行时间
      const executionTimeMs = Date.now() - startTime

      // ========== 步骤3：记录清理日志 ==========

      const cleanedUserIds = idsToClean.map((u) => u.id)
      const status = errors.length === 0 ? 'success' : (cleanedCount > 0 ? 'partial' : 'failed')
      const errorMessage = errors.length > 0 ? JSON.stringify(errors) : null

      const {data: logData, error: logError} = await supabaseAdmin
        .from('cleanup_logs')
        .insert({
          cleaned_at: new Date().toISOString(),
          orphan_count: cleanedCount,
          cleaned_user_ids: cleanedUserIds,
          trigger_type: trigger_type,
          status: status,
          error_message: errorMessage,
          execution_time_ms: executionTimeMs
        })
        .select('id')
        .single()

      if (logError) {
        console.error('记录清理日志失败:', logError)
      }

      // 检查是否需要告警（孤儿用户数量>2）
      const shouldAlert = orphans.length > 2

      // 返回清理结果
      return new Response(
        JSON.stringify({
          success: true,
          message: `成功清理 ${cleanedCount} 个孤儿用户`,
          orphan_users: orphans,
          cleaned_count: cleanedCount,
          total_count: orphans.length,
          log_id: logData?.id,
          should_alert: shouldAlert,
          execution_time_ms: executionTimeMs,
          errors: errors.length > 0 ? errors : undefined
        }),
        {
          headers: {...corsHeaders, 'Content-Type': 'application/json'},
          status: 200
        }
      )
    }

    // 如果RPC函数存在，使用RPC结果
    if (action === 'list') {
      return new Response(
        JSON.stringify({
          success: true,
          orphan_users: orphanUsers,
          count: orphanUsers?.length || 0
        }),
        {
          headers: {...corsHeaders, 'Content-Type': 'application/json'},
          status: 200
        }
      )
    }

    // 清理操作（使用RPC结果）
    const errors: Array<{user_id: string; error: string}> = []
    let cleanedCount = 0

    const idsToClean = user_ids && Array.isArray(user_ids) && user_ids.length > 0
      ? orphanUsers.filter((u: {id: string}) => user_ids.includes(u.id))
      : orphanUsers

    for (const user of idsToClean) {
      try {
        const {error: deleteError} = await supabaseAdmin.auth.admin.deleteUser(user.id)

        if (deleteError) {
          errors.push({
            user_id: user.id,
            error: deleteError.message
          })
        } else {
          cleanedCount++
        }
      } catch (error) {
        errors.push({
          user_id: user.id,
          error: error.message
        })
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `成功清理 ${cleanedCount} 个孤儿用户`,
        orphan_users: orphanUsers,
        cleaned_count: cleanedCount,
        total_count: orphanUsers?.length || 0,
        errors: errors.length > 0 ? errors : undefined
      }),
      {
        headers: {...corsHeaders, 'Content-Type': 'application/json'},
        status: 200
      }
    )
  } catch (error) {
    console.error('清理孤儿用户失败:', error)

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || '清理孤儿用户失败'
      }),
      {
        headers: {...corsHeaders, 'Content-Type': 'application/json'},
        status: 400
      }
    )
  }
})
