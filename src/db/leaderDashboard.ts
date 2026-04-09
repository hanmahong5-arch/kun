import {supabase} from '@/client/supabase'
import type {KPIIndicator, KPIData, LeaderDashboard, ReportAlert} from './types'

/**
 * 获取所有KPI指标
 */
export async function getKPIIndicators(): Promise<KPIIndicator[]> {
  const {data, error} = await supabase
    .from('kpi_indicators')
    .select('*')
    .eq('is_active', true)
    .order('display_order', {ascending: true})

  if (error) {
    console.error('获取KPI指标失败:', error)
    throw error
  }

  return Array.isArray(data) ? data : []
}

/**
 * 获取指定KPI指标的最新数据
 */
export async function getLatestKPIData(indicatorId: string): Promise<KPIData | null> {
  const {data, error} = await supabase
    .from('kpi_data')
    .select('*')
    .eq('indicator_id', indicatorId)
    .order('date', {ascending: false})
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error('获取KPI数据失败:', error)
    throw error
  }

  return data
}

/**
 * 获取指定KPI指标的历史数据（最近N天）
 */
export async function getKPIDataHistory(
  indicatorId: string,
  days: number = 30
): Promise<KPIData[]> {
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)

  const {data, error} = await supabase
    .from('kpi_data')
    .select('*')
    .eq('indicator_id', indicatorId)
    .gte('date', startDate.toISOString().split('T')[0])
    .order('date', {ascending: true})

  if (error) {
    console.error('获取KPI历史数据失败:', error)
    throw error
  }

  return Array.isArray(data) ? data : []
}

/**
 * 获取所有KPI指标及其最新数据
 * Uses real business data from projects/customers/tasks/weekly_reports tables
 */
export async function getKPIIndicatorsWithLatestData(): Promise<
  Array<KPIIndicator & {latest_value?: number; latest_date?: string}>
> {
  // Try static KPI table first
  try {
    const indicators = await getKPIIndicators()
    if (indicators.length > 0) {
      const indicatorsWithData = await Promise.all(
        indicators.map(async (indicator) => {
          const latestData = await getLatestKPIData(indicator.id)
          return {
            ...indicator,
            latest_value: latestData?.value,
            latest_date: latestData?.date
          }
        })
      )
      // Check if any indicator has real data
      const hasData = indicatorsWithData.some(i => i.latest_value !== undefined)
      if (hasData) return indicatorsWithData
    }
  } catch {}

  // Fallback: compute from real business tables
  return computeKPIFromBusinessData()
}

/**
 * Compute KPI values from actual business data
 */
async function computeKPIFromBusinessData(): Promise<
  Array<KPIIndicator & {latest_value?: number; latest_date?: string}>
> {
  const today = new Date().toISOString().split('T')[0]
  const baseKPI = {
    is_active: true, display_order: 0,
    warning_threshold: null, description: null,
    created_at: today, updated_at: today
  }

  // Fetch all data in parallel
  const [projectsRes, customersRes, tasksRes, reportsRes] = await Promise.all([
    supabase.from('projects').select('id, stage, investment_amount'),
    supabase.from('customers').select('id, classification'),
    supabase.from('tasks').select('id, status'),
    supabase.from('weekly_reports').select('id, status')
  ])

  const projects = projectsRes.data || []
  const customers = customersRes.data || []
  const tasks = tasksRes.data || []
  const reports = reportsRes.data || []

  const wonProjects = projects.filter((p: any) => p.stage === '已中标')
  const totalContractAmount = projects.reduce((sum: number, p: any) => sum + (p.investment_amount || 0), 0)
  const wonContractAmount = wonProjects.reduce((sum: number, p: any) => sum + (p.investment_amount || 0), 0)
  const newCustomers = customers.filter((c: any) => c.classification === '新客户')
  const completedTasks = tasks.filter((t: any) => t.status === 'completed')
  const submittedReports = reports.filter((r: any) => r.status !== 'draft')

  return [
    // Financial / 中标指标
    {...baseKPI, id: 'f1', name: '合同总额', code: 'total_contract', category: 'financial',
      unit: '万元', target_value: null, latest_value: totalContractAmount, latest_date: today},
    {...baseKPI, id: 'f2', name: '已完成合同额', code: 'won_contract', category: 'financial',
      unit: '万元', target_value: null, latest_value: wonContractAmount, latest_date: today},
    // Project
    {...baseKPI, id: 'p1', name: '项目总数', code: 'total_projects', category: 'project',
      unit: '个', target_value: null, latest_value: projects.length, latest_date: today},
    {...baseKPI, id: 'p2', name: '中标项目数', code: 'won_projects', category: 'project',
      unit: '个', target_value: null, latest_value: wonProjects.length, latest_date: today},
    // Customer
    {...baseKPI, id: 'c1', name: '客户总数', code: 'total_customers', category: 'customer',
      unit: '个', target_value: null, latest_value: customers.length, latest_date: today},
    {...baseKPI, id: 'c2', name: '新增客户数', code: 'new_customers', category: 'customer',
      unit: '个', target_value: null, latest_value: newCustomers.length, latest_date: today},
    // Operation
    {...baseKPI, id: 'o1', name: '任务完成率', code: 'task_completion', category: 'operation',
      unit: '%', target_value: 100, latest_value: tasks.length > 0 ? Math.round((completedTasks.length / tasks.length) * 100) : 0, latest_date: today},
    {...baseKPI, id: 'o2', name: '周报提交率', code: 'report_submission', category: 'operation',
      unit: '%', target_value: 100, latest_value: reports.length > 0 ? Math.round((submittedReports.length / reports.length) * 100) : 0, latest_date: today},
  ]
}

