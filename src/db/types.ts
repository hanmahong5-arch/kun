// 数据库类型定义

export type OldUserRole = 'leader' | 'market_staff' | 'data_clerk' | 'system_admin'
export type UserStatus = 'pending' | 'approved' | 'rejected'
export type UserPosition = '主要领导' | '分管领导' | '总经理助理' | '高级经理' | '一级职员' | '二级职员' | '三级职员'
export type JobLevel = '主要领导' | '分管领导' | '总经理助理' | '主任' | '经营人员'
export type PermissionType = 'menu' | 'operation' | 'data'

// 新的角色代码类型
export type RoleCode = 'super_admin' | 'company_leader' | 'business_center_staff' | 'data_clerk' | 'system_admin'

// 权限模块类型
export type PermissionModule = 
  | 'project_management'
  | 'task_management'
  | 'work_report'
  | 'customer_management'
  | 'bidding_management'
  | 'data_center'
  | 'user_management'
  | 'system_settings'
  | 'team_management'

// 职级选项
export const JobLevelOptions: JobLevel[] = [
  '主要领导',
  '分管领导',
  '总经理助理',
  '主任',
  '经营人员'
]

// 角色显示名称映射（旧版，保留兼容性）
export const RoleDisplayNames: Record<OldUserRole, string> = {
  leader: '公司领导',
  market_staff: '经营中心',
  data_clerk: '资料员',
  system_admin: '系统管理员'
}

// 新的角色显示名称映射
export const NewRoleDisplayNames: Record<RoleCode, string> = {
  super_admin: '超级管理员',
  company_leader: '公司领导',
  business_center_staff: '经营中心人员',
  data_clerk: '资料员',
  system_admin: '系统管理员'
}

// 权限模块显示名称映射
export const PermissionModuleNames: Record<PermissionModule, string> = {
  project_management: '项目管理',
  task_management: '任务管理',
  work_report: '工作汇报',
  customer_management: '客户管理',
  bidding_management: '投标管理',
  data_center: '数据中心',
  user_management: '用户管理',
  system_settings: '系统设置',
  team_management: '小组管理'
}

// 权限项接口
export interface Permission {
  id: string
  code: string
  name: string
  module: PermissionModule
  description: string | null
  created_at: string
  updated_at: string
}

// 角色接口
export interface Role {
  id: string
  code: RoleCode
  name: string
  description: string | null
  is_system: boolean
  is_active: boolean
  created_at: string
  updated_at: string
}

// 用户角色关联接口
export interface UserRole {
  id: string
  user_id: string
  role_id: string
  assigned_by: string | null
  assigned_at: string
}

// 角色权限关联接口
export interface RolePermission {
  id: string
  role_id: string
  permission_id: string
  created_at: string
}

// 自定义角色接口（保留兼容性）
export interface CustomRole {
  id: string
  code: string
  name: string
  description: string | null
  is_system: boolean
  is_active: boolean
  created_at: string
  updated_at: string
}

// 用户-角色关联接口
export interface UserRoleAssignment {
  id: string
  user_id: string
  role_id: string
  assigned_by: string | null
  assigned_at: string
}

// 审计日志接口
export interface AuditLog {
  id: string
  user_id: string | null
  action: string
  entity_type: string
  entity_id: string | null
  old_value: Record<string, unknown> | null
  new_value: Record<string, unknown> | null
  ip_address: string | null
  user_agent: string | null
  created_at: string
}

// 角色权限关联接口
export interface RolePermission {
  id: string
  role_id: string
  permission_id: string
  created_at: string
}
export type ReportStatus = 'draft' | 'pending_review' | 'reviewed' | 'rejected'
export type ProjectClassification = 'a_lock' | 'a_compete' | 'b_class' | 'c_class' | 'd_class'
export type ProjectStage = '方案设计' | '立项' | '可研' | '初步设计' | '施工图设计' | '招标控制价编制' | '招标文件编制' | '投标阶段' | '已中标' | '放弃跟踪'
export type BiddingStatus = 'pending' | 'won' | 'lost' | 'cooperation'
export type BiddingStage = 'registration' | 'document_preparation' | 'internal_review' | 'opening' | 'result_announcement'
export type StageStatus = 'pending' | 'in_progress' | 'completed'
export type TaskPriority = 'high' | 'medium' | 'low'
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'overdue'
export type ChartType = 'bar' | 'line' | 'pie' | 'table'
export type CustomerType = '政府' | '央企' | '省属' | '市属' | '区属' | '民企' | '上市公司'
export type CustomerClassification = '新客户' | '老客户'

