import {supabase} from '@/client/supabase'
import type {
  Profile,
  WeeklyReport,
  Project,
  ProjectFollowUp,
  BiddingInfo,
  Customer,
  CustomerFollowUp,
  AnnualTarget,
  Task,
  Document,
  Notification,
  ReportConfig,
  ModulePermission
} from './types'

// ==================== Profiles ====================
export async function getProfile(userId: string) {
  const {data, error} = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
  if (error) throw error
  return data as Profile | null
}

export async function updateProfile(userId: string, updates: Partial<Profile>) {
  const {data, error} = await supabase.from('profiles').update(updates).eq('id', userId).select().maybeSingle()
  if (error) throw error
  return data as Profile | null
}

export async function getAllProfiles() {
  const {data, error} = await supabase.from('profiles').select('*').order('created_at', {ascending: false})
  if (error) throw error
  return Array.isArray(data) ? (data as Profile[]) : []
}

// 获取待审核用户列表
export async function getPendingUsers() {
  const {data, error} = await supabase
    .from('profiles')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', {ascending: false})
  if (error) throw error
  return Array.isArray(data) ? (data as Profile[]) : []
}

// 审核通过用户
export async function approveUser(userId: string, approvedBy: string) {
  const {data, error} = await supabase
    .from('profiles')
    .update({
      status: 'approved',
      approved_by: approvedBy,
      approved_at: new Date().toISOString()
    })
    .eq('id', userId)
    .select()
    .maybeSingle()
  if (error) throw error
  return data as Profile | null
}

// 拒绝用户
export async function rejectUser(userId: string, approvedBy: string, reason: string) {
  const {data, error} = await supabase
    .from('profiles')
    .update({
      status: 'rejected',
      approved_by: approvedBy,
      approved_at: new Date().toISOString(),
      rejection_reason: reason
    })
    .eq('id', userId)
    .select()
    .maybeSingle()
  if (error) throw error
  return data as Profile | null
}

// ==================== Weekly Reports ====================
export async function createWeeklyReport(report: Omit<WeeklyReport, 'id' | 'created_at' | 'updated_at'>) {
  const {data, error} = await supabase.from('weekly_reports').insert(report).select().maybeSingle()
  if (error) throw error
  return data as WeeklyReport | null
}

export async function getMyWeeklyReports(userId: string) {
  const {data, error} = await supabase
    .from('weekly_reports')
    .select('*')
    .eq('user_id', userId)
    .order('week_start_date', {ascending: false})
  if (error) throw error
  return Array.isArray(data) ? (data as WeeklyReport[]) : []
}

export async function getAllWeeklyReports() {
  const {data, error} = await supabase
    .from('weekly_reports')
    .select('*')
    .order('week_start_date', {ascending: false})
  if (error) throw error
  return Array.isArray(data) ? (data as WeeklyReport[]) : []
}

export async function getWeeklyReportById(id: string) {
  const {data, error} = await supabase.from('weekly_reports').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return data as WeeklyReport | null
}

export async function updateWeeklyReport(id: string, updates: Partial<WeeklyReport>) {
  const {data, error} = await supabase.from('weekly_reports').update(updates).eq('id', id).select().maybeSingle()
  if (error) throw error
  return data as WeeklyReport | null
}

export async function getAllWeeklyReportsForReview() {
  const {data, error} = await supabase
    .from('weekly_reports')
    .select('*, profiles!weekly_reports_user_id_fkey(name, department)')
    .in('status', ['pending_review', 'reviewed', 'rejected'])
    .order('created_at', {ascending: false})
  if (error) throw error
  return Array.isArray(data) ? data : []
}

// ==================== Projects ====================
export async function createProject(project: Omit<Project, 'id' | 'created_at' | 'updated_at'>) {
  const {data, error} = await supabase.from('projects').insert(project).select().maybeSingle()
  if (error) throw error
  return data as Project | null
}

export async function getMyProjects(userId: string) {
  const {data, error} = await supabase
    .from('projects')
    .select('*, profiles!projects_responsible_person_id_fkey(name)')
    .eq('responsible_person_id', userId)
    .order('created_at', {ascending: false})
  if (error) throw error
  return Array.isArray(data) ? data : []
}

