import {useState, useCallback, useEffect, useMemo} from 'react'
import Taro, {useDidShow} from '@tarojs/taro'
import {Picker} from '@tarojs/components'
import {withRouteGuard} from '@/components/RouteGuard'
import {useAuth} from '@/contexts/AuthContext'
import {getAllCustomers, getTeamCustomers, getCustomerLastFollowUpDate, getAllProfiles} from '@/db/api'
import {isLeaderOrAdmin} from '@/db/permissions-utils'
import type {Customer, CustomerType, CustomerClassification, ContactInfo} from '@/db/types'

function Customers() {
  const {profile} = useAuth()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)

  // Read URL params for pre-filtering from dashboard
  const routeParams = Taro.getCurrentInstance().router?.params || {}
  const initClassFilter = (routeParams.classification as CustomerClassification) || 'all'
  const initType = routeParams.type || ''

  const [selectedTypes, setSelectedTypes] = useState<CustomerType[]>(initType ? [initType as CustomerType] : [])
  const [classFilter, setClassFilter] = useState<CustomerClassification | 'all'>(initClassFilter)
  const [searchKeyword, setSearchKeyword] = useState('')
  const [lastFollowUpDates, setLastFollowUpDates] = useState<Record<string, string>>({})
  const [showTypeSelector, setShowTypeSelector] = useState(false) // 控制多选弹窗
  const [selectedResponsiblePersons, setSelectedResponsiblePersons] = useState<string[]>([]) // 负责人筛选
  const [showResponsiblePersonSelector, setShowResponsiblePersonSelector] = useState(false) // 负责人选择弹窗
  const [allUsers, setAllUsers] = useState<any[]>([]) // 所有用户列表

  const loadCustomers = useCallback(async () => {
    try {
      setLoading(true)
      
      // 加载用户列表
      const users = await getAllProfiles()
      setAllUsers(Array.isArray(users) ? users : [])
      
      const data = isLeaderOrAdmin(profile) ? await getAllCustomers() : await getTeamCustomers(profile?.id as string)
      setCustomers(Array.isArray(data) ? data : [])
      
      // 加载每个客户的最近跟进时间
      const dates: Record<string, string> = {}
      await Promise.all(
        data.map(async (customer: any) => {
          const lastDate = await getCustomerLastFollowUpDate(customer.id)
          if (lastDate) {
            dates[customer.id] = lastDate
          }
        })
      )
      setLastFollowUpDates(dates)
    } catch (error) {
      console.error('加载客户列表失败:', error)
      Taro.showToast({title: '加载失败', icon: 'none'})
    } finally {
      setLoading(false)
    }
  }, [])

  useDidShow(() => {
    loadCustomers()
  })

  useEffect(() => {
    loadCustomers()
  }, [loadCustomers])

  // 筛选客户
  const filteredCustomers = customers.filter((customer) => {
    // 多选类型筛选：如果有选中的类型，则客户类型必须在选中列表中
    if (selectedTypes.length > 0 && !selectedTypes.includes(customer.type)) return false
    if (classFilter !== 'all' && customer.classification !== classFilter) return false
    if (searchKeyword && !customer.name.includes(searchKeyword)) return false
    
    // 负责人筛选：如果有选中的负责人，则客户的负责人列表中必须包含至少一个选中的负责人
    if (selectedResponsiblePersons.length > 0) {
      const customerResponsibleIds = customer.responsible_person_ids || []
      const hasMatch = selectedResponsiblePersons.some((personId) => customerResponsibleIds.includes(personId))
      if (!hasMatch) return false
    }
    
    return true
  })

  const handleAddCustomer = () => {
    Taro.navigateTo({url: '/pages/customers/create/index'})
  }

  const handleViewCustomer = (id: string) => {
    Taro.navigateTo({url: `/pages/customers/detail/index?id=${id}`})
  }

  // 切换类型选择
  const toggleTypeSelection = (type: CustomerType) => {
    setSelectedTypes((prev) => {
      if (prev.includes(type)) {
        return prev.filter((t) => t !== type)
      } else {
        return [...prev, type]
      }
    })
  }

  // 清空类型选择
  const clearTypeSelection = () => {
    setSelectedTypes([])
  }

  // 移除单个类型标签
  const removeTypeTag = (type: CustomerType) => {
    setSelectedTypes((prev) => prev.filter((t) => t !== type))
  }

  // 切换负责人选择
  const toggleResponsiblePersonSelection = (userId: string) => {
    setSelectedResponsiblePersons((prev) => {
      if (prev.includes(userId)) {
        return prev.filter((id) => id !== userId)
      } else {
        return [...prev, userId]
      }
    })
  }

  // 清空负责人选择
  const clearResponsiblePersonSelection = () => {
    setSelectedResponsiblePersons([])
  }

  // 移除单个负责人标签
  const removeResponsiblePersonTag = (userId: string) => {
    setSelectedResponsiblePersons((prev) => prev.filter((id) => id !== userId))
  }

  const handleExport = async () => {
    try {
      Taro.showLoading({title: '准备导出数据...'})

      const XLSX = await import('xlsx')

      // Sheet 1: Customer list with all fields
      const exportData = filteredCustomers.map((customer) => {
        const decisionContactsStr = customer.decision_contacts
          ?.map((c: ContactInfo) => `${c.name}(${c.position}) ${c.phone}`)
          .join('; ')
        const influenceContactsStr = customer.influence_contacts
          ?.map((c: ContactInfo) => `${c.name}(${c.position}) ${c.phone}`)
          .join('; ')
        const executionContactsStr = customer.execution_contacts
          ?.map((c: ContactInfo) => `${c.name}(${c.position}) ${c.phone}`)
          .join('; ')
        const lastFollowUp = lastFollowUpDates[customer.id]
          ? new Date(lastFollowUpDates[customer.id]).toLocaleDateString('zh-CN')
          : ''

        return {
          客户名称: customer.name,
          客户类型: customer.type,
          客户分级: customer.classification,
          决策层联系人: decisionContactsStr || '',
          影响层联系人: influenceContactsStr || '',
          执行层联系人: executionContactsStr || '',
          合作供应商信息: customer.supplier_info || '',
          公司发展情况: customer.company_development || '',
          合作方向: customer.cooperation_direction || '',
          合作历史: customer.cooperation_history || '',
          最近跟进时间: lastFollowUp,
          创建时间: new Date(customer.created_at).toLocaleDateString('zh-CN')
        }
      })

      const wb = XLSX.utils.book_new()
      const ws1 = XLSX.utils.json_to_sheet(exportData)
      XLSX.utils.book_append_sheet(wb, ws1, '客户列表')

      // Sheet 2: Follow-up records
      const {getCustomerFollowUps} = await import('@/db/api')
      const followUpData: any[] = []
      for (const customer of filteredCustomers) {
        const records = await getCustomerFollowUps(customer.id)
        records.forEach((r: any) => {
          followUpData.push({
            客户名称: customer.name,
            跟进日期: r.follow_date ? new Date(r.follow_date).toLocaleDateString('zh-CN') : '',
            跟进方式: r.follow_method || '',
            跟进内容: r.content || '',
            下步计划: r.next_plan || '',
            下次跟进日期: r.next_follow_date ? new Date(r.next_follow_date).toLocaleDateString('zh-CN') : '',
            记录人: r.profiles?.name || ''
          })
        })
      }
      if (followUpData.length > 0) {
        const ws2 = XLSX.utils.json_to_sheet(followUpData)
        XLSX.utils.book_append_sheet(wb, ws2, '跟进记录')
      }

      // Generate Excel file
      const wbout = XLSX.write(wb, {bookType: 'xlsx', type: 'array'})
      const blob = new Blob([wbout], {type: 'application/octet-stream'})
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `客户列表_${new Date().toLocaleDateString('zh-CN').replace(/\//g, '')}.xlsx`
      link.click()
      URL.revokeObjectURL(url)

      Taro.hideLoading()
      Taro.showToast({title: '导出成功', icon: 'success'})
    } catch (error) {
      console.error('导出失败:', error)
      Taro.hideLoading()
      Taro.showToast({title: '导出失败', icon: 'none'})
    }
  }

  const getTypeColor = (type: CustomerType) => {
    const colors: Record<CustomerType, string> = {
      政府: 'text-primary',
      央企: 'text-success',
      省属: 'text-info',
      市属: 'text-info',
      区属: 'text-info',
      民企: 'text-warning',
      上市公司: 'text-destructive'
    }
    return colors[type] || 'text-foreground'
  }

  const getClassColor = (classification: CustomerClassification) => {
    const colors: Record<CustomerClassification, string> = {
      新客户: 'text-success',
      老客户: 'text-primary'
    }
    return colors[classification] || 'text-foreground'
  }

  const typeOptions: CustomerType[] = ['政府', '央企', '省属', '市属', '区属', '民企', '上市公司']
  const classOptions: CustomerClassification[] = ['新客户', '老客户']

  // 统计数据
  const stats = useMemo(() => {
    const total = customers.length
    const newCustomers = customers.filter((c) => c.classification === '新客户').length
    const oldCustomers = customers.filter((c) => c.classification === '老客户').length
    const typeStats = ['政府', '央企', '省属', '市属', '区属', '民企', '上市公司'].map((type) => ({
      type: type as CustomerType,
      count: customers.filter((c) => c.type === type).length
    }))
    return {total, newCustomers, oldCustomers, typeStats}
  }, [customers])

  return (
    <div className="min-h-screen bg-background pb-6">
      {/* 头部 */}
      <div className="bg-gradient-primary px-6 py-6">
        <div className="flex items-center justify-between mb-2">
          <div className="text-2xl text-primary-foreground font-bold">客户管理</div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => Taro.navigateTo({url: '/pages/customers/analytics/index'})}
              className="px-4 py-2 bg-primary-foreground/20 text-primary-foreground text-base rounded flex items-center gap-1 leading-none">
              <div className="i-mdi-chart-bar text-lg" />
              <span>分析</span>
            </button>
            <button
              type="button"
              onClick={handleExport}
              className="px-4 py-2 bg-primary-foreground/20 text-primary-foreground text-base rounded flex items-center gap-1 leading-none">
              <div className="i-mdi-download text-lg" />
              <span>导出</span>
            </button>
          </div>
        </div>
        <div className="text-base text-primary-foreground/80">客户档案与跟进记录</div>
      </div>
      {/* 统计看板 */}
      <div className="px-6 py-4 bg-card">
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div
            onClick={() => {
              clearTypeSelection()
              setClassFilter('all')
            }}
            className="bg-gradient-primary rounded p-4 flex flex-col items-center">
            <div className="text-3xl text-primary-foreground font-bold">{stats.total}</div>
            <div className="text-base text-primary-foreground/80 mt-1">客户总数</div>
          </div>
          <div
            onClick={() => setClassFilter('新客户')}
            className="bg-gradient-subtle rounded p-4 flex flex-col items-center">
            <div className="text-3xl text-success font-bold">{stats.newCustomers}</div>
            <div className="text-base text-muted-foreground mt-1">新客户</div>
          </div>
          <div
            onClick={() => setClassFilter('老客户')}
            className="bg-gradient-subtle rounded p-4 flex flex-col items-center">
            <div className="text-3xl text-primary font-bold">{stats.oldCustomers}</div>
            <div className="text-base text-muted-foreground mt-1">老客户</div>
          </div>
        </div>

        {/* 搜索框 */}
        <div className="mb-4">
          <div className="text-base text-muted-foreground mb-2">搜索客户</div>
          <div className="border-2 border-input rounded px-4 py-3 bg-background">
            <input
              type="text"
              value={searchKeyword}
              onInput={(e) => {
                const ev = e as unknown
                setSearchKeyword(
                  (ev as {detail?: {value?: string}}).detail?.value ??
                    (ev as {target?: {value?: string}}).target?.value ??
                    ''
                )
              }}
              placeholder="搜索客户名称"
              className="w-full text-xl text-foreground bg-transparent outline-none"
            />
          </div>
        </div>

        {/* 客户类型多选 */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-base text-muted-foreground">客户类型筛选</div>
            <button
              type="button"
              onClick={clearTypeSelection}
              className={`text-sm text-primary flex items-center gap-1 leading-none transition-opacity ${
                selectedTypes.length > 0 ? 'opacity-100' : 'opacity-0 pointer-events-none'
              }`}>
              <div className="i-mdi-close-circle text-base" />
              <span>清空</span>
            </button>
          </div>

          {/* 多选按钮 */}
          <button
            type="button"
            onClick={() => setShowTypeSelector(true)}
            className="w-full border-2 border-input rounded px-4 py-3 bg-background flex items-center justify-between">
            <span className="text-xl text-foreground">
              {selectedTypes.length === 0 ? '请选择客户类型' : `已选 ${selectedTypes.length} 项`}
            </span>
            <div className="i-mdi-chevron-down text-2xl text-muted-foreground" />
          </button>

          {/* 已选标签 */}
          <div 
            className={`flex flex-wrap gap-2 mt-3 transition-opacity ${
              selectedTypes.length > 0 ? 'opacity-100' : 'opacity-0 h-0 overflow-hidden'
            }`}>
            {selectedTypes.map((type) => (
              <div
                key={type}
                className="px-3 py-2 bg-primary/10 text-primary rounded flex items-center gap-2 leading-none">
                <span className="text-base">{type}</span>
                <button
                  type="button"
                  onClick={() => removeTypeTag(type)}
                  className="i-mdi-close text-lg flex items-center justify-center leading-none"
                />
              </div>
            ))}
          </div>
        </div>

        {/* 负责人筛选 */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-base text-muted-foreground">负责人筛选</div>
            <button
              type="button"
              onClick={clearResponsiblePersonSelection}
              className={`text-sm text-primary flex items-center gap-1 leading-none transition-opacity ${
                selectedResponsiblePersons.length > 0 ? 'opacity-100' : 'opacity-0 pointer-events-none'
              }`}>
              <div className="i-mdi-close-circle text-base" />
              <span>清空</span>
            </button>
          </div>

          {/* 多选按钮 */}
          <button
            type="button"
            onClick={() => setShowResponsiblePersonSelector(true)}
            className="w-full border-2 border-input rounded px-4 py-3 bg-background flex items-center justify-between">
            <span className="text-xl text-foreground">
              {selectedResponsiblePersons.length === 0 ? '请选择负责人' : `已选 ${selectedResponsiblePersons.length} 人`}
            </span>
            <div className="i-mdi-chevron-down text-2xl text-muted-foreground" />
          </button>

          {/* 已选标签 */}
          <div 
            className={`flex flex-wrap gap-2 mt-3 transition-opacity ${
              selectedResponsiblePersons.length > 0 ? 'opacity-100' : 'opacity-0 h-0 overflow-hidden'
            }`}>
            {selectedResponsiblePersons.map((userId) => {
              const user = allUsers.find((u) => u.id === userId)
              return (
                <div
                  key={userId}
                  className="px-3 py-2 bg-primary/10 text-primary rounded flex items-center gap-2 leading-none">
                  <span className="text-base">{user?.name || user?.phone || '未知用户'}</span>
                  <button
                    type="button"
                    onClick={() => removeResponsiblePersonTag(userId)}
                    className="i-mdi-close text-lg flex items-center justify-center leading-none"
                  />
                </div>
              )
            })}
          </div>
        </div>
      </div>
      {/* 筛选区 */}
      <div className="px-6 py-4 bg-card">
        {/* 分级筛选 */}
        <div>

          <Picker
            mode="selector"
            range={['全部', ...classOptions]}
            value={classFilter === 'all' ? 0 : classOptions.indexOf(classFilter) + 1}
            onChange={(e: any) => {
              const ev = e as unknown
              const value = (ev as {detail?: {value?: number}}).detail?.value ?? 0
              if (value === 0) {
                setClassFilter('all')
              } else {
                setClassFilter(classOptions[value - 1])
              }
            }}>

          </Picker>
        </div>
      </div>
      {/* 客户列表 */}
      <div className="px-6 mt-4">
        {loading ? (
          <div className="text-center py-12">
            <div className="text-xl text-muted-foreground">加载中...</div>
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="text-center py-12">
            <div className="i-mdi-account-group-outline text-6xl text-muted-foreground mb-4" />
            <div className="text-xl text-muted-foreground mb-4">暂无客户</div>
            <button
              type="button"
              onClick={handleAddCustomer}
              className="px-6 py-3 bg-primary text-primary-foreground text-xl rounded flex items-center justify-center leading-none mx-auto">
              <div className="i-mdi-plus text-2xl mr-2" />
              新增客户
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filteredCustomers.map((customer) => (
              <div
                key={customer.id}
                onClick={() => handleViewCustomer(customer.id)}
                className="bg-card rounded p-4 border border-border">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="text-xl text-foreground font-bold mb-1">{customer.name}</div>
                    <div className="flex items-center gap-2">
                      <span className={`text-base ${getTypeColor(customer.type)}`}>{customer.type}</span>
                      <span className="text-base text-muted-foreground">·</span>
                      <span className={`text-base ${getClassColor(customer.classification)}`}>{customer.classification}</span>
                    </div>
                  </div>
                </div>

                {/* 显示联系人数量 */}
                {(customer.decision_contacts?.length > 0 ||
                  customer.influence_contacts?.length > 0 ||
                  customer.execution_contacts?.length > 0) && (
                  <div className="flex items-center gap-4 mb-2">
                    {customer.decision_contacts?.length > 0 && (
                      <div className="flex items-center gap-1">
                        <div className="i-mdi-account-tie text-xl text-primary" />
                        <span className="text-base text-foreground">决策层 {customer.decision_contacts.length}人</span>
                      </div>
                    )}
                    {customer.influence_contacts?.length > 0 && (
                      <div className="flex items-center gap-1">
                        <div className="i-mdi-account-group text-xl text-success" />
                        <span className="text-base text-foreground">影响层 {customer.influence_contacts.length}人</span>
                      </div>
                    )}
                    {customer.execution_contacts?.length > 0 && (
                      <div className="flex items-center gap-1">
                        <div className="i-mdi-account text-xl text-info" />
                        <span className="text-base text-foreground">执行层 {customer.execution_contacts.length}人</span>
                      </div>
                    )}
                  </div>
                )}

                {customer.cooperation_direction && (
                  <div className="flex items-center gap-2 mb-2">
                    <div className="i-mdi-handshake text-xl text-muted-foreground" />
                    <span className="text-base text-muted-foreground line-clamp-1">{customer.cooperation_direction}</span>
                  </div>
                )}

                {/* 最近跟进时间 */}
                {lastFollowUpDates[customer.id] && (
                  <div className="flex items-center gap-2">
                    <div className="i-mdi-clock-outline text-xl text-muted-foreground" />
                    <span className="text-base text-muted-foreground">
                      最近跟进：{new Date(lastFollowUpDates[customer.id]).toLocaleDateString('zh-CN')}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      {/* 悬浮添加按钮 */}
      {filteredCustomers.length > 0 && (
        <div
          onClick={handleAddCustomer}
          className="fixed right-6 bottom-24 w-16 h-16 bg-primary rounded-full flex items-center justify-center"
          style={{boxShadow: 'var(--shadow-elegant)'}}>
          <div className="i-mdi-plus text-4xl text-primary-foreground" />
        </div>
      )}
      {/* 多选弹窗 - 始终渲染，用CSS控制显示 */}
      <div 
        className={`fixed inset-0 bg-black/50 flex items-end justify-center z-50 transition-opacity ${
          showTypeSelector ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}>
        <div 
          className={`bg-card rounded-t-2xl w-full max-h-[70vh] overflow-y-auto transition-transform ${
            showTypeSelector ? 'translate-y-0' : 'translate-y-full'
          }`}>
          {/* 弹窗头部 */}
          <div className="sticky top-0 bg-card border-b border-border px-6 py-4 flex items-center justify-between">
            <div className="text-xl text-foreground font-bold">选择客户类型</div>
            <button
              type="button"
              onClick={() => setShowTypeSelector(false)}
              className="text-2xl text-muted-foreground flex items-center justify-center leading-none">
              <div className="i-mdi-close" />
            </button>
          </div>

          {/* 选项列表 */}
          <div className="px-6 py-4">
            {typeOptions.map((type) => {
              const isSelected = selectedTypes.includes(type)
              const count = stats.typeStats.find((s) => s.type === type)?.count || 0
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => toggleTypeSelection(type)}
                  className="w-full flex items-center justify-between py-4 border-b border-border">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-6 h-6 rounded border-2 flex items-center justify-center ${
                        isSelected
                          ? 'bg-primary border-primary'
                          : 'bg-background border-input'
                      }`}>
                      {isSelected && <div className="i-mdi-check text-lg text-primary-foreground" />}
                    </div>
                    <span className="text-xl text-foreground">{type}</span>
                  </div>
                  <span className="text-base text-muted-foreground">({count})</span>
                </button>
              )
            })}
          </div>

          {/* 底部操作按钮 */}
          <div className="sticky bottom-0 bg-card border-t border-border px-6 py-4 flex gap-3">
            <button
              type="button"
              onClick={clearTypeSelection}
              className="flex-1 py-3 bg-muted text-foreground text-xl rounded flex items-center justify-center leading-none">
              清空选择
            </button>
            <button
              type="button"
              onClick={() => setShowTypeSelector(false)}
              className="flex-1 py-3 bg-primary text-primary-foreground text-xl rounded flex items-center justify-center leading-none">
              确定 ({selectedTypes.length})
            </button>
          </div>
        </div>
      </div>

      {/* 负责人多选弹窗 */}
      <div 
        className={`fixed inset-0 bg-black/50 flex items-end justify-center z-50 transition-opacity ${
          showResponsiblePersonSelector ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}>
        <div 
          className={`bg-card rounded-t-2xl w-full max-h-[70vh] overflow-y-auto transition-transform ${
            showResponsiblePersonSelector ? 'translate-y-0' : 'translate-y-full'
          }`}>
          {/* 弹窗头部 */}
          <div className="sticky top-0 bg-card border-b border-border px-6 py-4 flex items-center justify-between">
            <div className="text-xl text-foreground font-bold">选择负责人</div>
            <button
              type="button"
              onClick={() => setShowResponsiblePersonSelector(false)}
              className="text-2xl text-muted-foreground flex items-center justify-center leading-none">
              <div className="i-mdi-close" />
            </button>
          </div>

          {/* 选项列表 */}
          <div className="px-6 py-4">
            {allUsers.map((user) => {
              const isSelected = selectedResponsiblePersons.includes(user.id)
              return (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => toggleResponsiblePersonSelection(user.id)}
                  className="w-full flex items-center justify-between py-4 border-b border-border">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-6 h-6 rounded border-2 flex items-center justify-center ${
                        isSelected
                          ? 'bg-primary border-primary'
                          : 'bg-background border-input'
                      }`}>
                      {isSelected && <div className="i-mdi-check text-lg text-primary-foreground" />}
                    </div>
                    <span className="text-xl text-foreground">{user.name || user.phone || '未命名'}</span>
                  </div>
                </button>
              )
            })}
          </div>

          {/* 底部操作按钮 */}
          <div className="sticky bottom-0 bg-card border-t border-border px-6 py-4 flex gap-3">
            <button
              type="button"
              onClick={clearResponsiblePersonSelection}
              className="flex-1 py-3 bg-muted text-foreground text-xl rounded flex items-center justify-center leading-none">
              清空选择
            </button>
            <button
              type="button"
              onClick={() => setShowResponsiblePersonSelector(false)}
              className="flex-1 py-3 bg-primary text-primary-foreground text-xl rounded flex items-center justify-center leading-none">
              确定 ({selectedResponsiblePersons.length})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default withRouteGuard(Customers)
