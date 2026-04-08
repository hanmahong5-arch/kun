import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * 获取用户权限预览
 * 
 * 功能：
 * 1. 获取用户的所有权限（直接权限+继承权限）
 * 2. 按权限类型分类展示
 * 3. 标识权限来源（直接/继承）
 * 
 * 请求参数：
 * - user_id: 用户ID
 * - permission_type: 可选，权限类型筛选（menu/operation/data）
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 获取请求参数
    const url = new URL(req.url)
    const userId = url.searchParams.get('user_id')
    const permissionType = url.searchParams.get('permission_type')

    if (!userId) {
      return new Response(
        JSON.stringify({ success: false, error: '缺少user_id参数' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // 调用数据库函数获取用户所有权限
    const { data: permissions, error: permissionsError } = await supabaseAdmin
      .rpc('get_user_all_permissions', { user_uuid: userId })

    if (permissionsError) {
      console.error('获取用户权限失败:', permissionsError)
      return new Response(
        JSON.stringify({ success: false, error: '获取用户权限失败: ' + permissionsError.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // 按权限类型筛选
    let filteredPermissions = permissions || []
    if (permissionType) {
      filteredPermissions = filteredPermissions.filter(
        (p: any) => p.permission_type === permissionType
      )
    }

    // 按权限类型分组
    const groupedPermissions = {
      menu: [] as any[],
      operation: [] as any[],
      data: [] as any[]
    }

    filteredPermissions.forEach((p: any) => {
      const permissionItem = {
        id: p.permission_id,
        code: p.permission_code,
        name: p.permission_name,
        type: p.permission_type,
        description: p.permission_description,
        source: p.source,
        sourceRole: {
          id: p.source_role_id,
          name: p.source_role_name
        }
      }

      if (p.permission_type === 'menu') {
        groupedPermissions.menu.push(permissionItem)
      } else if (p.permission_type === 'operation') {
        groupedPermissions.operation.push(permissionItem)
      } else if (p.permission_type === 'data') {
        groupedPermissions.data.push(permissionItem)
      }
    })

    // 统计信息
    const statistics = {
      total: filteredPermissions.length,
      menu: groupedPermissions.menu.length,
      operation: groupedPermissions.operation.length,
      data: groupedPermissions.data.length,
      direct: filteredPermissions.filter((p: any) => p.source === 'direct').length,
      inherited: filteredPermissions.filter((p: any) => p.source === 'inherited').length
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          userId: userId,
          permissions: groupedPermissions,
          statistics: statistics,
          allPermissions: filteredPermissions
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error: any) {
    console.error('操作失败:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