export interface Profile {
  id: string
  phone: string | null
  name: string
  role: UserRole
  status: UserStatus
  position: UserPosition | null
  job_level: JobLevel | null
  department: string | null
  openid: string | null
  avatar_url: string | null
  signature: string | null
  custom_role_id: string | null
  approved_by: string | null
  approved_at: string | null
  rejection_reason: string | null
  created_at: string
  updated_at: string
}

export interface WeeklyReport {
  id: string
  user_id: string
  week_start_date: string
  week_end_date: string
  template_id?: string
  custom_fields?: Record<string, unknown>
  core_work: string
  project_progress: string
  bidding_work: string
  customer_contact: string
  next_week_plan: string
  issues: string | null
  attachments: unknown[]
  status: ReportStatus
  review_status: 'pending' | 'approved' | 'rejected'
  review_comment: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  user_reply: string | null
  replied_at: string | null
  created_at: string
  updated_at: string
}

export interface Project {
  id: string
  name: string
  classification: ProjectClassification
  construction_unit: string
  project_type: string
  investment_amount: number | null
  responsible_person_id: string
  stage: ProjectStage | null
  project_overview: string | null
  team_group: string | null
  expected_opening_date: string | null
  created_at: string
  updated_at: string
}

export interface AnnualTarget {
  id: string
  year: number
  target_amount: number
  description: string | null
  created_by: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
}

export interface ContactInfo {
  name: string
  position: string
  phone: string
  info_collection?: string
}

export interface Customer {
  id: string
  name: string
  type: CustomerType
  classification: CustomerClassification
  decision_contacts: ContactInfo[]
  influence_contacts: ContactInfo[]
  execution_contacts: ContactInfo[]
  supplier_info: string | null
  company_development: string | null
  cooperation_direction: string | null
  cooperation_history: string | null
  responsible_person_id: string | null
  created_at: string
  updated_at: string
}

export interface CustomerFollowUp {
  id: string
  customer_id: string
  follow_date: string
  follow_method: string
  content: string
  next_plan: string | null
  next_follow_date: string | null
  attachments: unknown[]
  user_id: string
  created_at: string
  profiles?: {
    name: string
  }
}

export interface ProjectFollowUp {
  id: string
  project_id: string
  user_id: string
  content: string
  stage: string | null
  attachments: unknown[]
  created_at: string
}

export interface BiddingInfo {
  id: string
  project_id: string
  bidding_unit: string
  bidding_limit: number | null
  opening_date: string | null
  project_type: string | null
  status: BiddingStatus
  result_amount: number | null
  result_reason: string | null
  result_document: string | null
  created_at: string
  updated_at: string
}

export interface BiddingProgress {
  id: string
  bidding_id: string
  stage: BiddingStage
  status: StageStatus
  attachments: unknown[]
  updated_at: string
}

export interface Task {
  id: string
  name: string
  type: string
  assigned_by: string
  responsible_person_id: string
  collaborators: string[]
  priority: TaskPriority
  deadline: string
  description: string
  related_project_id: string | null
  related_customer_id: string | null
  attachments: unknown[]
  status: TaskStatus
  progress: number
  completion_note: string | null
  confirmed_completed: boolean
  confirmed_by: string | null
  confirmed_at: string | null
  created_at: string
  updated_at: string
}

// 周报模板相关类型
export type TemplateFieldType = 'text' | 'textarea' | 'number' | 'date' | 'file'

