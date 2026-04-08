import {useState, useEffect, useCallback} from 'react'
import Taro from '@tarojs/taro'
import {useAuth} from '@/contexts/AuthContext'
import {supabase} from '@/client/supabase'

interface User {
  id: string
  name: string
  department: string | null
  role: string
}

interface Project {
  id: string
  name: string
}

interface Customer {
  id: string
  name: string
}

export default function AssignTask() {
  const {profile} = useAuth()
  const [loading, setLoading] = useState(false)
  const [users, setUsers] = useState<User[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])

  // 表单数据
  const [taskName, setTaskName] = useState('')
  const [taskType, setTaskType] = useState('')
  const [responsiblePersonId, setResponsiblePersonId] = useState('')
  const [collaborators, setCollaborators] = useState<string[]>([])
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium')
  const [deadline, setDeadline] = useState('')
  const [description, setDescription] = useState('')
  const [relatedProjectId, setRelatedProjectId] = useState('')
  const [relatedCustomerId, setRelatedCustomerId] = useState('')

  // 加载用户列表
  const loadUsers = useCallback(async () => {
    try {
      const {data, error} = await supabase
        .from('profiles')
        .select('id, name, department, role')
        .eq('status', 'approved')
        .order('name')

      if (error) throw error
      setUsers(data || [])
    } catch (error) {
      console.error('加载用户列表失败:', error)
    }
  }, [])

  // 加载项目列表
  const loadProjects = useCallback(async () => {
    try {
      const {data, error} = await supabase.from('projects').select('id, name').order('created_at', {ascending: false})

      if (error) throw error
      setProjects(data || [])
    } catch (error) {
      console.error('加载项目列表失败:', error)
    }
  }, [])

  // 加载客户列表
  const loadCustomers = useCallback(async () => {
    try {
      const {data, error} = await supabase.from('customers').select('id, name').order('created_at', {ascending: false})

      if (error) throw error
      setCustomers(data || [])
    } catch (error) {
      console.error('加载客户列表失败:', error)
    }
  }, [])

  useEffect(() => {
    loadUsers()
    loadProjects()
    loadCustomers()
  }, [loadUsers, loadProjects, loadCustomers])

  const handleSubmit = async () => {
    if (!profile) return

    // 校验必填项
    if (!taskName || !taskType || !responsiblePersonId || !deadline || !description) {
      Taro.showToast({title: '请填写所有必填项', icon: 'none'})
      return
    }

    setLoading(true)
    try {
      const {error} = await supabase.from('tasks').insert({
        name: taskName,
        type: taskType,
        assigned_by: profile.id,
        responsible_person_id: responsiblePersonId,
        collaborators: collaborators.length > 0 ? collaborators : null,
        priority,
        deadline: new Date(deadline).toISOString(),
        description,
        related_project_id: relatedProjectId || null,
        related_customer_id: relatedCustomerId || null,
        status: 'pending',
        progress: 0
      })

      if (error) throw error

      Taro.showToast({title: '任务指派成功', icon: 'success'})
      setTimeout(() => {
        Taro.navigateBack()
      }, 1500)
    } catch (error) {
      console.error('指派任务失败:', error)
      Taro.showToast({title: '指派失败', icon: 'none'})
    } finally {
      setLoading(false)
    }
  }

  // 检查权限
  if (!profile || !['leader', 'system_admin'].includes(profile.role as string)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6">
        <div className="text-center">
          <div className="i-mdi-alert-circle text-6xl text-warning mb-4" />
          <div className="text-2xl text-foreground mb-2">权限不足</div>
          <div className="text-base text-muted-foreground">仅领导和管理员可以指派任务</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background pb-6">
      {/* 头部 */}
      <div className="bg-gradient-primary px-6 py-6">
        <div className="text-2xl text-primary-foreground font-bold">任务指派</div>
        <div className="text-base text-primary-foreground/80 mt-1">为团队成员指派工作任务</div>
      </div>

      {/* 表单内容 */}
      <div className="px-6 py-6 flex flex-col gap-6">
        {/* 任务名称 */}
        <div>
          <div className="flex items-center gap-1 mb-2">
            <span className="text-xl text-foreground">任务名称</span>
            <span className="text-destructive">*</span>
          </div>
          <div className="border-2 border-input rounded px-4 py-3 bg-card">
            <input
              type="text"
              value={taskName}
              onInput={(e) => {
                const ev = e as unknown
                setTaskName(
                  (ev as {detail?: {value?: string}}).detail?.value ??
                    (ev as {target?: {value?: string}}).target?.value ??
                    ''
                )
              }}
              placeholder="请输入任务名称"
              className="w-full text-xl text-foreground bg-transparent outline-none"
            />
          </div>
        </div>

        {/* 任务类型 */}
        <div>
          <div className="flex items-center gap-1 mb-2">
            <span className="text-xl text-foreground">任务类型</span>
            <span className="text-destructive">*</span>
          </div>
          <div className="border-2 border-input rounded px-4 py-3 bg-card">
            <input
              type="text"
              value={taskType}
              onInput={(e) => {
                const ev = e as unknown
                setTaskType(
                  (ev as {detail?: {value?: string}}).detail?.value ??
                    (ev as {target?: {value?: string}}).target?.value ??
                    ''
                )
              }}
              placeholder="如：项目跟进、客户拜访、投标准备等"
              className="w-full text-xl text-foreground bg-transparent outline-none"
            />
          </div>
        </div>

        {/* 责任人 */}
        <div>
          <div className="flex items-center gap-1 mb-2">
            <span className="text-xl text-foreground">责任人</span>
            <span className="text-destructive">*</span>
          </div>
          <div className="border-2 border-input rounded px-4 py-3 bg-card">
            <select
              value={responsiblePersonId}
              onChange={(e) => setResponsiblePersonId(e.target.value)}
              className="w-full text-xl text-foreground bg-transparent outline-none">
              <option value="">请选择责任人</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name} - {user.department || '未知部门'}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 优先级 */}
        <div>
          <div className="flex items-center gap-1 mb-2">
            <span className="text-xl text-foreground">优先级</span>
            <span className="text-destructive">*</span>
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setPriority('low')}
              className={`flex-1 py-3 text-xl rounded flex items-center justify-center leading-none ${
                priority === 'low' ? 'bg-primary text-primary-foreground' : 'bg-card text-foreground border border-border'
              }`}>
              低
            </button>
            <button
              type="button"
              onClick={() => setPriority('medium')}
              className={`flex-1 py-3 text-xl rounded flex items-center justify-center leading-none ${
                priority === 'medium'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-card text-foreground border border-border'
              }`}>
              中
            </button>
            <button
              type="button"
              onClick={() => setPriority('high')}
              className={`flex-1 py-3 text-xl rounded flex items-center justify-center leading-none ${
                priority === 'high' ? 'bg-primary text-primary-foreground' : 'bg-card text-foreground border border-border'
              }`}>
              高
            </button>
          </div>
        </div>

        {/* 截止时间 */}
        <div>
          <div className="flex items-center gap-1 mb-2">
            <span className="text-xl text-foreground">截止时间</span>
            <span className="text-destructive">*</span>
          </div>
          <div className="border-2 border-input rounded px-4 py-3 bg-card">
            <input
              type="datetime-local"
              value={deadline}
              onInput={(e) => {
                const ev = e as unknown
                setDeadline(
                  (ev as {detail?: {value?: string}}).detail?.value ??
                    (ev as {target?: {value?: string}}).target?.value ??
                    ''
                )
              }}
              className="w-full text-xl text-foreground bg-transparent outline-none"
            />
          </div>
        </div>

        {/* 任务描述 */}
        <div>
          <div className="flex items-center gap-1 mb-2">
            <span className="text-xl text-foreground">任务描述</span>
            <span className="text-destructive">*</span>
          </div>
          <div className="border-2 border-input rounded px-4 py-3 bg-card">
            <textarea
              value={description}
              onInput={(e) => {
                const ev = e as unknown
                setDescription(
                  (ev as {detail?: {value?: string}}).detail?.value ??
                    (ev as {target?: {value?: string}}).target?.value ??
                    ''
                )
              }}
              placeholder="请详细描述任务要求和目标"
              className="w-full text-xl text-foreground bg-transparent outline-none"
              style={{minHeight: '120px'}}
            />
          </div>
        </div>

        {/* 关联项目 */}
        <div>
          <div className="text-xl text-foreground mb-2">关联项目（可选）</div>
          <div className="border-2 border-input rounded px-4 py-3 bg-card">
            <select
              value={relatedProjectId}
              onChange={(e) => setRelatedProjectId(e.target.value)}
              className="w-full text-xl text-foreground bg-transparent outline-none">
              <option value="">无关联项目</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 关联客户 */}
        <div>
          <div className="text-xl text-foreground mb-2">关联客户（可选）</div>
          <div className="border-2 border-input rounded px-4 py-3 bg-card">
            <select
              value={relatedCustomerId}
              onChange={(e) => setRelatedCustomerId(e.target.value)}
              className="w-full text-xl text-foreground bg-transparent outline-none">
              <option value="">无关联客户</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 提交按钮 */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={loading}
          className="w-full py-4 bg-primary text-primary-foreground text-xl rounded flex items-center justify-center leading-none mt-4">
          {loading ? '指派中...' : '指派任务'}
        </button>
      </div>
    </div>
  )
}
