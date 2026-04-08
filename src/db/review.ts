import {supabase} from '@/client/supabase'
import type {ReviewHistory, ReportTaskRelation} from './types'

/**
 * 创建审阅历史记录
 */
export async function createReviewHistory(data: {
  report_id: string
  reviewer_id: string
  review_status: 'approved' | 'rejected'
  review_comment: string | null
}) {
  const {data: result, error} = await supabase
    .from('review_history')
    .insert({
      report_id: data.report_id,
      reviewer_id: data.reviewer_id,
      review_status: data.review_status,
      review_comment: data.review_comment,
      reviewed_at: new Date().toISOString()
    })
    .select()
    .maybeSingle()

  if (error) throw error
  return result
}

/**
 * 获取周报的审阅历史
 */
export async function getReviewHistory(reportId: string): Promise<ReviewHistory[]> {
  const {data, error} = await supabase
    .from('review_history')
    .select(`
      *,
      profiles!review_history_reviewer_id_fkey(name)
    `)
    .eq('report_id', reportId)
    .order('reviewed_at', {ascending: false})

  if (error) throw error

  // 处理数据，提取审阅人姓名
  const processedData = (data || []).map((item) => {
    const profileData = item.profiles as {name: string} | null
    return {
      ...item,
      reviewer: {
        name: profileData?.name || '未知用户'
      }
    }
  })

  return processedData as ReviewHistory[]
}

/**
 * 添加周报-任务关联
 */
export async function addReportTaskRelation(data: {
  report_id: string
  task_id: string
  created_by: string
}) {
  const {data: result, error} = await supabase
    .from('report_task_relations')
    .insert(data)
    .select()
    .maybeSingle()

  if (error) throw error
  return result
}

/**
 * 移除周报-任务关联
 */
export async function removeReportTaskRelation(reportId: string, taskId: string) {
  const {error} = await supabase
    .from('report_task_relations')
    .delete()
    .eq('report_id', reportId)
    .eq('task_id', taskId)

  if (error) throw error
}

/**
 * 获取周报关联的任务列表（增强版，包含完整任务信息）
 */
export async function getReportTasks(reportId: string) {
  const {data, error} = await supabase
    .from('report_task_relations')
    .select(`
      *,
      tasks!report_task_relations_task_id_fkey(
        id,
        name,
        description,
        status,
        priority,
        deadline,
        assigned_by,
        responsible_person_id,
        related_project_id,
        progress,
        created_at
      )
    `)
    .eq('report_id', reportId)
    .order('created_at', {ascending: false})

  if (error) throw error
  return data || []
}

/**
 * 批量添加周报-任务关联
 */
export async function batchAddReportTaskRelations(data: {
  report_id: string
  task_ids: string[]
  created_by: string
}) {
  const relations = data.task_ids.map((taskId) => ({
    report_id: data.report_id,
    task_id: taskId,
    created_by: data.created_by
  }))

  const {error} = await supabase.from('report_task_relations').insert(relations)

  if (error) throw error
}

/**
 * 批量移除周报-任务关联
 */
export async function batchRemoveReportTaskRelations(reportId: string, taskIds: string[]) {
  const {error} = await supabase
    .from('report_task_relations')
    .delete()
    .eq('report_id', reportId)
    .in('task_id', taskIds)

  if (error) throw error
}

/**
 * 获取任务关联的周报列表
 */
export async function getTaskReports(taskId: string) {
  const {data, error} = await supabase
    .from('report_task_relations')
    .select(`
      *,
      weekly_reports!report_task_relations_report_id_fkey(
        id,
        user_id,
        week_start_date,
        week_end_date,
        core_work,
        status,
        profiles!weekly_reports_user_id_fkey(name)
      )
    `)
    .eq('task_id', taskId)
    .order('created_at', {ascending: false})

  if (error) throw error
  return data || []
}
