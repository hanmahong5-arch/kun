import {useState} from 'react'
import Taro from '@tarojs/taro'
import {withRouteGuard} from '@/components/RouteGuard'
import {useAuth} from '@/contexts/AuthContext'
import {supabase} from '@/client/supabase'

function ProfileSecurityPage() {
  const {profile} = useAuth()
  const [showPasswordDialog, setShowPasswordDialog] = useState(false)
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleChangePassword = async () => {
    if (!oldPassword) {
      Taro.showToast({title: '请输入当前密码', icon: 'none'})
      return
    }
    if (!newPassword || newPassword.length < 6) {
      Taro.showToast({title: '新密码至少6位', icon: 'none'})
      return
    }
    if (newPassword !== confirmPassword) {
      Taro.showToast({title: '两次密码不一致', icon: 'none'})
      return
    }

    setLoading(true)
    try {
      // 先验证旧密码
      const email = `${profile?.phone}@phone.com`
      const {error: signInError} = await supabase.auth.signInWithPassword({
        email,
        password: oldPassword
      })

      if (signInError) {
        Taro.showToast({title: '当前密码错误', icon: 'none'})
        return
      }

      // 更新密码
      const {error: updateError} = await supabase.auth.updateUser({
        password: newPassword
      })

      if (updateError) throw updateError

      Taro.showToast({title: '密码修改成功', icon: 'success'})
      setShowPasswordDialog(false)
      setOldPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (error) {
      console.error('修改密码失败:', error)
      Taro.showToast({title: '修改失败', icon: 'none'})
    } finally {
      setLoading(false)
    }
  }

  const securityItems = [
    {
      icon: 'i-mdi-lock-reset',
      title: '修改密码',
      desc: '定期修改密码，保护账号安全',
      action: () => setShowPasswordDialog(true),
      hasAction: true
    },
    {
      icon: 'i-mdi-cellphone-lock',
      title: '手机号',
      desc: (profile?.phone as string) || '未绑定',
      action: () => Taro.showToast({title: '手机号不可修改', icon: 'none'}),
      hasAction: true
    },
    {
      icon: 'i-mdi-shield-check',
      title: '账号状态',
      desc: profile?.status === 'approved' ? '正常' : '待审核',
      action: () => {},
      hasAction: false
    }
  ]

  return (
    <div className="min-h-screen bg-background pb-6">
      {/* 页面标题 */}
      <div className="px-6 py-6 bg-gradient-primary">
        <div className="text-3xl text-primary-foreground font-bold mb-2">账号安全</div>
        <div className="text-xl text-primary-foreground/80">管理您的账号安全设置</div>
      </div>

      {/* 安全设置列表 */}
      <div className="px-6 mt-4">
        <div className="bg-card rounded border border-border">
          {securityItems.map((item, index) => (
            <div
              key={item.title}
              onClick={item.action}
              className={`flex items-center gap-4 p-4 ${
                index < securityItems.length - 1 ? 'border-b border-border' : ''
              }`}>
              <div className={`${item.icon} text-3xl text-primary`} />
              <div className="flex-1">
                <div className="text-xl text-foreground font-bold mb-1">{item.title}</div>
                <div className="text-base text-muted-foreground">{item.desc}</div>
              </div>
              {item.hasAction && (
                <div className="i-mdi-chevron-right text-2xl text-muted-foreground" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 安全提示 */}
      <div className="px-6 mt-4">
        <div className="bg-warning/10 rounded p-4 border border-warning/30">
          <div className="flex items-start gap-3">
            <div className="i-mdi-alert-circle text-2xl text-warning mt-1" />
            <div className="flex-1">
              <div className="text-xl text-foreground font-bold mb-2">安全提示</div>
              <div className="text-base text-muted-foreground space-y-1">
                <div>• 定期修改密码，建议每3个月更换一次</div>
                <div>• 密码长度至少6位，建议包含字母和数字</div>
                <div>• 不要将密码告诉他人或在公共场合输入</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 修改密码对话框 */}
      {showPasswordDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-6">
          <div className="bg-card rounded p-6 w-full max-w-md">
            <div className="text-xl text-foreground font-bold mb-4">修改密码</div>

            <div className="flex flex-col gap-4 mb-6">
              {/* 当前密码 */}
              <div>
                <div className="text-base text-foreground mb-2">当前密码</div>
                <div className="border-2 border-input rounded px-4 py-3 bg-card overflow-hidden">
                  <input
                    type="password"
                    value={oldPassword}
                    onInput={(e) => {
                      const ev = e as unknown
                      setOldPassword(
                        (ev as {detail?: {value?: string}}).detail?.value ??
                          (ev as {target?: {value?: string}}).target?.value ??
                          ''
                      )
                    }}
                    placeholder="请输入当前密码"
                    className="w-full text-xl text-foreground bg-transparent outline-none"
                  />
                </div>
              </div>

              {/* 新密码 */}
              <div>
                <div className="text-base text-foreground mb-2">新密码</div>
                <div className="border-2 border-input rounded px-4 py-3 bg-card overflow-hidden">
                  <input
                    type="password"
                    value={newPassword}
                    onInput={(e) => {
                      const ev = e as unknown
                      setNewPassword(
                        (ev as {detail?: {value?: string}}).detail?.value ??
                          (ev as {target?: {value?: string}}).target?.value ??
                          ''
                      )
                    }}
                    placeholder="请输入新密码（至少6位）"
                    className="w-full text-xl text-foreground bg-transparent outline-none"
                  />
                </div>
              </div>

              {/* 确认密码 */}
              <div>
                <div className="text-base text-foreground mb-2">确认密码</div>
                <div className="border-2 border-input rounded px-4 py-3 bg-card overflow-hidden">
                  <input
                    type="password"
                    value={confirmPassword}
                    onInput={(e) => {
                      const ev = e as unknown
                      setConfirmPassword(
                        (ev as {detail?: {value?: string}}).detail?.value ??
                          (ev as {target?: {value?: string}}).target?.value ??
                          ''
                      )
                    }}
                    placeholder="请再次输入新密码"
                    className="w-full text-xl text-foreground bg-transparent outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowPasswordDialog(false)
                  setOldPassword('')
                  setNewPassword('')
                  setConfirmPassword('')
                }}
                className="flex-1 py-3 bg-card border-2 border-border text-foreground text-xl rounded flex items-center justify-center leading-none">
                取消
              </button>
              <button
                type="button"
                onClick={handleChangePassword}
                disabled={loading}
                className={`flex-1 py-3 bg-primary text-primary-foreground text-xl rounded flex items-center justify-center leading-none ${
                  loading ? 'opacity-50' : ''
                }`}>
                {loading ? '修改中...' : '确定'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default withRouteGuard(ProfileSecurityPage)
