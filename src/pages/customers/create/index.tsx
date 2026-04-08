import {useState} from 'react'
import Taro from '@tarojs/taro'
import {Picker} from '@tarojs/components'
import {useAuth} from '@/contexts/AuthContext'
import {supabase} from '@/client/supabase'
import type {CustomerType, CustomerClassification, ContactInfo} from '@/db/types'

export default function CreateCustomer() {
  const {profile} = useAuth()
  const [loading, setLoading] = useState(false)

  // 基本信息
  const [name, setName] = useState('')
  const [type, setType] = useState<CustomerType>('政府')
  const [classification, setClassification] = useState<CustomerClassification>('新客户')
  const [supplierInfo, setSupplierInfo] = useState('')
  const [companyDevelopment, setCompanyDevelopment] = useState('')
  const [cooperationDirection, setCooperationDirection] = useState('')
  const [cooperationHistory, setCooperationHistory] = useState('')

  // 联系人信息
  const [decisionContacts, setDecisionContacts] = useState<ContactInfo[]>([])
  const [influenceContacts, setInfluenceContacts] = useState<ContactInfo[]>([])
  const [executionContacts, setExecutionContacts] = useState<ContactInfo[]>([])

  const typeOptions: CustomerType[] = ['政府', '央企', '省属', '市属', '区属', '民企', '上市公司']
  const classOptions: CustomerClassification[] = ['新客户', '老客户']

  // 添加联系人
  const addContact = (level: 'decision' | 'influence' | 'execution') => {
    const newContact: ContactInfo = {name: '', position: '', phone: '', info_collection: ''}
    if (level === 'decision') {
      setDecisionContacts([...decisionContacts, newContact])
    } else if (level === 'influence') {
      setInfluenceContacts([...influenceContacts, newContact])
    } else {
      setExecutionContacts([...executionContacts, newContact])
    }
  }

  // 删除联系人
  const removeContact = (level: 'decision' | 'influence' | 'execution', index: number) => {
    if (level === 'decision') {
      setDecisionContacts(decisionContacts.filter((_, i) => i !== index))
    } else if (level === 'influence') {
      setInfluenceContacts(influenceContacts.filter((_, i) => i !== index))
    } else {
      setExecutionContacts(executionContacts.filter((_, i) => i !== index))
    }
  }

  // 更新联系人信息
  const updateContact = (
    level: 'decision' | 'influence' | 'execution',
    index: number,
    field: keyof ContactInfo,
    value: string
  ) => {
    if (level === 'decision') {
      const updated = [...decisionContacts]
      updated[index] = {...updated[index], [field]: value}
      setDecisionContacts(updated)
    } else if (level === 'influence') {
      const updated = [...influenceContacts]
      updated[index] = {...updated[index], [field]: value}
      setInfluenceContacts(updated)
    } else {
      const updated = [...executionContacts]
      updated[index] = {...updated[index], [field]: value}
      setExecutionContacts(updated)
    }
  }

  const handleSubmit = async () => {
    if (!profile) return

    // 校验必填项
    if (!name || !type || !classification) {
      Taro.showToast({title: '请填写所有必填项', icon: 'none'})
      return
    }

    setLoading(true)
    try {
      const {error} = await supabase.from('customers').insert({
        name,
        type,
        classification,
        decision_contacts: decisionContacts,
        influence_contacts: influenceContacts,
        execution_contacts: executionContacts,
        supplier_info: supplierInfo || null,
        company_development: companyDevelopment || null,
        cooperation_direction: cooperationDirection || null,
        cooperation_history: cooperationHistory || null,
        responsible_person_id: profile.id
      })

      if (error) throw error

      Taro.showToast({title: '客户创建成功', icon: 'success'})
      setTimeout(() => {
        Taro.navigateBack()
      }, 1500)
    } catch (error) {
      console.error('创建客户失败:', error)
      Taro.showToast({title: '创建失败', icon: 'none'})
    } finally {
      setLoading(false)
    }
  }

  const renderContactSection = (
    title: string,
    level: 'decision' | 'influence' | 'execution',
    contacts: ContactInfo[]
  ) => (
    <div>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xl text-foreground font-bold">{title}</span>
        <button
          type="button"
          onClick={() => addContact(level)}
          className="px-4 py-2 bg-primary text-primary-foreground text-base rounded flex items-center gap-1 leading-none">
          <div className="i-mdi-plus text-lg" />
          <span>添加</span>
        </button>
      </div>
      {contacts.length === 0 ? (
        <div className="text-base text-muted-foreground text-center py-4">暂无联系人，点击上方"添加"按钮</div>
      ) : (
        <div className="flex flex-col gap-3">
          {contacts.map((contact, index) => (
            <div key={index} className="bg-card rounded shadow-card p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-base text-muted-foreground">联系人 {index + 1}</span>
                <button
                  type="button"
                  onClick={() => removeContact(level, index)}
                  className="text-destructive text-base flex items-center gap-1">
                  <div className="i-mdi-delete text-lg" />
                  <span>删除</span>
                </button>
              </div>
              <div className="flex flex-col gap-3">
                <div>
                  <div className="text-base text-muted-foreground mb-1">姓名</div>
                  <div className="border-2 border-input rounded px-4 py-2 bg-background">
                    <input
                      type="text"
                      value={contact.name}
                      onInput={(e) => {
                        const ev = e as unknown
                        updateContact(
                          level,
                          index,
                          'name',
                          (ev as {detail?: {value?: string}}).detail?.value ??
                            (ev as {target?: {value?: string}}).target?.value ??
                            ''
                        )
                      }}
                      placeholder="请输入姓名"
                      className="w-full text-xl text-foreground bg-transparent outline-none"
                    />
                  </div>
                </div>
                <div>
                  <div className="text-base text-muted-foreground mb-1">职务</div>
                  <div className="border-2 border-input rounded px-4 py-2 bg-background">
                    <input
                      type="text"
                      value={contact.position}
                      onInput={(e) => {
                        const ev = e as unknown
                        updateContact(
                          level,
                          index,
                          'position',
                          (ev as {detail?: {value?: string}}).detail?.value ??
                            (ev as {target?: {value?: string}}).target?.value ??
                            ''
                        )
                      }}
                      placeholder="请输入职务"
                      className="w-full text-xl text-foreground bg-transparent outline-none"
                    />
                  </div>
                </div>
                <div>
                  <div className="text-base text-muted-foreground mb-1">电话</div>
                  <div className="border-2 border-input rounded px-4 py-2 bg-background">
                    <input
                      type="tel"
                      value={contact.phone}
                      onInput={(e) => {
                        const ev = e as unknown
                        updateContact(
                          level,
                          index,
                          'phone',
                          (ev as {detail?: {value?: string}}).detail?.value ??
                            (ev as {target?: {value?: string}}).target?.value ??
                            ''
                        )
                      }}
                      placeholder="请输入电话"
                      className="w-full text-xl text-foreground bg-transparent outline-none"
                    />
                  </div>
                </div>
                <div>
                  <div className="text-base text-muted-foreground mb-1">信息收集</div>
                  <div className="border-2 border-input rounded px-4 py-2 bg-background">
                    <textarea
                      value={contact.info_collection || ''}
                      onInput={(e) => {
                        const ev = e as unknown
                        updateContact(
                          level,
                          index,
                          'info_collection',
                          (ev as {detail?: {value?: string}}).detail?.value ??
                            (ev as {target?: {value?: string}}).target?.value ??
                            ''
                        )
                      }}
                      placeholder="请输入信息收集内容"
                      className="w-full text-xl text-foreground bg-transparent outline-none"
                      style={{minHeight: '80px'}}
                    />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )

  return (
    <div className="min-h-screen bg-background pb-6">
      {/* 头部 */}
      <div className="bg-gradient-primary px-6 py-6">
        <div className="text-2xl text-primary-foreground font-bold">新增客户</div>
        <div className="text-base text-primary-foreground/80 mt-1">填写客户基本信息</div>
      </div>

      {/* 表单内容 */}
      <div className="px-6 py-6 flex flex-col gap-6">
        {/* 客户名称 */}
        <div>
          <div className="flex items-center gap-1 mb-2">
            <span className="text-xl text-foreground">客户名称（全称）</span>
            <span className="text-destructive">*</span>
          </div>
          <div className="border-2 border-input rounded px-4 py-3 bg-card">
            <input
              type="text"
              value={name}
              onInput={(e) => {
                const ev = e as unknown
                setName(
                  (ev as {detail?: {value?: string}}).detail?.value ??
                    (ev as {target?: {value?: string}}).target?.value ??
                    ''
                )
              }}
              placeholder="请输入客户全称（与企查查一致）"
              className="w-full text-xl text-foreground bg-transparent outline-none"
            />
          </div>
        </div>

        {/* 客户类型 */}
        <div>
          <div className="flex items-center gap-1 mb-2">
            <span className="text-xl text-foreground">客户类型</span>
            <span className="text-destructive">*</span>
          </div>
          <Picker
            mode="selector"
            range={typeOptions}
            value={typeOptions.indexOf(type)}
            onChange={(e: any) => {
              const ev = e as unknown
              const value = (ev as {detail?: {value?: number}}).detail?.value ?? 0
              setType(typeOptions[value])
            }}>
            <div className="border-2 border-input rounded px-4 py-3 bg-card flex items-center justify-between">
              <span className="text-xl text-foreground">{type}</span>
              <div className="i-mdi-chevron-down text-2xl text-muted-foreground" />
            </div>
          </Picker>
        </div>

        {/* 客户分级 */}
        <div>
          <div className="flex items-center gap-1 mb-2">
            <span className="text-xl text-foreground">客户分级</span>
            <span className="text-destructive">*</span>
          </div>
          <Picker
            mode="selector"
            range={classOptions}
            value={classOptions.indexOf(classification)}
            onChange={(e: any) => {
              const ev = e as unknown
              const value = (ev as {detail?: {value?: number}}).detail?.value ?? 0
              setClassification(classOptions[value])
            }}>
            <div className="border-2 border-input rounded px-4 py-3 bg-card flex items-center justify-between">
              <span className="text-xl text-foreground">{classification}</span>
              <div className="i-mdi-chevron-down text-2xl text-muted-foreground" />
            </div>
          </Picker>
        </div>

        {/* 决策层联系人 */}
        {renderContactSection('决策层联系人', 'decision', decisionContacts)}

        {/* 影响层联系人 */}
        {renderContactSection('影响层联系人', 'influence', influenceContacts)}

        {/* 执行层联系人 */}
        {renderContactSection('执行层联系人', 'execution', executionContacts)}

        {/* 合作供应商信息 */}
        <div>
          <div className="text-xl text-foreground mb-2">合作供应商信息</div>
          <div className="border-2 border-input rounded px-4 py-3 bg-card">
            <textarea
              value={supplierInfo}
              onInput={(e) => {
                const ev = e as unknown
                setSupplierInfo(
                  (ev as {detail?: {value?: string}}).detail?.value ??
                    (ev as {target?: {value?: string}}).target?.value ??
                    ''
                )
              }}
              placeholder="请输入合作供应商信息"
              className="w-full text-xl text-foreground bg-transparent outline-none"
              style={{minHeight: '100px'}}
            />
          </div>
        </div>

        {/* 公司发展情况 */}
        <div>
          <div className="text-xl text-foreground mb-2">公司发展情况</div>
          <div className="border-2 border-input rounded px-4 py-3 bg-card">
            <textarea
              value={companyDevelopment}
              onInput={(e) => {
                const ev = e as unknown
                setCompanyDevelopment(
                  (ev as {detail?: {value?: string}}).detail?.value ??
                    (ev as {target?: {value?: string}}).target?.value ??
                    ''
                )
              }}
              placeholder="请输入公司发展情况"
              className="w-full text-xl text-foreground bg-transparent outline-none"
              style={{minHeight: '100px'}}
            />
          </div>
        </div>

        {/* 合作方向 */}
        <div>
          <div className="text-xl text-foreground mb-2">合作方向</div>
          <div className="border-2 border-input rounded px-4 py-3 bg-card">
            <textarea
              value={cooperationDirection}
              onInput={(e) => {
                const ev = e as unknown
                setCooperationDirection(
                  (ev as {detail?: {value?: string}}).detail?.value ??
                    (ev as {target?: {value?: string}}).target?.value ??
                    ''
                )
              }}
              placeholder="请输入与此公司的合作方向"
              className="w-full text-xl text-foreground bg-transparent outline-none"
              style={{minHeight: '100px'}}
            />
          </div>
        </div>

        {/* 合作历史 */}
        <div>
          <div className="text-xl text-foreground mb-2">合作历史</div>
          <div className="border-2 border-input rounded px-4 py-3 bg-card">
            <textarea
              value={cooperationHistory}
              onInput={(e) => {
                const ev = e as unknown
                setCooperationHistory(
                  (ev as {detail?: {value?: string}}).detail?.value ??
                    (ev as {target?: {value?: string}}).target?.value ??
                    ''
                )
              }}
              placeholder="请输入合作历史"
              className="w-full text-xl text-foreground bg-transparent outline-none"
              style={{minHeight: '100px'}}
            />
          </div>
        </div>

        {/* 提交按钮 */}
        <div className="flex gap-3 mt-4">
          <button
            type="button"
            onClick={() => Taro.navigateBack()}
            disabled={loading}
            className="flex-1 py-4 bg-card border-2 border-border text-foreground text-xl rounded flex items-center justify-center leading-none">
            取消
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1 py-4 bg-primary text-primary-foreground text-xl rounded flex items-center justify-center leading-none">
            {loading ? '提交中...' : '提交'}
          </button>
        </div>
      </div>
    </div>
  )
}
