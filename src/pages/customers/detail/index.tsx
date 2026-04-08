import {useState, useCallback, useEffect, useMemo} from 'react'
import Taro, {useDidShow} from '@tarojs/taro'
import {useAuth} from '@/contexts/AuthContext'
import {getCustomerById, getCustomerFollowUps, createCustomerFollowUp, deleteCustomer} from '@/db/api'
import type {ContactInfo} from '@/db/types'

export default function CustomerDetail() {
  const {profile} = useAuth()
  const [loading, setLoading] = useState(true)
  const [customer, setCustomer] = useState<any>(null)
  const [followUps, setFollowUps] = useState<any[]>([])
  const [showFollowUpForm, setShowFollowUpForm] = useState(false)
  
  // 跟进记录表单
  const [followDate, setFollowDate] = useState('')
  const [followMethod, setFollowMethod] = useState('电话')
  const [content, setContent] = useState('')
  const [nextPlan, setNextPlan] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const customerId = useMemo(() => {
    const instance = Taro.getCurrentInstance()
    return instance.router?.params?.id || ''
  }, [])

  const loadData = useCallback(async () => {
    if (!customerId) return

    try {
      setLoading(true)
      const [customerData, followUpsData] = await Promise.all([
        getCustomerById(customerId),
        getCustomerFollowUps(customerId)
      ])
      setCustomer(customerData)
      setFollowUps(followUpsData)
    } catch (error) {
      console.error('加载客户详情失败:', error)
      Taro.showToast({title: '加载失败', icon: 'none'})
    } finally {
      setLoading(false)
    }
  }, [customerId])

  useDidShow(() => {
    loadData()
  })

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleEdit = () => {
    Taro.navigateTo({url: `/pages/customers/edit/index?id=${customerId}`})
  }

  const handleCall = (phone: string) => {
    Taro.makePhoneCall({phoneNumber: phone})
  }

  const handleDelete = async () => {
    if (!profile || !customer) return

    // 权限检查：仅管理员和客户负责人可以删除
    const isAdmin = profile.role === 'super_admin' || profile.role === 'system_admin' || profile.role === 'admin'
    const isResponsible = customer.responsible_person_id === profile.id
    
    if (!isAdmin && !isResponsible) {
      Taro.showToast({title: '无权限删除', icon: 'none'})
      return
    }

    Taro.showModal({
      title: '确认删除',
      content: '删除客户将同时删除所有跟进记录，此操作不可恢复，确定要删除吗？',
      success: async (res) => {
        if (res.confirm) {
          try {
            await deleteCustomer(customerId)
            Taro.showToast({title: '删除成功', icon: 'success'})
            setTimeout(() => {
              Taro.navigateBack()
            }, 1500)
          } catch (error) {
            console.error('删除客户失败:', error)
            Taro.showToast({title: '删除失败', icon: 'none'})
          }
        }
      }
    })
  }

  const handleSubmitFollowUp = async () => {
    if (!profile || !followDate || !content) {
      Taro.showToast({title: '请填写必填项', icon: 'none'})
      return
    }

    setSubmitting(true)
    try {
      await createCustomerFollowUp({
        customer_id: customerId,
        follow_date: followDate,
        follow_method: followMethod,
        content,
        next_plan: nextPlan || null,
        user_id: profile.id as string
      })

      Taro.showToast({title: '添加成功', icon: 'success'})
      setShowFollowUpForm(false)
      setFollowDate('')
      setFollowMethod('电话')
      setContent('')
      setNextPlan('')
      loadData()
    } catch (error) {
      console.error('添加跟进记录失败:', error)
      Taro.showToast({title: '添加失败', icon: 'none'})
    } finally {
      setSubmitting(false)
    }
  }

  const renderContactSection = (title: string, contacts: ContactInfo[], iconClass: string, colorClass: string) => {
    if (!contacts || contacts.length === 0) return null

    return (
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <div className={`${iconClass} text-2xl ${colorClass}`} />
          <span className="text-xl text-foreground font-bold">{title}</span>
          <span className="text-base text-muted-foreground">（{contacts.length}人）</span>
        </div>
        <div className="flex flex-col gap-3">
          {contacts.map((contact, index) => (
            <div key={index} className="bg-card rounded shadow-card p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xl text-foreground font-bold">{contact.name}</span>
                  {contact.position && (
                    <span className="text-base text-muted-foreground">· {contact.position}</span>
                  )}
                </div>
              </div>
              {contact.phone && (
                <div className="flex items-center gap-2 mb-2">
                  <div className="i-mdi-phone text-xl text-muted-foreground" />
                  <span
                    onClick={() => handleCall(contact.phone)}
                    className="text-xl text-primary underline">
                    {contact.phone}
                  </span>
                </div>
              )}
              {contact.info_collection && (
                <div className="mt-3 pt-3 border-t border-border">
                  <div className="text-base text-muted-foreground mb-1">信息收集</div>
                  <div className="text-xl text-foreground whitespace-pre-wrap">{contact.info_collection}</div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-xl text-muted-foreground">加载中...</div>
      </div>
    )
  }

  if (!customer) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-xl text-muted-foreground">客户不存在</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background pb-32">
      {/* 头部 */}
      <div className="bg-gradient-primary px-6 py-6">
        <div className="text-2xl text-primary-foreground font-bold">{customer.name}</div>
        <div className="flex items-center gap-2 mt-2">
          <span className="text-base text-primary-foreground/90">{customer.type}</span>
          <span className="text-base text-primary-foreground/70">·</span>
          <span className="text-base text-primary-foreground/90">{customer.classification}</span>
        </div>
      </div>

      <div className="px-6 py-6 flex flex-col gap-6">
        {/* 基本信息 */}
        <div className="bg-card rounded shadow-card p-4">
          <div className="text-xl text-foreground font-bold mb-4">基本信息</div>
          
          {customer.supplier_info && (
            <div className="mb-4">
              <div className="text-base text-muted-foreground mb-1">合作供应商信息</div>
              <div className="text-xl text-foreground whitespace-pre-wrap">{customer.supplier_info}</div>
            </div>
          )}

          {customer.company_development && (
            <div className="mb-4">
              <div className="text-base text-muted-foreground mb-1">公司发展情况</div>
              <div className="text-xl text-foreground whitespace-pre-wrap">{customer.company_development}</div>
            </div>
          )}

          {customer.cooperation_direction && (
            <div className="mb-4">
              <div className="text-base text-muted-foreground mb-1">合作方向</div>
              <div className="text-xl text-foreground whitespace-pre-wrap">{customer.cooperation_direction}</div>
            </div>
          )}

          {customer.cooperation_history && (
            <div>
              <div className="text-base text-muted-foreground mb-1">合作历史</div>
              <div className="text-xl text-foreground whitespace-pre-wrap">{customer.cooperation_history}</div>
            </div>
          )}
        </div>

        {/* 决策层联系人 */}
        {renderContactSection('决策层联系人', customer.decision_contacts, 'i-mdi-account-tie', 'text-primary')}

        {/* 影响层联系人 */}
        {renderContactSection('影响层联系人', customer.influence_contacts, 'i-mdi-account-group', 'text-success')}

        {/* 执行层联系人 */}
        {renderContactSection('执行层联系人', customer.execution_contacts, 'i-mdi-account', 'text-info')}

        {/* 跟进记录 */}
        <div>
          <div className="text-xl text-foreground font-bold mb-4">跟进记录</div>
          {followUps.length === 0 ? (
            <div className="text-center py-8 text-base text-muted-foreground">暂无跟进记录</div>
          ) : (
            <div className="flex flex-col gap-4">
              {followUps.map((followUp) => (
                <div key={followUp.id} className="bg-card rounded shadow-card p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-base text-primary font-bold">{followUp.profiles?.name || '未知用户'}</span>
                      <span className="text-base text-muted-foreground">·</span>
                      <span className="text-base text-muted-foreground">{followUp.follow_method}</span>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {new Date(followUp.follow_date).toLocaleDateString('zh-CN')}
                    </span>
                  </div>
                  <div className="text-xl text-foreground whitespace-pre-wrap mb-3">{followUp.content}</div>
                  {followUp.next_plan && (
                    <div className="pt-3 border-t border-border">
                      <div className="text-base text-muted-foreground mb-1">下次计划</div>
                      <div className="text-xl text-foreground whitespace-pre-wrap">{followUp.next_plan}</div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 底部按钮 */}
      <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border px-6 py-4 flex gap-3">
        {profile && (profile.role === 'super_admin' || profile.role === 'system_admin' || profile.role === 'admin' || customer.responsible_person_id === profile.id) && (
          <button
            type="button"
            onClick={handleDelete}
            className="px-6 py-4 bg-destructive text-destructive-foreground text-xl rounded flex items-center justify-center leading-none gap-2">
            <div className="i-mdi-delete text-2xl" />
            <span>删除</span>
          </button>
        )}
        <button
          type="button"
          onClick={handleEdit}
          className="flex-1 py-4 bg-card border-2 border-border text-foreground text-xl rounded flex items-center justify-center leading-none gap-2">
          <div className="i-mdi-pencil text-2xl" />
          <span>编辑</span>
        </button>
        <button
          type="button"
          onClick={() => setShowFollowUpForm(true)}
          className="flex-1 py-4 bg-primary text-primary-foreground text-xl rounded flex items-center justify-center leading-none gap-2">
          <div className="i-mdi-plus text-2xl" />
          <span>添加跟进</span>
        </button>
      </div>

      {/* 跟进记录表单弹窗 */}
      {showFollowUpForm && (
        <div className="fixed inset-0 bg-black/50 flex items-end z-50">
          <div className="bg-background w-full rounded-t-2xl max-h-[80vh] overflow-y-auto">
            <div className="sticky top-0 bg-background border-b border-border px-6 py-4 flex items-center justify-between">
              <span className="text-2xl text-foreground font-bold">添加跟进记录</span>
              <button
                type="button"
                onClick={() => setShowFollowUpForm(false)}
                className="i-mdi-close text-3xl text-muted-foreground"
              />
            </div>
            <div className="px-6 py-6 flex flex-col gap-4">
              {/* 跟进时间 */}
              <div>
                <div className="text-xl text-foreground mb-2">跟进时间 *</div>
                <div className="border-2 border-input rounded px-4 py-3 bg-card">
                  <input
                    type="date"
                    value={followDate}
                    onInput={(e) => {
                      const ev = e as unknown
                      setFollowDate(
                        (ev as {detail?: {value?: string}}).detail?.value ??
                          (ev as {target?: {value?: string}}).target?.value ??
                          ''
                      )
                    }}
                    className="w-full text-xl text-foreground bg-transparent outline-none"
                  />
                </div>
              </div>

              {/* 跟进方式 */}
              <div>
                <div className="text-xl text-foreground mb-2">跟进方式 *</div>
                <div className="flex gap-2 flex-wrap">
                  {['电话', '拜访', '微信', '邮件', '其他'].map((method) => (
                    <button
                      key={method}
                      type="button"
                      onClick={() => setFollowMethod(method)}
                      className={`px-4 py-2 text-xl rounded flex items-center justify-center leading-none ${
                        followMethod === method
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-card text-foreground border border-border'
                      }`}>
                      {method}
                    </button>
                  ))}
                </div>
              </div>

              {/* 跟进内容 */}
              <div>
                <div className="text-xl text-foreground mb-2">跟进内容 *</div>
                <div className="border-2 border-input rounded px-4 py-3 bg-card">
                  <textarea
                    value={content}
                    onInput={(e) => {
                      const ev = e as unknown
                      setContent(
                        (ev as {detail?: {value?: string}}).detail?.value ??
                          (ev as {target?: {value?: string}}).target?.value ??
                          ''
                      )
                    }}
                    placeholder="请输入跟进内容"
                    className="w-full text-xl text-foreground bg-transparent outline-none"
                    style={{minHeight: '120px'}}
                  />
                </div>
              </div>

              {/* 下次计划 */}
              <div>
                <div className="text-xl text-foreground mb-2">下次计划</div>
                <div className="border-2 border-input rounded px-4 py-3 bg-card">
                  <textarea
                    value={nextPlan}
                    onInput={(e) => {
                      const ev = e as unknown
                      setNextPlan(
                        (ev as {detail?: {value?: string}}).detail?.value ??
                          (ev as {target?: {value?: string}}).target?.value ??
                          ''
                      )
                    }}
                    placeholder="请输入下次计划"
                    className="w-full text-xl text-foreground bg-transparent outline-none"
                    style={{minHeight: '80px'}}
                  />
                </div>
              </div>

              {/* 提交按钮 */}
              <div className="flex gap-3 mt-4">
                <button
                  type="button"
                  onClick={() => setShowFollowUpForm(false)}
                  disabled={submitting}
                  className="flex-1 py-4 bg-card border-2 border-border text-foreground text-xl rounded flex items-center justify-center leading-none">
                  取消
                </button>
                <button
                  type="button"
                  onClick={handleSubmitFollowUp}
                  disabled={submitting}
                  className="flex-1 py-4 bg-primary text-primary-foreground text-xl rounded flex items-center justify-center leading-none">
                  {submitting ? '提交中...' : '提交'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
