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

    const results = []

    // 1. 重置15232101989的密码 (ID: 22222222-2222-2222-2222-222222222222)
    try {
      const {error: error1} = await supabaseAdmin.auth.admin.updateUserById(
        '22222222-2222-2222-2222-222222222222',
        {password: '123456'}
      )
      if (error1) {
        results.push({phone: '15232101989', success: false, error: error1.message})
      } else {
        results.push({phone: '15232101989', success: true, message: '密码已重置为123456'})
      }
    } catch (e) {
      results.push({phone: '15232101989', success: false, error: e.message})
    }

    // 2. 重置17685587922的密码 (ID: 1249d8fe-3bb4-4c89-9f47-02565e90bd19)
    try {
      const {error: error2} = await supabaseAdmin.auth.admin.updateUserById(
        '1249d8fe-3bb4-4c89-9f47-02565e90bd19',
        {password: '123456'}
      )
      if (error2) {
        results.push({phone: '17685587922', success: false, error: error2.message})
      } else {
        results.push({phone: '17685587922', success: true, message: '密码已重置为123456'})
      }
    } catch (e) {
      results.push({phone: '17685587922', success: false, error: e.message})
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: '管理员密码重置完成',
        results
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