export async function getAllProjects() {
  const {data, error} = await supabase
    .from('projects')
    .select('*, profiles!projects_responsible_person_id_fkey(name)')
    .order('created_at', {ascending: false})
  if (error) throw error
  return Array.isArray(data) ? data : []
}

// Get projects visible to a user's team members
export async function getTeamProjects(userId: string) {
  // 1. Find which teams the user belongs to
  const {data: userTeams} = await supabase
    .from('user_teams')
    .select('team_id')
    .eq('user_id', userId)

  if (!userTeams || userTeams.length === 0) {
    // No team: fall back to own projects only
    return getMyProjects(userId)
  }

  const teamIds = userTeams.map(t => t.team_id)

  // 2. Find all members in those teams
  const {data: teamMembers} = await supabase
    .from('user_teams')
    .select('user_id')
    .in('team_id', teamIds)

  if (!teamMembers || teamMembers.length === 0) {
    return getMyProjects(userId)
  }

  const memberIds = [...new Set(teamMembers.map(m => m.user_id))]

  // 3. Get projects for all team members
  const {data, error} = await supabase
    .from('projects')
    .select('*, profiles!projects_responsible_person_id_fkey(name)')
    .in('responsible_person_id', memberIds)
    .order('created_at', {ascending: false})
  if (error) throw error
  return Array.isArray(data) ? data : []
}

// Get customers visible to a user's team members
export async function getTeamCustomers(userId: string) {
  const {data: userTeams} = await supabase
    .from('user_teams')
    .select('team_id')
    .eq('user_id', userId)

  if (!userTeams || userTeams.length === 0) {
    const {data, error} = await supabase
      .from('customers')
      .select('*')
      .eq('responsible_person_id', userId)
      .order('created_at', {ascending: false})
    if (error) throw error
    return Array.isArray(data) ? data : []
  }

  const teamIds = userTeams.map(t => t.team_id)
  const {data: teamMembers} = await supabase
    .from('user_teams')
    .select('user_id')
    .in('team_id', teamIds)

  const memberIds = [...new Set((teamMembers || []).map(m => m.user_id))]

  const {data, error} = await supabase
    .from('customers')
    .select('*')
    .in('responsible_person_id', memberIds)
    .order('created_at', {ascending: false})
  if (error) throw error
  return Array.isArray(data) ? data : []
}