/**
 * 获取用户的仪表盘配置
 */
export async function getUserDashboards(userId: string): Promise<LeaderDashboard[]> {
  const {data, error} = await supabase
    .from('leader_dashboards')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', {ascending: false})

  if (error) {
    console.error('获取仪表盘配置失败:', error)
    throw error
  }

  return Array.isArray(data) ? data : []
}

/**
 * 创建仪表盘配置
 */
export async function createDashboard(data: {
  user_id: string
  name: string
  config: Record<string, any>
  is_default?: boolean
}): Promise<LeaderDashboard | null> {
  const {data: result, error} = await supabase
    .from('leader_dashboards')
    .insert(data)
    .select()
    .maybeSingle()

  if (error) {
    console.error('创建仪表盘失败:', error)
    throw error
  }

  return result
}

/**
 * 更新仪表盘配置
 */
export async function updateDashboard(
  id: string,
  data: Partial<LeaderDashboard>
): Promise<void> {
  const {error} = await supabase
    .from('leader_dashboards')
    .update({...data, updated_at: new Date().toISOString()})
    .eq('id', id)

  if (error) {
    console.error('更新仪表盘失败:', error)
    throw error
  }
}

/**
 * 获取未读预警
 */
export async function getUnreadAlerts(): Promise<ReportAlert[]> {
  const {data, error} = await supabase
    .from('report_alerts')
    .select('*')
    .eq('is_read', false)
    .order('triggered_at', {ascending: false})
    .limit(50)

  if (error) {
    console.error('获取预警失败:', error)
    throw error
  }

  return Array.isArray(data) ? data : []
}

/**
 * 标记预警为已读
 */
export async function markAlertAsRead(alertId: string): Promise<void> {
  const userId = (await supabase.auth.getUser()).data.user?.id

  const {error} = await supabase
    .from('report_alerts')
    .update({
      is_read: true,
      read_at: new Date().toISOString(),
      read_by: userId
    })
    .eq('id', alertId)

  if (error) {
    console.error('标记预警已读失败:', error)
    throw error
  }
}

/**
 * 批量标记预警为已读
 */
export async function markAllAlertsAsRead(): Promise<void> {
  const userId = (await supabase.auth.getUser()).data.user?.id

  const {error} = await supabase
    .from('report_alerts')
    .update({
      is_read: true,
      read_at: new Date().toISOString(),
      read_by: userId
    })
    .eq('is_read', false)

  if (error) {
    console.error('批量标记预警已读失败:', error)
    throw error
  }
}

/**
 * 获取KPI数据统计（用于汇总报表）
 */
export async function getKPIStatistics(
  indicatorCode: string,
  startDate: string,
  endDate: string
): Promise<{
  total: number
  average: number
  max: number
  min: number
  count: number
}> {
  const {data: indicator} = await supabase
    .from('kpi_indicators')
    .select('id')
    .eq('code', indicatorCode)
    .maybeSingle()

  if (!indicator) {
    throw new Error('指标不存在')
  }

  const {data, error} = await supabase
    .from('kpi_data')
    .select('value')
    .eq('indicator_id', indicator.id)
    .gte('date', startDate)
    .lte('date', endDate)

  if (error) {
    console.error('获取KPI统计失败:', error)
    throw error
  }

  const values = (data || []).map((item) => item.value)

  return {
    total: values.reduce((sum, val) => sum + val, 0),
    average: values.length > 0 ? values.reduce((sum, val) => sum + val, 0) / values.length : 0,
    max: values.length > 0 ? Math.max(...values) : 0,
    min: values.length > 0 ? Math.min(...values) : 0,
    count: values.length
  }
}
