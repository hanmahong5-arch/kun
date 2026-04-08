import * as XLSX from 'xlsx'
import {jsPDF} from 'jspdf'
import 'jspdf-autotable'

// 扩展jsPDF类型
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF
  }
}

export interface ExportProject {
  id: string
  name: string
  classification: string
  construction_unit: string
  project_type: string
  investment_amount: number | null
  stage: string
  responsible_person: string
  project_overview: string
  project_introduction: string
  created_at: string
  updated_at?: string
  project_address?: string
  contact_person?: string
  contact_phone?: string
  tracking_records?: Array<{
    content: string
    created_at: string
    creator_name: string
  }>
  bidding_info?: {
    bid_amount: number | null
    bid_date: string | null
    bid_result: string | null
  }
}

// 字段映射
const fieldMapping: Record<string, keyof ExportProject> = {
  '项目名称': 'name',
  '项目分级': 'classification',
  '建设单位': 'construction_unit',
  '工程类型': 'project_type',
  '投资规模': 'investment_amount',
  '项目阶段': 'stage',
  '负责人': 'responsible_person',
  '工程概况': 'project_overview',
  '项目简介': 'project_introduction',
  '创建时间': 'created_at',
  '更新时间': 'updated_at',
  '项目地址': 'project_address',
  '联系人': 'contact_person',
  '联系电话': 'contact_phone'
}

// 格式化字段值
const formatFieldValue = (field: string, value: any): string => {
  if (value === null || value === undefined) return ''
  
  if (field === '投资规模' && typeof value === 'number') {
    return `${value}万元`
  }
  
  if ((field === '创建时间' || field === '更新时间') && value) {
    return new Date(value).toLocaleDateString('zh-CN')
  }
  
  return String(value)
}

export const exportToExcel = (projects: ExportProject[], selectedFields?: string[]) => {
  // 创建工作簿
  const wb = XLSX.utils.book_new()

  // 使用选中的字段或默认字段
  const fields = selectedFields || [
    '项目名称',
    '项目分级',
    '建设单位',
    '工程类型',
    '投资规模',
    '项目阶段',
    '负责人',
    '创建时间'
  ]

  // 工作表1: 项目列表
  const projectListData = projects.map((p) => {
    const row: Record<string, string> = {}
    fields.forEach((field) => {
      const key = fieldMapping[field]
      if (key) {
        row[field] = formatFieldValue(field, p[key])
      }
    })
    return row
  })
  
  const ws1 = XLSX.utils.json_to_sheet(projectListData)
  XLSX.utils.book_append_sheet(wb, ws1, '项目列表')

  // 工作表2: 跟踪记录
  const trackingData: any[] = []
  projects.forEach((p) => {
    if (p.tracking_records && p.tracking_records.length > 0) {
      p.tracking_records.forEach((record) => {
        trackingData.push({
          项目名称: p.name,
          跟踪内容: record.content,
          记录人: record.creator_name,
          记录时间: new Date(record.created_at).toLocaleDateString('zh-CN')
        })
      })
    }
  })
  if (trackingData.length > 0) {
    const ws2 = XLSX.utils.json_to_sheet(trackingData)
    XLSX.utils.book_append_sheet(wb, ws2, '跟踪记录')
  }

  // 工作表3: 投标信息
  const biddingData = projects
    .filter((p) => p.bidding_info && p.bidding_info.bid_amount)
    .map((p) => ({
      项目名称: p.name,
      投标金额: p.bidding_info?.bid_amount ? `${p.bidding_info.bid_amount}万元` : '',
      投标日期: p.bidding_info?.bid_date ? new Date(p.bidding_info.bid_date).toLocaleDateString('zh-CN') : '',
      投标结果: p.bidding_info?.bid_result || ''
    }))
  if (biddingData.length > 0) {
    const ws3 = XLSX.utils.json_to_sheet(biddingData)
    XLSX.utils.book_append_sheet(wb, ws3, '投标信息')
  }

  // 生成Excel文件
  const wbout = XLSX.write(wb, {bookType: 'xlsx', type: 'array'})
  const blob = new Blob([wbout], {type: 'application/octet-stream'})
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `项目列表_${new Date().toLocaleDateString('zh-CN').replace(/\//g, '')}.xlsx`
  link.click()
  URL.revokeObjectURL(url)
}

export const exportToPDF = (projects: ExportProject[], selectedFields?: string[]) => {
  const doc = new jsPDF()

  // 添加中文字体支持（使用内置字体）
  doc.setFont('helvetica')

  // 使用选中的字段或默认字段
  const fields = selectedFields || [
    '项目名称',
    '项目分级',
    '建设单位',
    '工程类型',
    '投资规模',
    '项目阶段',
    '负责人',
    '创建时间'
  ]

  let yPosition = 20

  projects.forEach((project, index) => {
    if (index > 0) {
      doc.addPage()
      yPosition = 20
    }

    // 项目标题
    doc.setFontSize(16)
    doc.text(project.name, 20, yPosition)
    yPosition += 10

    // 项目详情表格 - 根据选中的字段生成
    const tableBody = fields
      .filter((field) => field !== '项目名称') // 项目名称已作为标题显示
      .map((field) => {
        const key = fieldMapping[field]
        const value = key ? formatFieldValue(field, project[key]) : ''
        return [field, value]
      })

    doc.autoTable({
      startY: yPosition,
      head: [['字段', '内容']],
      body: tableBody,
      theme: 'grid',
      styles: {fontSize: 10, font: 'helvetica'},
      headStyles: {fillColor: [66, 139, 202]}
    })

    yPosition = (doc as any).lastAutoTable.finalY + 10

    // 跟踪记录时间轴
    if (project.tracking_records && project.tracking_records.length > 0) {
      doc.setFontSize(14)
      doc.text('Tracking Records Timeline', 20, yPosition)
      yPosition += 10

      doc.autoTable({
        startY: yPosition,
        head: [['Time', 'Content', 'Creator']],
        body: project.tracking_records.map((record) => [
          new Date(record.created_at).toLocaleDateString('zh-CN'),
          record.content,
          record.creator_name
        ]),
        theme: 'striped',
        styles: {fontSize: 9, font: 'helvetica'},
        headStyles: {fillColor: [92, 184, 92]}
      })

      yPosition = (doc as any).lastAutoTable.finalY + 10
    }

    // 投标信息表格
    if (project.bidding_info && project.bidding_info.bid_amount) {
      doc.setFontSize(14)
      doc.text('Bidding Information', 20, yPosition)
      yPosition += 10

      doc.autoTable({
        startY: yPosition,
        head: [['Field', 'Content']],
        body: [
          ['Bid Amount', project.bidding_info.bid_amount ? `${project.bidding_info.bid_amount}万元` : ''],
          ['Bid Date', project.bidding_info.bid_date ? new Date(project.bidding_info.bid_date).toLocaleDateString('zh-CN') : ''],
          ['Bid Result', project.bidding_info.bid_result || '']
        ],
        theme: 'grid',
        styles: {fontSize: 10, font: 'helvetica'},
        headStyles: {fillColor: [217, 83, 79]}
      })
    }
  })

  // 保存PDF
  doc.save(`项目列表_${new Date().toLocaleDateString('zh-CN').replace(/\//g, '')}.pdf`)
}
