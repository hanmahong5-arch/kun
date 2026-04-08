import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * 用户清理和管理员设置Edge Function
 * 
 * 功能：
 * 1. 删除用户15232101989的Auth记录
 * 2. 添加新管理员15610496919
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

    const results = {
      step1_delete_old_user: null,
      step2_add_new_admin: null,
      step3_verification: null
    }

    // 步骤1：删除用户15232101989的Auth记录
    console.log('步骤1：删除用户15232101989的Auth记录...')
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(
      '22222222-2222-2222-2222-222222222222'
    )

    if (deleteError) {
      console.error('删除Auth用户失败:', deleteError)
      results.step1_delete_old_user = {
        success: false,
        error: deleteError.message
      }
    } else {
      console.log('Auth用户删除成功')
      results.step1_delete_old_user = {
        success: true,
        message: '用户15232101989已完全删除'
      }
    }

    // 步骤2：添加新管理员15610496919
    console.log('步骤2：添加新管理员15610496919...')
    
    // 查询system_admin角色ID
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from('roles')
      .select('id, code')
      .eq('code', 'system_admin')
      .single()

    if (roleError || !roleData) {
      console.error('查询角色失败:', roleError)
      results.step2_add_new_admin = {
        success: false,
        error: '查询system_admin角色失败'
      }
    } else {
      // 创建Auth用户
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: '15610496919@phone.com',
        password: '123456',
        phone: '15610496919',
        email_confirm: true,
        phone_confirm: true,
        user_metadata: {
          phone: '15610496919',
          created_by: 'system_cleanup',
          created_at: new Date().toISOString()
        }
      })

      if (authError || !authData.user) {
        console.error('创建Auth用户失败:', authError)
        results.step2_add_new_admin = {
          success: false,
          error: authError?.message || '创建Auth用户失败'
        }
      } else {
        const userId = authData.user.id
        console.log('Auth用户创建成功，用户ID:', userId)

        // 创建Profile
        const { error: profileError } = await supabaseAdmin.from('profiles').insert({
          id: userId,
          phone: '15610496919',
          name: '系统管理员2',
          role: 'system_admin',
          status: 'approved',
          approved_at: new Date().toISOString(),
          approved_by: null
        })

        if (profileError) {
          console.error('创建Profile失败:', profileError)
          // 回滚：删除Auth用户
          await supabaseAdmin.auth.admin.deleteUser(userId)
          results.step2_add_new_admin = {
            success: false,
            error: '创建Profile失败: ' + profileError.message
          }
        } else {
          console.log('Profile创建成功')

          // 创建角色关联
          const { error: roleAssignError } = await supabaseAdmin.from('user_roles').insert({
            user_id: userId,
            role_id: roleData.id,
            assigned_at: new Date().toISOString(),
            assigned_by: null
          })

          if (roleAssignError) {
            console.error('创建角色关联失败:', roleAssignError)
            // 回滚：删除Profile和Auth用户
            await supabaseAdmin.from('profiles').delete().eq('id', userId)
            await supabaseAdmin.auth.admin.deleteUser(userId)
            results.step2_add_new_admin = {
              success: false,
              error: '创建角色关联失败: ' + roleAssignError.message
            }
          } else {
            console.log('角色关联创建成功')
            results.step2_add_new_admin = {
              success: true,
              message: '管理员15610496919创建成功',
              user_id: userId
            }
          }
        }
      }
    }

    // 步骤3：验证最终结果
    console.log('步骤3：验证最终结果...')
    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from('profiles')
      .select('id, phone, name, role, status')
      .order('phone')

    if (profilesError) {
      console.error('查询profiles失败:', profilesError)
      results.step3_verification = {
        success: false,
        error: profilesError.message
      }
    } else {
      console.log('当前系统中的用户:', profiles)
      results.step3_verification = {
        success: true,
        profiles: profiles
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: '用户清理和管理员设置完成',
        results: results
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
