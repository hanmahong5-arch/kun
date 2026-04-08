import {createClient} from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {headers: corsHeaders})
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 创建第二个管理员账号
    const phone = '17685587922'
    const email = `${phone}@phone.com`
    const password = '123456'

    // 1. 创建auth用户
    const {data: authData, error: authError} = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      phone,
      email_confirm: true,
      phone_confirm: true,
      user_metadata: {phone}
    })

    if (authError) {
      throw new Error(`创建auth用户失败: ${authError.message}`)
    }

    // 2. 创建profile记录
    const {error: profileError} = await supabaseAdmin.from('profiles').insert({
      id: authData.user.id,
      phone,
      name: '系统管理员',
      role: 'system_admin',
      status: 'approved',
      approved_at: new Date().toISOString()
    })

    if (profileError) {
      throw new Error(`创建profile失败: ${profileError.message}`)
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: '管理员账号创建成功',
        user_id: authData.user.id
      }),
      {
        headers: {...corsHeaders, 'Content-Type': 'application/json'},
        status: 200
      }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        headers: {...corsHeaders, 'Content-Type': 'application/json'},
        status: 400
      }
    )
  }
})
