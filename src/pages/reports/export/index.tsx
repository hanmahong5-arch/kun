import {useState} from 'react'
import Taro from '@tarojs/taro'
import {useAuth} from '@/contexts/AuthContext'
import {supabase} from '@/client/supabase'
import * as XLSX from 'xlsx'

export default function ExportData() {
  const {profile} = useAuth()
  const [exporting, setExporting] = useState(false)
  const [exportType, setExportType] = useState<'weekly_reports' | 'projects' | 'customers'>('weekly_reports')

  // 周报导出参数
  const [reportMonth, setReportMonth] = useState('')

  // 项目导出参数
  const [projectClassification, setProjectClassification] = useState<'all' | 'a_lock' | 'a_compete' | 'b' | 'c' | 'd'>(
    'all'
  )

  // 客户导出参数
  const [customerType, setCustomerType] = useState<'all' | string>('all')

  const handleExportReports = async () => {
    if (!reportMonth) {
      Taro.showToast({title: '请选择导出月份', icon: 'none'})
      return
    }

    setExporting(true)
    try {
      // 计算月份的开始和结束日期
      const [year, month] = reportMonth.split('-')
      const startDate = `${year}-${month}-01`
      const endDate = new Date(parseInt(year), parseInt(month), 0).toISOString().split('T')[0]

      // 查询数据
      const {data, error} = await supabase
        .from('weekly_reports')
        .select(
          `
          *,
          profiles!weekly_reports_user_id_fkey(name, department)
        `
        )
        .gte('week_start_date', startDate)
        .lte('week_end_date', endDate)
        .order('created_at', {ascending: false})

      if (error) throw error

      if (!data || data.length === 0) {
        Taro.showToast({title: '该月份暂无周报数据', icon: 'none'})
        return
      }

      // 格式化数据
      const exportData = data.map((item: unknown) => {
        const report = item as {
          profiles?: {name?: string; department?: string}
          week_start_date: string
          week_end_date: string
          core_work: string
          project_progress: string
          bidding_work: string
          customer_contact: string
          next_week_plan: string
          issues: string | null
          status: string
          review_comment: string | null
          created_at: string
        }
        return {
          填报人: report.profiles?.name || '未知',
          所属部门: report.profiles?.department || '未知',
          填报周期: `${report.week_start_date} 至 ${report.week_end_date}`,
          本周核心工作: report.core_work,
          项目跟踪进展: report.project_progress,
          投标工作推进: report.bidding_work,
          客户对接情况: report.customer_contact,
          下周工作计划: report.next_week_plan,
          存在问题: report.issues || '',
          状态: report.status === 'approved' ? '已通过' : report.status === 'rejected' ? '已驳回' : '待审阅',
          审阅意见: report.review_comment || '',
          提交时间: new Date(report.created_at).toLocaleString('zh-CN')
        }
      })

      // 创建工作簿
      const ws = XLSX.utils.json_to_sheet(exportData)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, '周报数据')

      // 导出文件
      const fileName = `周报数据_${reportMonth}.xlsx`
      XLSX.writeFile(wb, fileName)

      Taro.showToast({title: '导出成功', icon: 'success'})
    } catch (error) {
      console.error('导出失败:', error)
      Taro.showToast({title: '导出失败', icon: 'none'})
    } finally {
      setExporting(false)
    }
  }

  const handleExportProjects = async () => {
    setExporting(true)
    try {
      let query = supabase
        .from('projects')
        .select(
          `
          *,
          profiles!projects_responsible_person_id_fkey(name)
        `
        )
        .order('created_at', {ascending: false})

      // 按分类筛选
      if (projectClassification !== 'all') {
        query = query.eq('classification', projectClassification)
      }

      const {data, error} = await query

      if (error) throw error

      if (!data || data.length === 0) {
        Taro.showToast({title: '暂无项目数据', icon: 'none'})
        return
      }

      // 格式化数据
      const exportData = data.map((item: unknown) => {
        const project = item as {
          profiles?: {name?: string}
          name: string
          classification: string
          construction_unit: string
          project_type: string
          investment_amount: number | null
          stage: string | null
          created_at: string
        }
        const classLabels: Record<string, string> = {
          a_lock: 'A锁项目',
          a_compete: 'A争项目',
          b: 'B类项目',
          c: 'C类项目',
          d: 'D类项目'
        }
        return {
          项目名称: project.name,
          项目分级: classLabels[project.classification] || project.classification,
          建设单位: project.construction_unit,
          工程类型: project.project_type,
          投资规模: project.investment_amount ? `${project.investment_amount}万元` : '',
          对接负责人: project.profiles?.name || '未知',
          项目阶段: project.stage || '',
          创建时间: new Date(project.created_at).toLocaleString('zh-CN')
        }
      })

      // 创建工作簿
      const ws = XLSX.utils.json_to_sheet(exportData)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, '项目数据')

      // 导出文件
      const classLabels: Record<string, string> = {
        all: '全部',
        a_lock: 'A锁',
        a_compete: 'A争',
        b: 'B类',
        c: 'C类',
        d: 'D类'
      }
      const fileName = `项目数据_${classLabels[projectClassification]}_${new Date().toISOString().split('T')[0]}.xlsx`
      XLSX.writeFile(wb, fileName)

      Taro.showToast({title: '导出成功', icon: 'success'})
    } catch (error) {
      console.error('导出失败:', error)
      Taro.showToast({title: '导出失败', icon: 'none'})
    } finally {
      setExporting(false)
    }
  }

  const handleExportCustomers = async () => {
    setExporting(true)
    try {
      let query = supabase
        .from('customers')
        .select(
          `
          *,
          profiles!customers_responsible_person_id_fkey(name)
        `
        )
        .order('created_at', {ascending: false})

      // 按类型筛选
      if (customerType !== 'all') {
        query = query.eq('type', customerType)
      }

      const {data, error} = await query

      if (error) throw error

      if (!data || data.length === 0) {
        Taro.showToast({title: '暂无客户数据', icon: 'none'})
        return
      }

      // 格式化数据
      const exportData = data.map((item: unknown) => {
        const customer = item as {
          profiles?: {name?: string}
          name: string
          type: string
          classification: string
          credit_code: string | null
          address: string | null
          contact_name: string | null
          contact_position: string | null
          contact_phone: string | null
          cooperation_history: string | null
          created_at: string
        }
        return {
          客户名称: customer.name,
          客户类型: customer.type,
          客户分级: customer.classification,
          统一社会信用代码: customer.credit_code || '',
          单位地址: customer.address || '',
          联系人姓名: customer.contact_name || '',
          联系人职务: customer.contact_position || '',
          联系电话: customer.contact_phone || '',
          合作历史: customer.cooperation_history || '',
          对接负责人: customer.profiles?.name || '未知',
          创建时间: new Date(customer.created_at).toLocaleString('zh-CN')
        }
      })

      // 创建工作簿
      const ws = XLSX.utils.json_to_sheet(exportData)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, '客户数据')

      // 导出文件
      const fileName = `客户数据_${new Date().toISOString().split('T')[0]}.xlsx`
      XLSX.writeFile(wb, fileName)

      Taro.showToast({title: '导出成功', icon: 'success'})
    } catch (error) {
      console.error('导出失败:', error)
      Taro.showToast({title: '导出失败', icon: 'none'})
    } finally {
      setExporting(false)
    }
  }

  const handleExport = () => {
    if (exportType === 'weekly_reports') {
      handleExportReports()
    } else if (exportType === 'projects') {
      handleExportProjects()
    } else if (exportType === 'customers') {
      handleExportCustomers()
    }
  }

  // 检查权限
  if (!profile || !['leader', 'system_admin'].includes(profile.role as string)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6">
        <div className="text-center">
          <div className="i-mdi-alert-circle text-6xl text-warning mb-4" />
          <div className="text-2xl text-foreground mb-2">权限不足</div>
          <div className="text-base text-muted-foreground">仅领导和管理员可以导出数据</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background pb-6">
      {/* 头部 */}
      <div className="bg-gradient-primary px-6 py-6">
        <div className="text-2xl text-primary-foreground font-bold">数据导出</div>
        <div className="text-base text-primary-foreground/80 mt-1">导出周报、项目、客户数据为Excel文件</div>
      </div>

      {/* 导出类型选择 */}
      <div className="px-6 py-6">
        <div className="text-xl text-foreground mb-3">选择导出类型</div>
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={() => setExportType('weekly_reports')}
            className={`px-6 py-4 text-xl rounded flex items-center justify-between leading-none ${
              exportType === 'weekly_reports'
                ? 'bg-primary text-primary-foreground'
                : 'bg-card text-foreground border border-border'
            }`}>
            <span>周报数据</span>
            {exportType === 'weekly_reports' && <div className="i-mdi-check text-2xl" />}
          </button>
          <button
            type="button"
            onClick={() => setExportType('projects')}
            className={`px-6 py-4 text-xl rounded flex items-center justify-between leading-none ${
              exportType === 'projects'
                ? 'bg-primary text-primary-foreground'
                : 'bg-card text-foreground border border-border'
            }`}>
            <span>项目数据</span>
            {exportType === 'projects' && <div className="i-mdi-check text-2xl" />}
          </button>
          <button
            type="button"
            onClick={() => setExportType('customers')}
            className={`px-6 py-4 text-xl rounded flex items-center justify-between leading-none ${
              exportType === 'customers'
                ? 'bg-primary text-primary-foreground'
                : 'bg-card text-foreground border border-border'
            }`}>
            <span>客户数据</span>
            {exportType === 'customers' && <div className="i-mdi-check text-2xl" />}
          </button>
        </div>
      </div>

      {/* 导出参数 */}
      <div className="px-6 pb-6">
        {exportType === 'weekly_reports' && (
          <div>
            <div className="text-xl text-foreground mb-3">选择导出月份</div>
            <div className="border-2 border-input rounded px-4 py-3 bg-card">
              <input
                type="month"
                value={reportMonth}
                onInput={(e) => {
                  const ev = e as unknown
                  setReportMonth(
                    (ev as {detail?: {value?: string}}).detail?.value ??
                      (ev as {target?: {value?: string}}).target?.value ??
                      ''
                  )
                }}
                className="w-full text-xl text-foreground bg-transparent outline-none"
              />
            </div>
          </div>
        )}

        {exportType === 'projects' && (
          <div>
            <div className="text-xl text-foreground mb-3">选择项目分类</div>
            <div className="flex flex-wrap gap-3">
              {[
                {value: 'all', label: '全部'},
                {value: 'a_lock', label: 'A锁项目'},
                {value: 'a_compete', label: 'A争项目'},
                {value: 'b', label: 'B类项目'},
                {value: 'c', label: 'C类项目'},
                {value: 'd', label: 'D类项目'}
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setProjectClassification(option.value as typeof projectClassification)}
                  className={`px-6 py-3 text-xl rounded flex items-center justify-center leading-none ${
                    projectClassification === option.value
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-card text-foreground border border-border'
                  }`}>
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {exportType === 'customers' && (
          <div>
            <div className="text-xl text-foreground mb-3">选择客户类型</div>
            <div className="flex flex-wrap gap-3">
              {[
                {value: 'all', label: '全部'},
                {value: '政府单位', label: '政府单位'},
                {value: '国有企业', label: '国有企业'},
                {value: '民营企业', label: '民营企业'},
                {value: '其他', label: '其他'}
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setCustomerType(option.value)}
                  className={`px-6 py-3 text-xl rounded flex items-center justify-center leading-none ${
                    customerType === option.value
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-card text-foreground border border-border'
                  }`}>
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 导出按钮 */}
        <button
          type="button"
          onClick={handleExport}
          disabled={exporting}
          className="w-full py-4 bg-primary text-primary-foreground text-xl rounded flex items-center justify-center leading-none mt-6">
          {exporting ? '导出中...' : '开始导出'}
        </button>
      </div>
    </div>
  )
}