export interface WeeklyReportTemplate {
  id: string
  name: string
  description: string | null
  is_default: boolean
  current_version: number
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface WeeklyReportTemplateField {
  id: string
  template_id: string
  field_name: string
  field_label: string
  field_type: TemplateFieldType
  is_required: boolean
  display_order: number
  placeholder: string | null
  created_at: string
}

export interface TemplateVersion {
  id: string
  template_id: string
  version_number: number
  version_name: string | null
  change_description: string
  template_snapshot: {
    name: string
    description: string | null
    is_default: boolean
  }
  created_by: string | null
  created_at: string
}

export interface TemplateVersionField {
  id: string
  version_id: string
  field_name: string
  field_label: string
  field_type: TemplateFieldType
  is_required: boolean
  display_order: number
  placeholder: string | null
  created_at: string
}

export interface DepartmentTemplateMapping {
  id: string
  department: string
  template_id: string
  created_at: string
}

export interface AnnualGoal {
  id: string
  year: number
  goal_type: string
  goal_content: string
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface Notification {
  id: string
  user_id: string
  type: string
  title: string
  content: string
  related_id: string | null
  related_type: string | null
  is_read: boolean
  created_at: string
}

export interface ModulePermission {
  id: string
  user_id: string
  module_name: string
  can_view: boolean
  can_create: boolean
  can_edit: boolean
  can_delete: boolean
  can_export: boolean
  created_at: string
  updated_at: string
}

export interface OperationLog {
  id: string
  user_id: string
  action: string
  module: string
  details: Record<string, unknown>
  ip_address: string | null
  created_at: string
}

export interface ReportConfig {
  id: string
  name: string
  data_sources: string[]
  dimensions: Record<string, unknown>
  metrics: Record<string, unknown>
  chart_type: ChartType
  filters: Record<string, unknown>
  created_by: string
  created_at: string
  updated_at: string
}

export interface FieldConfig {
  id: string
  module: string
  field_name: string
  field_type: string
  is_required: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

// 小组相关类型
export interface Team {
  id: string
  name: string
  description: string | null
  display_order: number
  contract_target: number
  contract_completed: number
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface TeamGoal {
  id: string
  team_id: string
  year: number
  goal_content: string
  progress: number
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface ReviewHistory {
  id: string
  report_id: string
  reviewer_id: string
  review_status: 'approved' | 'rejected'
  review_comment: string | null
  reviewed_at: string
  created_at: string
  reviewer?: {
    name: string
  }
}

export interface ReportTaskRelation {
  id: string
  report_id: string
  task_id: string
  created_by: string | null
  created_at: string
}

export interface JobLevelRoleMapping {
  id: string
  job_level: JobLevel
  role: UserRole
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface PermissionChangeLog {
  id: string
  user_id: string
  old_role: UserRole | null
  new_role: UserRole | null
  old_job_level: JobLevel | null
  new_job_level: JobLevel | null
  changed_by: string | null
  reason: string | null
  created_at: string
}

export interface UserTeam {
  id: string
  user_id: string
  team_id: string
  created_at: string
}

// 首页展示的本月计划开标项目
export interface HomeFeaturedBiddingProject {
  id: string
  project_id: string
  display_order: number
  created_by: string | null
  created_at: string
  updated_at: string
}

// 领导数据报表相关类型
export interface KPIIndicator {
  id: string
  name: string
  code: string
  category: string
  unit: string | null
  target_value: number | null
  warning_threshold: number | null
  description: string | null
  display_order: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface KPIData {
  id: string
  indicator_id: string
  value: number
  date: string
  period_type: string
  metadata: Record<string, any> | null
  created_at: string
}

export interface LeaderDashboard {
  id: string
  user_id: string
  name: string
  config: Record<string, any>
  is_default: boolean
  created_at: string
  updated_at: string
}

export interface ReportAlert {
  id: string
  indicator_id: string
  alert_type: string
  threshold: number | null
  current_value: number | null
  message: string | null
  triggered_at: string
  is_read: boolean
  read_at: string | null
  read_by: string | null
}

// 投标与中标信息类型
export interface Bid {
  id: string
  project_name: string
  bid_date: string
  bid_amount: number | null
  bid_result: 'pending' | 'won' | 'lost'
  won_amount: number | null
  won_date: string | null
  remarks: string | null
  attachments: Array<{name: string; url: string; size?: number}> | null
  created_by: string | null
  created_at: string
  updated_at: string
}

// 文档类型
export interface Document {
  id: string
  name: string
  category: string
  file_size: number
  file_path: string
  file_type: string
  uploaded_by: string | null
  created_at: string
  updated_at: string
}

// 项目内容相关类型
export interface ProjectContentTemplate {
  id: string
  name: string
  description: string | null
  fields_config: TemplateFieldConfig[]
  is_default: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface TemplateFieldConfig {
  name: string
  label: string
  type: 'text' | 'textarea' | 'number' | 'date'
  required: boolean
  placeholder?: string
}

export interface ProjectContent {
  id: string
  project_id: string
  template_id: string | null
  content_data: Record<string, string>
  attachments: string[]
  created_by: string | null
  created_at: string
  updated_at: string
}
