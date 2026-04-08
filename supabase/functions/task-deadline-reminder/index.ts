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
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const now = new Date()
    const oneDayLater = new Date(now.getTime() + 24 * 60 * 60 * 1000)
    const threeDaysLater = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000)

    // 查找即将到期的任务（1天或3天内）
    const {data: tasks, error: tasksError} = await supabaseClient
      .from('tasks')
      .select('id, name, deadline, responsible_person_id')
      .in('status', ['pending', 'in_progress'])
      .gte('deadline', now.toISOString())
      .lte('deadline', threeDaysLater.toISOString())

    if (tasksError) throw tasksError

    const notifications = []

    for (const task of tasks || []) {
      const deadline = new Date(task.deadline)
      const daysUntilDeadline = Math.ceil((deadline.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))

      // 检查是否已经发送过该提醒
      const {data: existingNotification} = await supabaseClient
        .from('task_notifications')
        .select('id')
        .eq('task_id', task.id)
        .eq('notification_type', 'deadline_reminder')
        .gte('created_at', new Date(now.getTime() - 12 * 60 * 60 * 1000).toISOString()) // 12小时内

      if (existingNotification && existingNotification.length > 0) {
        continue // 已经发送过提醒，跳过
      }

      if (daysUntilDeadline <= 1) {
        notifications.push({
          task_id: task.id,
          recipient_id: task.responsible_person_id,
          notification_type: 'deadline_reminder',
          title: '任务即将到期',
          content: `任务"${task.name}"将在1天内到期，请及时处理`
        })
      } else if (daysUntilDeadline <= 3) {
        notifications.push({
          task_id: task.id,
          recipient_id: task.responsible_person_id,
          notification_type: 'deadline_reminder',
          title: '任务即将到期',
          content: `任务"${task.name}"将在${daysUntilDeadline}天内到期，请注意安排`
        })
      }
    }

    // 批量插入通知
    if (notifications.length > 0) {
      const {error: insertError} = await supabaseClient
        .from('task_notifications')
        .insert(notifications)

      if (insertError) throw insertError
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `已创建${notifications.length}条截止提醒`
      }),
      {
        headers: {...corsHeaders, 'Content-Type': 'application/json'},
        status: 200
      }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({error: error.message}),
      {
        headers: {...corsHeaders, 'Content-Type': 'application/json'},
        status: 400
      }
    )
  }
})
