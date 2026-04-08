import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * 权限对比工具
 * 
 * 功能：
 * 1. 对比两个用户的权限
 * 2. 对比两个角色的权限
 * 3. 对比用户和角色的权限
 * 4. 返回交集、差异、独有权限
 * 
 * 请求参数：
 * - type1: 对比对象1类型（user/role）
 * - id1: 对比对象1的ID
 * - type2: 对比对象2类型（user/role）
 * - id2: 对比对象2的ID
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
    const type1 = url.searchParams.get('type1')
    const id1 = url.searchParams.get('id1')
    const type2 = url.searchParams.get('type2')
    const id2 = url.searchParams.get('id2')

    if (!type1 || !id1 || !type2 || !id2) {
      return new Response(
        JSON.stringify({ success: false, error: '缺少必要参数' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    if (!['user', 'role'].includes(type1) || !['user', 'role'].includes(type2)) {
      return new Response(
        JSON.stringify({ success: false, error: 'type参数必须是user或role' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // 获取对象1的权限
    let permissions1: any[] = []
    if (type1 === 'user') {
      const { data, error } = await supabaseAdmin
        .rpc('get_user_all_permissions', { user_uuid: id1 })
      if (error) throw new Error('获取对象1权限失败: ' + error.message)
      permissions1 = data || []
    } else {
      const { data, error } = await supabaseAdmin
        .rpc('get_role_all_permissions', { role_uuid: id1 })
      if (error) throw new Error('获取对象1权限失败: ' + error.message)
      permissions1 = data || []
    }

    // 获取对象2的权限
    let permissions2: any[] = []
    if (type2 === 'user') {
      const { data, error } = await supabaseAdmin
        .rpc('get_user_all_permissions', { user_uuid: id2 })
      if (error) throw new Error('获取对象2权限失败: ' + error.message)
      permissions2 = data || []
    } else {
      const { data, error } = await supabaseAdmin
        .rpc('get_role_all_permissions', { role_uuid: id2 })
      if (error) throw new Error('获取对象2权限失败: ' + error.message)
      permissions2 = data || []
    }

    // 提取权限ID
    const permissionIds1 = permissions1.map((p: any) => p.permission_id)
    const permissionIds2 = permissions2.map((p: any) => p.permission_id)

    // 计算交集、差异、独有权限
    const intersection = permissionIds1.filter((id: string) => permissionIds2.includes(id))
    const onlyIn1 = permissionIds1.filter((id: string) => !permissionIds2.includes(id))
    const onlyIn2 = permissionIds2.filter((id: string) => !permissionIds1.includes(id))

    // 构建详细的权限信息
    const getPermissionDetails = (ids: string[], allPermissions: any[]) => {
      return ids.map((id: string) => {
        const perm = allPermissions.find((p: any) => p.permission_id === id)
        return {
          id: perm.permission_id,
          code: perm.permission_code,
          name: perm.permission_name,
          type: perm.permission_type,
          description: perm.permission_description
        }
      })
    }

    const intersectionDetails = getPermissionDetails(intersection, permissions1)
    const onlyIn1Details = getPermissionDetails(onlyIn1, permissions1)
    const onlyIn2Details = getPermissionDetails(onlyIn2, permissions2)

    // 获取对象名称
    const getObjectName = async (type: string, id: string) => {
      if (type === 'user') {
        const { data } = await supabaseAdmin
          .from('profiles')
          .select('name, phone')
          .eq('id', id)
          .single()
        return data ? `${data.name}（${data.phone}）` : '未知用户'
      } else {
        const { data } = await supabaseAdmin
          .from('roles')
          .select('name')
          .eq('id', id)
          .single()
        return data ? data.name : '未知角色'
      }
    }

    const object1Name = await getObjectName(type1, id1)
    const object2Name = await getObjectName(type2, id2)

    // 统计信息
    const statistics = {
      object1: {
        type: type1,
        id: id1,
        name: object1Name,
        totalPermissions: permissions1.length
      },
      object2: {
        type: type2,
        id: id2,
        name: object2Name,
        totalPermissions: permissions2.length
      },
      comparison: {
        intersection: intersection.length,
        onlyInObject1: onlyIn1.length,
        onlyInObject2: onlyIn2.length
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          statistics: statistics,
          intersection: intersectionDetails,
          onlyInObject1: onlyIn1Details,
          onlyInObject2: onlyIn2Details,
          allPermissions: {
            object1: permissions1.map((p: any) => ({
              id: p.permission_id,
              code: p.permission_code,
              name: p.permission_name,
              type: p.permission_type,
              description: p.permission_description
            })),
            object2: permissions2.map((p: any) => ({
              id: p.permission_id,
              code: p.permission_code,
              name: p.permission_name,
              type: p.permission_type,
              description: p.permission_description
            }))
          }
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
