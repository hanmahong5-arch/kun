import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * 权限模板管理
 * 
 * 功能：
 * 1. 查询模板列表（GET）
 * 2. 创建模板（POST）
 * 3. 更新模板（PUT）
 * 4. 删除模板（DELETE）
 * 5. 应用模板到用户/角色（POST /apply）
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

    const url = new URL(req.url)
    const pathname = url.pathname

    // GET - 查询模板列表或单个模板详情
    if (req.method === 'GET') {
      const templateId = url.searchParams.get('id')
      const category = url.searchParams.get('category')
      const isActive = url.searchParams.get('is_active')

      if (templateId) {
        // 查询单个模板详情
        const { data: template, error: templateError } = await supabaseAdmin
          .from('permission_templates')
          .select('*')
          .eq('id', templateId)
          .single()

        if (templateError) throw new Error('查询模板失败: ' + templateError.message)

        // 查询模板包含的权限
        const { data: items, error: itemsError } = await supabaseAdmin
          .from('permission_template_items')
          .select(`
            id,
            permission_id,
            permissions (
              id,
              code,
              name,
              type,
              description
            )
          `)
          .eq('template_id', templateId)

        if (itemsError) throw new Error('查询模板权限失败: ' + itemsError.message)

        return new Response(
          JSON.stringify({
            success: true,
            data: {
              ...template,
              permissions: items?.map((item: any) => item.permissions) || []
            }
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        )
      } else {
        // 查询模板列表
        let query = supabaseAdmin
          .from('permission_templates')
          .select('*, created_by:profiles!permission_templates_created_by_fkey(name)')
          .order('created_at', { ascending: false })

        if (category) {
          query = query.eq('category', category)
        }

        if (isActive !== null && isActive !== undefined) {
          query = query.eq('is_active', isActive === 'true')
        }

        const { data: templates, error: templatesError } = await query

        if (templatesError) throw new Error('查询模板列表失败: ' + templatesError.message)

        return new Response(
          JSON.stringify({
            success: true,
            data: templates || []
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        )
      }
    }

    // POST - 创建模板或应用模板
    if (req.method === 'POST') {
      const body = await req.json()

      // 应用模板
      if (pathname.includes('/apply')) {
        const { template_id, target_type, target_id, applied_by } = body

        if (!template_id || !target_type || !target_id) {
          return new Response(
            JSON.stringify({ success: false, error: '缺少必要参数' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
          )
        }

        // 查询模板权限
        const { data: items, error: itemsError } = await supabaseAdmin
          .from('permission_template_items')
          .select('permission_id')
          .eq('template_id', template_id)

        if (itemsError) throw new Error('查询模板权限失败: ' + itemsError.message)

        const permissionIds = items?.map((item: any) => item.permission_id) || []

        // 应用到目标
        if (target_type === 'role') {
          // 删除角色现有权限
          await supabaseAdmin
            .from('role_permissions')
            .delete()
            .eq('role_id', target_id)

          // 插入新权限
          const rolePermissions = permissionIds.map((permissionId: string) => ({
            role_id: target_id,
            permission_id: permissionId
          }))

          const { error: insertError } = await supabaseAdmin
            .from('role_permissions')
            .insert(rolePermissions)

          if (insertError) throw new Error('应用模板到角色失败: ' + insertError.message)
        } else if (target_type === 'user') {
          // 对于用户，我们通过角色来管理权限，这里不直接修改
          // 可以创建一个临时角色或者提示用户通过角色管理
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: '用户权限通过角色管理，请先创建角色并应用模板，然后将角色分配给用户' 
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
          )
        }

        // 记录应用历史
        const { data: template } = await supabaseAdmin
          .from('permission_templates')
          .select('version')
          .eq('id', template_id)
          .single()

        await supabaseAdmin
          .from('permission_template_applications')
          .insert({
            template_id: template_id,
            template_version: template?.version || 1,
            target_type: target_type,
            target_id: target_id,
            applied_by: applied_by,
            status: 'success'
          })

        return new Response(
          JSON.stringify({
            success: true,
            message: '模板应用成功'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        )
      }

      // 创建模板
      const { code, name, description, category, permission_ids, created_by } = body

      if (!code || !name || !permission_ids || !Array.isArray(permission_ids)) {
        return new Response(
          JSON.stringify({ success: false, error: '缺少必要参数' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        )
      }

      // 创建模板
      const { data: template, error: templateError } = await supabaseAdmin
        .from('permission_templates')
        .insert({
          code: code,
          name: name,
          description: description,
          category: category || 'custom',
          is_active: true,
          version: 1,
          created_by: created_by
        })
        .select()
        .single()

      if (templateError) throw new Error('创建模板失败: ' + templateError.message)

      // 插入模板权限
      const items = permission_ids.map((permissionId: string) => ({
        template_id: template.id,
        permission_id: permissionId
      }))

      const { error: itemsError } = await supabaseAdmin
        .from('permission_template_items')
        .insert(items)

      if (itemsError) throw new Error('插入模板权限失败: ' + itemsError.message)

      // 创建版本记录
      const { data: permissions } = await supabaseAdmin
        .from('permissions')
        .select('*')
        .in('id', permission_ids)

      await supabaseAdmin
        .from('permission_template_versions')
        .insert({
          template_id: template.id,
          version: 1,
          name: name,
          description: description,
          permission_snapshot: permissions || [],
          created_by: created_by
        })

      return new Response(
        JSON.stringify({
          success: true,
          data: template
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    // PUT - 更新模板
    if (req.method === 'PUT') {
      const body = await req.json()
      const { id, name, description, is_active, permission_ids, updated_by } = body

      if (!id) {
        return new Response(
          JSON.stringify({ success: false, error: '缺少模板ID' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        )
      }

      // 更新模板基本信息
      const updateData: any = { updated_at: new Date().toISOString(), updated_by: updated_by }
      if (name) updateData.name = name
      if (description !== undefined) updateData.description = description
      if (is_active !== undefined) updateData.is_active = is_active

      const { error: updateError } = await supabaseAdmin
        .from('permission_templates')
        .update(updateData)
        .eq('id', id)

      if (updateError) throw new Error('更新模板失败: ' + updateError.message)

      // 如果提供了新的权限列表，更新权限
      if (permission_ids && Array.isArray(permission_ids)) {
        // 删除旧权限
        await supabaseAdmin
          .from('permission_template_items')
          .delete()
          .eq('template_id', id)

        // 插入新权限
        const items = permission_ids.map((permissionId: string) => ({
          template_id: id,
          permission_id: permissionId
        }))

        const { error: itemsError } = await supabaseAdmin
          .from('permission_template_items')
          .insert(items)

        if (itemsError) throw new Error('更新模板权限失败: ' + itemsError.message)

        // 增加版本号并创建新版本记录
        const { data: template } = await supabaseAdmin
          .from('permission_templates')
          .select('version')
          .eq('id', id)
          .single()

        const newVersion = (template?.version || 1) + 1

        await supabaseAdmin
          .from('permission_templates')
          .update({ version: newVersion })
          .eq('id', id)

        const { data: permissions } = await supabaseAdmin
          .from('permissions')
          .select('*')
          .in('id', permission_ids)

        await supabaseAdmin
          .from('permission_template_versions')
          .insert({
            template_id: id,
            version: newVersion,
            name: name,
            description: description,
            permission_snapshot: permissions || [],
            created_by: updated_by
          })
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: '模板更新成功'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    // DELETE - 删除模板
    if (req.method === 'DELETE') {
      const templateId = url.searchParams.get('id')

      if (!templateId) {
        return new Response(
          JSON.stringify({ success: false, error: '缺少模板ID' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        )
      }

      // 检查是否为系统模板
      const { data: template } = await supabaseAdmin
        .from('permission_templates')
        .select('category')
        .eq('id', templateId)
        .single()

      if (template?.category === 'system') {
        return new Response(
          JSON.stringify({ success: false, error: '系统预设模板不能删除' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        )
      }

      // 删除模板（级联删除相关记录）
      const { error: deleteError } = await supabaseAdmin
        .from('permission_templates')
        .delete()
        .eq('id', templateId)

      if (deleteError) throw new Error('删除模板失败: ' + deleteError.message)

      return new Response(
        JSON.stringify({
          success: true,
          message: '模板删除成功'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    return new Response(
      JSON.stringify({ success: false, error: '不支持的请求方法' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 405 }
    )
  } catch (error: any) {
    console.error('操作失败:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