export async function getProjectById(id: string) {
  const {data, error} = await supabase
    .from('projects')
    .select('*, profiles!projects_responsible_person_id_fkey(name, phone)')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function updateProject(id: string, updates: Partial<Project>) {
  const {data, error} = await supabase.from('projects').update(updates).eq('id', id).select().maybeSingle()
  if (error) throw error
  return data as Project | null
}

export async function deleteProject(id: string) {
  const {error} = await supabase.from('projects').delete().eq('id', id)
  if (error) throw error
  return true
}

// ==================== Project Follow Ups ====================
export async function createProjectFollowUp(followUp: Omit<ProjectFollowUp, 'id' | 'created_at'>) {
  const {data, error} = await supabase.from('project_follow_ups').insert(followUp).select().maybeSingle()
  if (error) throw error
  return data as ProjectFollowUp | null
}

export async function getProjectFollowUps(projectId: string) {
  const {data, error} = await supabase
    .from('project_follow_ups')
    .select('*, profiles!project_follow_ups_user_id_fkey(name)')
    .eq('project_id', projectId)
    .order('created_at', {ascending: false})
  if (error) throw error
  return Array.isArray(data) ? data : []
}

// ==================== Bidding Info ====================
export async function createBiddingInfo(bidding: Omit<BiddingInfo, 'id' | 'created_at' | 'updated_at'>) {
  const {data, error} = await supabase.from('bidding_info').insert(bidding).select().maybeSingle()
  if (error) throw error
  return data as BiddingInfo | null
}

export async function getAllBiddingInfo() {
  const {data, error} = await supabase
    .from('bidding_info')
    .select('*, projects!bidding_info_project_id_fkey(name, construction_unit)')
    .order('created_at', {ascending: false})
  if (error) throw error
  return Array.isArray(data) ? data : []
}

export async function updateBiddingInfo(id: string, updates: Partial<BiddingInfo>) {
  const {data, error} = await supabase.from('bidding_info').update(updates).eq('id', id).select().maybeSingle()
  if (error) throw error
  return data as BiddingInfo | null
}

// 创建项目跟踪记录
export async function createProjectTrackingRecord(record: {
  project_id: string
  tracking_content: string
  updated_by: string
}) {
  const {data, error} = await supabase
    .from('project_tracking_records')
    .insert(record)
    .select()
    .maybeSingle()
  if (error) throw error
  return data
}

// 获取项目的跟踪记录
export async function getProjectTrackingRecords(projectId: string) {
  const {data, error} = await supabase
    .from('project_tracking_records')
    .select('*, profiles!project_tracking_records_updated_by_fkey(name)')
    .eq('project_id', projectId)
    .order('created_at', {ascending: false})
  if (error) throw error
  return Array.isArray(data) ? data : []
}

// ==================== Customers ====================
export async function createCustomer(customer: Omit<Customer, 'id' | 'created_at' | 'updated_at'>) {
  const {data, error} = await supabase.from('customers').insert(customer).select().maybeSingle()
  if (error) throw error
  return data as Customer | null
}

export async function getMyCustomers(userId: string) {
  const {data, error} = await supabase
    .from('customers')
    .select('*, profiles!customers_responsible_person_id_fkey(name)')
    .eq('responsible_person_id', userId)
    .order('created_at', {ascending: false})
  if (error) throw error
  return Array.isArray(data) ? data : []
}

export async function getAllCustomers() {
  const {data, error} = await supabase
    .from('customers')
    .select('*, profiles!customers_responsible_person_id_fkey(name)')
    .order('created_at', {ascending: false})
  if (error) throw error
  return Array.isArray(data) ? data : []
}

export async function getCustomerById(id: string) {
  const {data, error} = await supabase
    .from('customers')
    .select('*, profiles!customers_responsible_person_id_fkey(name, phone)')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function updateCustomer(id: string, updates: Partial<Customer>) {
  const {data, error} = await supabase.from('customers').update(updates).eq('id', id).select().maybeSingle()
  if (error) throw error
  return data as Customer | null
}

export async function deleteCustomer(id: string) {
  const {error} = await supabase.from('customers').delete().eq('id', id)
  if (error) throw error
  return true
}

// ==================== Customer Follow Ups ====================
export async function createCustomerFollowUp(followUp: {
  customer_id: string
  follow_date: string
  follow_method: string
  content: string
  next_plan?: string | null
  next_follow_date?: string | null
  user_id: string
}) {
  const {data, error} = await supabase.from('customer_follow_ups').insert(followUp).select().maybeSingle()
  if (error) throw error
  return data
}

export async function getCustomerFollowUps(customerId: string) {
  const {data, error} = await supabase
    .from('customer_follow_ups')
    .select('*, profiles!customer_follow_ups_user_id_fkey(name)')
    .eq('customer_id', customerId)
    .order('follow_date', {ascending: false})
  if (error) throw error
  return Array.isArray(data) ? data : []
}

// 获取客户最近跟进时间
export async function getCustomerLastFollowUpDate(customerId: string) {
  const {data, error} = await supabase
    .from('customer_follow_ups')
    .select('follow_date')
    .eq('customer_id', customerId)
    .order('follow_date', {ascending: false})
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data?.follow_date || null
}

// ==================== Tasks ====================
export async function createTask(task: Omit<Task, 'id' | 'created_at' | 'updated_at'>) {
  const {data, error} = await supabase.from('tasks').insert(task).select().maybeSingle()
  if (error) throw error
  return data as Task | null
}

// Returns tasks where user is assigner, assignee, or collaborator
export async function getMyTasks(userId: string) {
  const {data, error} = await supabase
    .from('tasks')
    .select('*, profiles!tasks_assigned_by_fkey(name)')
    .or(`responsible_person_id.eq.${userId},assigned_by.eq.${userId},collaborators.cs.{${userId}}`)
    .order('deadline', {ascending: true})
  if (error) throw error
  return Array.isArray(data) ? data : []
}

export async function getTaskById(id: string) {
  const {data, error} = await supabase
    .from('tasks')
    .select('*, profiles!tasks_assigned_by_fkey(name)')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function updateTask(id: string, updates: Partial<Task>) {
  const {data, error} = await supabase.from('tasks').update(updates).eq('id', id).select().maybeSingle()
  if (error) throw error
  return data as Task | null
}

// 创建任务进度更新
export async function createTaskProgressUpdate(progressData: {
  task_id: string
  updated_by: string
  progress: number
  is_completed: boolean
  note: string | null
}) {
  const {data, error} = await supabase
    .from('task_progress_updates')
    .insert(progressData)
    .select()
    .maybeSingle()
  if (error) throw error
  return data
}

// 获取任务的所有进度更新记录
export async function getTaskProgressUpdates(taskId: string) {
  const {data, error} = await supabase
    .from('task_progress_updates')
    .select('*, profiles!task_progress_updates_updated_by_fkey(name)')
    .eq('task_id', taskId)
    .order('created_at', {ascending: false})
  if (error) throw error
  return Array.isArray(data) ? data : []
}

// 获取指派人的任务统计（仅领导）
export async function getAssignedTasksStats(assignerId: string) {
  const {data, error} = await supabase
    .from('tasks')
    .select('id, status, priority, deadline')
    .eq('assigned_by', assignerId)
  
  if (error) throw error
  
  const tasks = Array.isArray(data) ? data : []
  const now = new Date()
  
  return {
    total: tasks.length,
    pending: tasks.filter((t) => t.status === 'pending').length,
    in_progress: tasks.filter((t) => t.status === 'in_progress').length,
    completed: tasks.filter((t) => t.status === 'completed').length,
    overdue: tasks.filter((t) => {
      const deadline = new Date(t.deadline)
      return deadline < now && t.status !== 'completed'
    }).length
  }
}

// 获取指派人的所有任务（支持筛选）
export async function getAssignedTasks(assignerId: string, filters?: {
  status?: string
  priority?: string
  sortBy?: 'deadline' | 'priority' | 'created_at'
}) {
  let query = supabase
    .from('tasks')
    .select('*, profiles!tasks_responsible_person_id_fkey(name)')
    .eq('assigned_by', assignerId)
  
  if (filters?.status) {
    query = query.eq('status', filters.status)
  }
  
  if (filters?.priority) {
    query = query.eq('priority', filters.priority)
  }
  
  // 排序
  if (filters?.sortBy === 'deadline') {
    query = query.order('deadline', {ascending: true})
  } else if (filters?.sortBy === 'priority') {
    query = query.order('priority', {ascending: false})
  } else {
    query = query.order('created_at', {ascending: false})
  }
  
  const {data, error} = await query
  if (error) throw error
  return Array.isArray(data) ? data : []
}

// 确认任务完成（指派人操作）
export async function confirmTaskCompletion(taskId: string, confirmedBy: string) {
  const {data, error} = await supabase
    .from('tasks')
    .update({
      confirmed_completed: true,
      confirmed_by: confirmedBy,
      confirmed_at: new Date().toISOString(),
      status: 'completed'
    })
    .eq('id', taskId)
    .select()
    .maybeSingle()
  if (error) throw error
  return data
}

// 获取用户的通知列表
export async function getUserNotifications(userId: string, unreadOnly = false) {
  let query = supabase
    .from('task_notifications')
    .select('*, tasks!task_notifications_task_id_fkey(name)')
    .eq('recipient_id', userId)
    .order('created_at', {ascending: false})
  
  if (unreadOnly) {
    query = query.eq('is_read', false)
  }
  
  const {data, error} = await query
  if (error) throw error
  return Array.isArray(data) ? data : []
}

// 标记通知为已读
export async function markNotificationAsRead(notificationId: string) {
  const {data, error} = await supabase
    .from('task_notifications')
    .update({is_read: true})
    .eq('id', notificationId)
    .select()
    .maybeSingle()
  if (error) throw error
  return data
}

// 标记所有通知为已读
export async function markAllNotificationsAsRead(userId: string) {
  const {error} = await supabase
    .from('task_notifications')
    .update({is_read: true})
    .eq('recipient_id', userId)
    .eq('is_read', false)
  if (error) throw error
}

// 获取未读通知数量
export async function getUnreadNotificationCount(userId: string) {
  const {count, error} = await supabase
    .from('task_notifications')
    .select('*', {count: 'exact', head: true})
    .eq('recipient_id', userId)
    .eq('is_read', false)
  if (error) throw error
  return count || 0
}

// ==================== Documents ====================
export async function createDocument(doc: Omit<Document, 'id' | 'created_at' | 'updated_at'>) {
  const {data, error} = await supabase.from('documents').insert(doc).select().maybeSingle()
  if (error) throw error
  return data as Document | null
}

export async function getAllDocuments() {
  const {data, error} = await supabase
    .from('documents')
    .select('*, profiles!documents_uploaded_by_fkey(name)')
    .order('created_at', {ascending: false})
  if (error) throw error
  return Array.isArray(data) ? data : []
}

export async function getDocumentById(id: string) {
  const {data, error} = await supabase.from('documents').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return data as Document | null
}

export async function updateDocument(id: string, updates: Partial<Document>) {
  const {data, error} = await supabase.from('documents').update(updates).eq('id', id).select().maybeSingle()
  if (error) throw error
  return data as Document | null
}

// ==================== Notifications ====================
export async function createNotification(notification: Omit<Notification, 'id' | 'created_at'>) {
  const {data, error} = await supabase.from('notifications').insert(notification).select().maybeSingle()
  if (error) throw error
  return data as Notification | null
}

export async function getMyNotifications(userId: string) {
  const {data, error} = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', {ascending: false})
    .limit(50)
  if (error) throw error
  return Array.isArray(data) ? (data as Notification[]) : []
}

// ==================== Report Configs ====================
export async function createReportConfig(config: Omit<ReportConfig, 'id' | 'created_at' | 'updated_at'>) {
  const {data, error} = await supabase.from('report_configs').insert(config).select().maybeSingle()
  if (error) throw error
  return data as ReportConfig | null
}

export async function getAllReportConfigs() {
  const {data, error} = await supabase
    .from('report_configs')
    .select('*, profiles!report_configs_created_by_fkey(name)')
    .order('created_at', {ascending: false})
  if (error) throw error
  return Array.isArray(data) ? data : []
}

export async function getReportConfigById(id: string) {
  const {data, error} = await supabase.from('report_configs').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return data as ReportConfig | null
}

export async function updateReportConfig(id: string, updates: Partial<ReportConfig>) {
  const {data, error} = await supabase.from('report_configs').update(updates).eq('id', id).select().maybeSingle()
  if (error) throw error
  return data as ReportConfig | null
}

export async function deleteReportConfig(id: string) {
  const {error} = await supabase.from('report_configs').delete().eq('id', id)
  if (error) throw error
}

// ==================== Annual Targets ====================
export async function getAnnualTarget(year: number) {
  const {data, error} = await supabase.from('annual_targets').select('*').eq('year', year).maybeSingle()
  if (error) throw error
  return data
}

export async function updateAnnualTarget(year: number, targetAmount: number, updatedBy: string) {
  const {data, error} = await supabase
    .from('annual_targets')
    .upsert({year, target_amount: targetAmount, updated_by: updatedBy}, {onConflict: 'year'})
    .select()
    .maybeSingle()
  if (error) throw error
  return data
}

// ==================== Module Permissions ====================
export async function getUserModulePermissions(userId: string) {
  const {data, error} = await supabase.from('module_permissions').select('*').eq('user_id', userId)
  if (error) throw error
  return Array.isArray(data) ? data : []
}

export async function getAllModulePermissions() {
  const {data, error} = await supabase.from('module_permissions').select('*')
  if (error) throw error
  return Array.isArray(data) ? data : []
}

export async function updateModulePermission(
  userId: string,
  moduleName: string,
  permissions: {
    can_view?: boolean
    can_create?: boolean
    can_edit?: boolean
    can_delete?: boolean
    can_export?: boolean
  }
) {
  const {data, error} = await supabase
    .from('module_permissions')
    .upsert({user_id: userId, module_name: moduleName, ...permissions}, {onConflict: 'user_id,module_name'})
    .select()
    .maybeSingle()
  if (error) throw error
  return data
}

export async function deleteModulePermission(userId: string, moduleName: string) {
  const {error} = await supabase
    .from('module_permissions')
    .delete()
    .eq('user_id', userId)
    .eq('module_name', moduleName)
  if (error) throw error
}
