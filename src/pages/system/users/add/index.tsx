import {useState, useCallback, useEffect} from 'react'
import Taro from '@tarojs/taro'
import {withRouteGuard} from '@/components/RouteGuard'
import {useAuth} from '@/contexts/AuthContext'
import {supabase} from '@/client/supabase'
import type {Team, JobLevel} from '@/db/types'
import {JobLevelOptions} from '@/db/types'

interface Role {
  id: string
  code: string
  name: string
  description: string
}

/**
 * 添加用户页面
 * 
 * 功能说明：
 * 1. 系统管理员可以创建新用户账号
 * 2. 新用户创建后状态为"已激活"，可立即登录
 * 3. 支持设置初始密码（默认密码或随机密码）
 * 4. 支持多角色分配
 * 5. 支持小组分配
 * 
 * 权限要求：
 * - 只有系统管理员（system_admin）可以访问此页面
 */
function AddUser() {
  const {profile} = useAuth()
  
  // ========== 表单状态 ==========
  const [phone, setPhone] = useState('')
  const [name, setName] = useState('')
  const [selectedRoles, setSelectedRoles] = useState<string[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [jobLevel, setJobLevel] = useState<JobLevel | ''>('')
  const [department, setDepartment] = useState('')
  const [selectedTeams, setSelectedTeams] = useState<string[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  
  // ========== 密码设置 ==========
  const [passwordType, setPasswordType] = useState<'default' | 'custom' | 'random'>('default')
  const [customPassword, setCustomPassword] = useState('')
  const [generatedPassword, setGeneratedPassword] = useState('')
  
  // ========== UI状态 ==========
  const [loading, setLoading] = useState(false)
  const [showRoleSelector, setShowRoleSelector] = useState(false)
  const [showTeamSelector, setShowTeamSelector] = useState(false)

  /**
   * 加载角色列表
   * 从roles表中获取所有激活的角色
   */
  const loadRoles = useCallback(async () => {
    try {
      const {data, error} = await supabase
        .from('roles')
        .select('*')
        .eq('is_active', true)
        .order('created_at')

      if (error) throw error

      setRoles(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('加载角色失败:', error)
    }
  }, [])

  /**
   * 加载小组列表
   * 从teams表中获取所有小组
   */
  const loadTeams = useCallback(async () => {
    try {
      const {data, error} = await supabase.from('teams').select('*').order('display_order')

      if (error) throw error

      setTeams(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('加载小组失败:', error)
    }
  }, [])

  useEffect(() => {
    loadRoles()
    loadTeams()
  }, [loadRoles, loadTeams])

  /**
   * 提交表单，创建新用户
   * 
   * 流程：
   * 1. 验证表单数据
   * 2. 调用Edge Function创建用户
   * 3. 显示结果并返回列表页
   * 
   * 关键点：
   * - 用户创建后状态为approved，可立即登录
   * - 如果使用随机密码，会返回生成的密码
   */
  const handleSubmit = async () => {
    // ========== 表单验证 ==========
    
    if (!phone || phone.length !== 11) {
      Taro.showToast({title: '请输入正确的手机号', icon: 'none'})
      return
    }
    if (!name) {
      Taro.showToast({title: '请输入姓名', icon: 'none'})
      return
    }
    if (selectedRoles.length === 0) {
      Taro.showToast({title: '请至少选择一个角色', icon: 'none'})
      return
    }
    if (passwordType === 'custom' && (!customPassword || customPassword.length < 6)) {
      Taro.showToast({title: '自定义密码长度不能少于6位', icon: 'none'})
      return
    }

    setLoading(true)
    try {
      // ========== 构造请求参数 ==========
      
      const requestBody: {
        phone: string
        name: string
        role_ids: string[]
        job_level: string | null
        department: string | null
        team_ids: string[]
        password?: string
        use_random_password?: boolean
      } = {
        phone,
        name,
        role_ids: selectedRoles,
        job_level: jobLevel || null,
        department: department || null,
        team_ids: selectedTeams
      }

      // 根据密码类型设置参数
      if (passwordType === 'custom') {
        requestBody.password = customPassword
      } else if (passwordType === 'random') {
        requestBody.use_random_password = true
      }
      // passwordType === 'default' 时不传密码参数，使用Edge Function的默认密码

      // ========== 调用Edge Function创建用户 ==========
      
      const {data, error} = await supabase.functions.invoke('create-user', {
        body: requestBody
      })

      if (error) {
        const errorMsg = await error?.context?.text?.()
        console.error('创建用户失败:', errorMsg || error?.message)
        throw new Error(errorMsg || error?.message || '创建用户失败')
      }

      if (!data?.success) {
        throw new Error(data?.error || '创建用户失败')
      }

      // ========== 处理返回结果 ==========
      
      // 如果使用随机密码，保存生成的密码并显示
      if (passwordType === 'random' && data.password) {
        setGeneratedPassword(data.password)
        Taro.showModal({
          title: '用户创建成功',
          content: `随机密码：${data.password}\n\n请将此密码告知用户，用户可登录后修改密码。`,
          showCancel: false,
          confirmText: '我已记录',
          success: () => {
            setTimeout(() => {
              Taro.navigateBack()
            }, 500)
          }
        })
      } else {
        // 默认密码或自定义密码
        Taro.showToast({title: '添加成功，用户可立即登录', icon: 'success'})
        setTimeout(() => {
          Taro.navigateBack()
        }, 1500)
      }
    } catch (error: unknown) {
      console.error('添加用户失败:', error)
      const err = error as Error
      Taro.showToast({
        title: err.message || '添加失败',
        icon: 'none',
        duration: 3000
      })
    } finally {
      setLoading(false)
    }
  }

  // 检查权限（超级管理员和系统管理员均可访问）
  if (!profile || (profile.role !== 'system_admin' && profile.role !== 'super_admin')) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6">
        <div className="text-center">
          <div className="i-mdi-lock text-6xl text-muted-foreground mb-4" />
          <div className="text-2xl text-foreground mb-2">无权限访问</div>
          <div className="text-base text-muted-foreground">仅系统管理员可访问此页面</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* 头部 */}
      <div className="bg-gradient-primary px-6 py-8">
        <div className="text-3xl text-primary-foreground font-bold mb-2">添加用户</div>
        <div className="text-base text-primary-foreground/80">添加新用户账号</div>
      </div>
      {/* 表单 */}
      <div className="px-6 py-6">
        <div className="flex flex-col gap-4">
          {/* 手机号 */}
          <div>
            <div className="flex items-center gap-1 mb-2">
              <span className="text-xl text-foreground">手机号</span>
              <span className="text-destructive">*</span>
            </div>
            <div className="border-2 border-input rounded px-4 py-3 bg-card overflow-hidden">
              <input
                type="tel"
                value={phone}
                onInput={(e) => {
                  const ev = e as unknown
                  setPhone(
                    (ev as {detail?: {value?: string}}).detail?.value ??
                      (ev as {target?: {value?: string}}).target?.value ??
                      ''
                  )
                }}
                placeholder="请输入11位手机号"
                maxLength={11}
                className="w-full text-xl text-foreground bg-transparent outline-none"
              />
            </div>
          </div>

          {/* 姓名 */}
          <div>
            <div className="flex items-center gap-1 mb-2">
              <span className="text-xl text-foreground">姓名</span>
              <span className="text-destructive">*</span>
            </div>
            <div className="border-2 border-input rounded px-4 py-3 bg-card overflow-hidden">
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
                placeholder="请输入姓名"
                className="w-full text-xl text-foreground bg-transparent outline-none"
              />
            </div>
          </div>

          {/* 角色 */}
          <div>
            <div className="flex items-center gap-1 mb-2">
              <span className="text-xl text-foreground">角色</span>
              <span className="text-destructive">*</span>
            </div>
            <button
              type="button"
              onClick={() => setShowRoleSelector(true)}
              className="w-full border-2 border-input rounded px-4 py-3 bg-card text-left flex items-center justify-between">
              <span className="text-xl text-foreground">
                {selectedRoles.length > 0
                  ? `已选择 ${selectedRoles.length} 个角色`
                  : '请选择角色'}
              </span>
              <div className="i-mdi-chevron-down text-2xl text-muted-foreground" />
            </button>
            {selectedRoles.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {selectedRoles.map((roleId) => {
                  const role = roles.find((r) => r.id === roleId)
                  return role ? (
                    <div
                      key={roleId}
                      className="px-3 py-1 bg-primary/10 text-primary rounded flex items-center gap-2">
                      <span className="text-base">{role.name}</span>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedRoles(selectedRoles.filter((id) => id !== roleId))
                        }}
                        className="i-mdi-close text-lg"
                      />
                    </div>
                  ) : null
                })}
              </div>
            )}
          </div>

          {/* 初始密码设置 */}
          <div>
            <div className="flex items-center gap-1 mb-2">
              <span className="text-xl text-foreground">初始密码</span>
              <span className="text-destructive">*</span>
            </div>
            
            {/* 密码类型选择 */}
            <div className="flex flex-col gap-2 mb-3">
              <button
                type="button"
                onClick={() => setPasswordType('default')}
                className={`w-full border-2 rounded px-4 py-3 text-left flex items-center gap-3 ${
                  passwordType === 'default'
                    ? 'border-primary bg-primary/10'
                    : 'border-input bg-card'
                }`}>
                <div
                  className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                    passwordType === 'default' ? 'border-primary' : 'border-input'
                  }`}>
                  {passwordType === 'default' && (
                    <div className="w-3 h-3 rounded-full bg-primary" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="text-xl text-foreground">默认密码</div>
                  <div className="text-sm text-muted-foreground">使用系统默认密码：123456</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setPasswordType('custom')}
                className={`w-full border-2 rounded px-4 py-3 text-left flex items-center gap-3 ${
                  passwordType === 'custom'
                    ? 'border-primary bg-primary/10'
                    : 'border-input bg-card'
                }`}>
                <div
                  className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                    passwordType === 'custom' ? 'border-primary' : 'border-input'
                  }`}>
                  {passwordType === 'custom' && (
                    <div className="w-3 h-3 rounded-full bg-primary" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="text-xl text-foreground">自定义密码</div>
                  <div className="text-sm text-muted-foreground">设置指定的初始密码</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setPasswordType('random')}
                className={`w-full border-2 rounded px-4 py-3 text-left flex items-center gap-3 ${
                  passwordType === 'random'
                    ? 'border-primary bg-primary/10'
                    : 'border-input bg-card'
                }`}>
                <div
                  className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                    passwordType === 'random' ? 'border-primary' : 'border-input'
                  }`}>
                  {passwordType === 'random' && (
                    <div className="w-3 h-3 rounded-full bg-primary" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="text-xl text-foreground">随机密码</div>
                  <div className="text-sm text-muted-foreground">
                    系统自动生成8位随机密码（更安全）
                  </div>
                </div>
              </button>
            </div>

            {/* 自定义密码输入框 */}
            {passwordType === 'custom' && (
              <div className="border-2 border-input rounded px-4 py-3 bg-card overflow-hidden">
                <input
                  type="text"
                  value={customPassword}
                  onInput={(e) => {
                    const ev = e as unknown
                    setCustomPassword(
                      (ev as {detail?: {value?: string}}).detail?.value ??
                        (ev as {target?: {value?: string}}).target?.value ??
                        ''
                    )
                  }}
                  placeholder="请输入密码（至少6位）"
                  className="w-full text-xl text-foreground bg-transparent outline-none"
                />
              </div>
            )}
          </div>

          {/* 部门 */}
          <div>

          </div>

          {/* 职级 */}
          <div>
            <div className="text-xl text-foreground mb-2">职级</div>
            <div className="border-2 border-input rounded px-4 py-3 bg-card overflow-hidden">
              <select
                value={jobLevel}
                onChange={(e) => {
                  const ev = e as unknown
                  setJobLevel(
                    ((ev as {detail?: {value?: string}}).detail?.value ??
                      (ev as {target?: {value?: string}}).target?.value ??
                      '') as JobLevel | ''
                  )
                }}
                className="w-full text-xl text-foreground bg-transparent outline-none">
                <option value="">请选择职级</option>
                {JobLevelOptions.map((level) => (
                  <option key={level} value={level}>
                    {level}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 小组选择 */}
          <div>
            <div className="text-xl text-foreground mb-2">所属小组（可多选）</div>
            <button
              type="button"
              onClick={() => setShowTeamSelector(true)}
              className="w-full border-2 border-input rounded px-4 py-3 bg-card text-left flex items-center justify-between">
              <span className="text-xl text-foreground">
                {selectedTeams.length > 0
                  ? `已选择 ${selectedTeams.length} 个小组`
                  : '点击选择小组'}
              </span>
              <div className="i-mdi-chevron-down text-2xl text-muted-foreground" />
            </button>
            {selectedTeams.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {selectedTeams.map((teamId) => {
                  const team = teams.find((t) => t.id === teamId)
                  return team ? (
                    <div
                      key={teamId}
                      className="px-3 py-1 bg-primary/10 text-primary rounded-full text-base flex items-center gap-2">
                      {team.name}
                      <button
                        type="button"
                        onClick={() => setSelectedTeams((prev) => prev.filter((id) => id !== teamId))}
                        className="i-mdi-close text-base"
                      />
                    </div>
                  ) : null
                })}
              </div>
            )}
          </div>

          {/* 提示信息 */}
          <div className="bg-muted rounded p-4">
            <div className="text-base text-muted-foreground">
              <div className="mb-2">
                • 用户创建后状态为"已激活"，可立即使用初始密码登录系统
              </div>
              <div className="mb-2">• 建议使用随机密码以提高账户安全性</div>
              <div className="mb-2">• 请将初始密码告知用户</div>
              <div>• 用户首次登录后可在个人中心修改密码</div>
            </div>
          </div>

          {/* 提交按钮 */}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className={`w-full py-4 bg-primary text-primary-foreground text-xl rounded flex items-center justify-center leading-none ${
              loading ? 'opacity-50' : ''
            }`}>
            {loading ? '添加中...' : '提交'}
          </button>
        </div>
      </div>

      {/* 角色选择对话框 */}
      {showRoleSelector && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-6">
          <div className="bg-card rounded p-6 w-full max-w-md max-h-[80vh] flex flex-col">
            <div className="text-xl text-foreground font-bold mb-4">选择角色</div>

            <div className="flex-1 overflow-y-auto mb-4">
              {roles.map((role) => (
                <div
                  key={role.id}
                  onClick={() => {
                    setSelectedRoles((prev) =>
                      prev.includes(role.id) ? prev.filter((id) => id !== role.id) : [...prev, role.id]
                    )
                  }}
                  className="flex items-center gap-3 p-3 mb-2 bg-muted/30 rounded">
                  <div
                    className={`w-6 h-6 rounded border-2 flex items-center justify-center ${
                      selectedRoles.includes(role.id) ? 'bg-primary border-primary' : 'border-input'
                    }`}>
                    {selectedRoles.includes(role.id) && (
                      <div className="i-mdi-check text-base text-primary-foreground" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="text-xl text-foreground font-bold">{role.name}</div>
                    {role.description && (
                      <div className="text-sm text-muted-foreground">{role.description}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="text-base text-muted-foreground mb-3">
              已选择 {selectedRoles.length} 个角色
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowRoleSelector(false)}
                className="flex-1 py-3 bg-card border-2 border-border text-foreground text-xl rounded flex items-center justify-center leading-none">
                取消
              </button>
              <button
                type="button"
                onClick={() => setShowRoleSelector(false)}
                className="flex-1 py-3 bg-primary text-primary-foreground text-xl rounded flex items-center justify-center leading-none">
                确定
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 小组选择对话框 */}
      {showTeamSelector && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-6">
          <div className="bg-card rounded p-6 w-full max-w-md max-h-[80vh] flex flex-col">
            <div className="text-xl text-foreground font-bold mb-4">选择小组</div>

            <div className="flex-1 overflow-y-auto mb-4">
              {teams.map((team) => (
                <div
                  key={team.id}
                  onClick={() => {
                    setSelectedTeams((prev) =>
                      prev.includes(team.id)
                        ? prev.filter((id) => id !== team.id)
                        : [...prev, team.id]
                    )
                  }}
                  className="flex items-center gap-3 p-3 mb-2 bg-muted/30 rounded">
                  <div
                    className={`w-6 h-6 rounded border-2 flex items-center justify-center ${
                      selectedTeams.includes(team.id)
                        ? 'bg-primary border-primary'
                        : 'border-input'
                    }`}>
                    {selectedTeams.includes(team.id) && (
                      <div className="i-mdi-check text-base text-primary-foreground" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="text-xl text-foreground font-bold">{team.name}</div>
                    {team.description && (
                      <div className="text-sm text-muted-foreground">{team.description}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="text-base text-muted-foreground mb-3">
              已选择 {selectedTeams.length} 个小组
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowTeamSelector(false)}
                className="flex-1 py-3 bg-card border-2 border-border text-foreground text-xl rounded flex items-center justify-center leading-none">
                取消
              </button>
              <button
                type="button"
                onClick={() => setShowTeamSelector(false)}
                className="flex-1 py-3 bg-primary text-primary-foreground text-xl rounded flex items-center justify-center leading-none">
                确定
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default withRouteGuard(AddUser)
