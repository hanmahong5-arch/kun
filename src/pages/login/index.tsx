import {useState} from 'react'
import Taro from '@tarojs/taro'
import {useAuth} from '@/contexts/AuthContext'
import {STORAGE_KEY_REDIRECT_PATH} from '@/components/RouteGuard'

export default function Login() {
  const {signInWithPhone, signInWithWechat} = useAuth()
  const [loginType, setLoginType] = useState<'password' | 'code' | 'wechat'>('password')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [countdown, setCountdown] = useState(0)
  const [agreed, setAgreed] = useState(false)
  const [loading, setLoading] = useState(false)

  // 手机号+密码登录
  const handlePasswordLogin = async () => {
    if (!phone || phone.length !== 11) {
      Taro.showToast({title: '请输入正确的手机号', icon: 'none'})
      return
    }
    if (!password || password.length < 6) {
      Taro.showToast({title: '请输入密码（至少6位）', icon: 'none'})
      return
    }
    if (!agreed) {
      Taro.showToast({title: '请先同意用户协议和隐私政策', icon: 'none'})
      return
    }

    setLoading(true)
    try {
      const result = await signInWithPhone(phone, password)
      
      if (result.error) {
        let displayMsg = '登录失败'
        const errorMsg = result.error.message || ''
        
        if (errorMsg.includes('Invalid') || errorMsg.includes('invalid')) {
          displayMsg = '手机号或密码错误'
        } else if (errorMsg.includes('pending')) {
          displayMsg = '您的账号正在审核中，请等待管理员审核通过后再登录'
        } else if (errorMsg.includes('rejected')) {
          displayMsg = '您的账号审核未通过，请联系管理员'
        } else {
          displayMsg = errorMsg
        }
        
        Taro.showToast({title: displayMsg, icon: 'none', duration: 3000})
        return
      }

      Taro.showToast({title: '登录成功', icon: 'success'})
      handleRedirect()
    } catch (error) {
      console.error('登录异常:', error)
      Taro.showToast({title: '登录失败，请重试', icon: 'none'})
    } finally {
      setLoading(false)
    }
  }

  // 发送验证码
  const handleSendCode = async () => {
    if (!phone || phone.length !== 11) {
      Taro.showToast({title: '请输入正确的手机号', icon: 'none'})
      return
    }
    if (countdown > 0) {
      return
    }

    try {
      // 测试环境：直接显示固定验证码
      Taro.showToast({title: '验证码：123456（测试）', icon: 'none', duration: 3000})
      
      // 开始倒计时
      setCountdown(60)
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer)
            return 0
          }
          return prev - 1
        })
      }, 1000)
    } catch (error) {
      console.error('发送验证码失败:', error)
      Taro.showToast({title: '发送失败，请重试', icon: 'none'})
    }
  }

  // 手机号+验证码登录
  const handleCodeLogin = async () => {
    if (!phone || phone.length !== 11) {
      Taro.showToast({title: '请输入正确的手机号', icon: 'none'})
      return
    }
    if (!code || code.length !== 6) {
      Taro.showToast({title: '请输入6位验证码', icon: 'none'})
      return
    }
    if (!agreed) {
      Taro.showToast({title: '请先同意用户协议和隐私政策', icon: 'none'})
      return
    }

    setLoading(true)
    try {
      // 测试环境：固定验证码123456
      if (code !== '123456') {
        Taro.showToast({title: '验证码错误', icon: 'none'})
        setLoading(false)
        return
      }

      // 验证码正确，使用默认密码登录
      const result = await signInWithPhone(phone, '123456')
      
      if (result.error) {
        let displayMsg = '登录失败'
        const errorMsg = result.error.message || ''
        
        if (errorMsg.includes('Invalid') || errorMsg.includes('invalid')) {
          displayMsg = '该手机号未注册，请联系管理员开通账号'
        } else if (errorMsg.includes('pending')) {
          displayMsg = '您的账号正在审核中，请等待管理员审核通过后再登录'
        } else if (errorMsg.includes('rejected')) {
          displayMsg = '您的账号审核未通过，请联系管理员'
        } else {
          displayMsg = errorMsg
        }
        
        Taro.showToast({title: displayMsg, icon: 'none', duration: 3000})
        return
      }

      Taro.showToast({title: '登录成功', icon: 'success'})
      handleRedirect()
    } catch (error) {
      console.error('登录异常:', error)
      Taro.showToast({title: '登录失败，请重试', icon: 'none'})
    } finally {
      setLoading(false)
    }
  }

  // 微信登录
  const handleWechatLogin = async () => {
    if (!agreed) {
      Taro.showToast({title: '请先同意用户协议和隐私政策', icon: 'none'})
      return
    }

    setLoading(true)
    const {error} = await signInWithWechat()
    setLoading(false)

    if (error) {
      Taro.showToast({title: '登录失败：' + error.message, icon: 'none'})
      return
    }

    Taro.showToast({title: '登录成功', icon: 'success'})
    handleRedirect()
  }

  // 登录后重定向
  const handleRedirect = () => {
    setTimeout(() => {
      const redirectPath = Taro.getStorageSync(STORAGE_KEY_REDIRECT_PATH)
      if (redirectPath) {
        Taro.removeStorageSync(STORAGE_KEY_REDIRECT_PATH)
        const normalizedPath = redirectPath.startsWith('/') ? redirectPath : `/${redirectPath}`
        const tabBarPages = ['pages/home/index', 'pages/reports/index', 'pages/projects/index', 'pages/profile/index']
        const isTabBar = tabBarPages.some((p) => normalizedPath.includes(p))
        if (isTabBar) {
          Taro.switchTab({url: normalizedPath})
        } else {
          Taro.navigateTo({url: normalizedPath})
        }
      } else {
        Taro.switchTab({url: '/pages/home/index'})
      }
    }, 500)
  }

  // 快速填充测试账号
  const fillTestAccount = (testPhone: string) => {
    setPhone(testPhone)
    setPassword('123456')
    setLoginType('password')
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* 头部 */}
      <div className="bg-gradient-primary px-6 py-12 flex flex-col items-center">
        <div className="text-4xl text-primary-foreground font-bold mb-2">施工企业市场经营管理</div>
        <div className="text-xl text-primary-foreground/80">Construction Market Management</div>
      </div>

      {/* 登录表单 */}
      <div className="flex-1 px-6 py-8">
        {/* 登录方式切换 */}
        <div className="flex gap-3 mb-8">
          <button
            type="button"
            onClick={() => setLoginType('password')}
            className={`flex-1 py-3 text-xl rounded flex items-center justify-center leading-none ${
              loginType === 'password' ? 'bg-primary text-primary-foreground' : 'bg-card text-foreground border border-border'
            }`}>
            密码登录
          </button>
          <button
            type="button"
            onClick={() => setLoginType('code')}
            className={`flex-1 py-3 text-xl rounded flex items-center justify-center leading-none ${
              loginType === 'code' ? 'bg-primary text-primary-foreground' : 'bg-card text-foreground border border-border'
            }`}>
            验证码登录
          </button>
          <button
            type="button"
            onClick={() => setLoginType('wechat')}
            className={`flex-1 py-3 text-xl rounded flex items-center justify-center leading-none ${
              loginType === 'wechat' ? 'bg-primary text-primary-foreground' : 'bg-card text-foreground border border-border'
            }`}>
            微信登录
          </button>
        </div>

        {/* 手机号+密码登录 */}
        {loginType === 'password' && (
          <div className="flex flex-col gap-4">
            <div>
              <div className="text-xl text-foreground mb-2">手机号</div>
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

            <div>
              <div className="text-xl text-foreground mb-2">密码</div>
              <div className="border-2 border-input rounded px-4 py-3 bg-card overflow-hidden">
                <input
                  type="password"
                  value={password}
                  onInput={(e) => {
                    const ev = e as unknown
                    setPassword(
                      (ev as {detail?: {value?: string}}).detail?.value ??
                        (ev as {target?: {value?: string}}).target?.value ??
                        ''
                    )
                  }}
                  placeholder="请输入密码"
                  className="w-full text-xl text-foreground bg-transparent outline-none"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={handlePasswordLogin}
              disabled={loading}
              className={`w-full py-4 bg-primary text-primary-foreground text-xl rounded flex items-center justify-center leading-none ${
                loading ? 'opacity-50' : ''
              }`}>
              {loading ? '登录中...' : '登录'}
            </button>
          </div>
        )}

        {/* 手机号+验证码登录 */}
        {loginType === 'code' && (
          <div className="flex flex-col gap-4">
            <div>
              <div className="text-xl text-foreground mb-2">手机号</div>
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

            <div>
              <div className="text-xl text-foreground mb-2">验证码</div>
              <div className="flex gap-3">
                <div className="flex-1 border-2 border-input rounded px-4 py-3 bg-card overflow-hidden">
                  <input
                    type="tel"
                    value={code}
                    onInput={(e) => {
                      const ev = e as unknown
                      setCode(
                        (ev as {detail?: {value?: string}}).detail?.value ??
                          (ev as {target?: {value?: string}}).target?.value ??
                          ''
                      )
                    }}
                    placeholder="请输入6位验证码"
                    maxLength={6}
                    className="w-full text-xl text-foreground bg-transparent outline-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleSendCode}
                  disabled={countdown > 0}
                  className={`px-6 py-3 bg-primary text-primary-foreground text-xl rounded flex items-center justify-center leading-none break-keep ${
                    countdown > 0 ? 'opacity-50' : ''
                  }`}>
                  {countdown > 0 ? `${countdown}秒` : '获取验证码'}
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={handleCodeLogin}
              disabled={loading}
              className={`w-full py-4 bg-primary text-primary-foreground text-xl rounded flex items-center justify-center leading-none ${
                loading ? 'opacity-50' : ''
              }`}>
              {loading ? '登录中...' : '登录'}
            </button>
          </div>
        )}

        {/* 微信登录 */}
        {loginType === 'wechat' && (
          <div className="flex flex-col gap-4">
            <div className="text-center py-12">
              <div className="i-mdi-wechat text-8xl text-success mb-4" />
              <div className="text-2xl text-foreground mb-2">微信授权登录</div>
              <div className="text-base text-muted-foreground">点击下方按钮使用微信账号登录</div>
            </div>

            <button
              type="button"
              onClick={handleWechatLogin}
              disabled={loading}
              className={`w-full py-4 bg-success text-success-foreground text-xl rounded flex items-center justify-center leading-none gap-2 ${
                loading ? 'opacity-50' : ''
              }`}>
              <div className="i-mdi-wechat text-2xl" />
              <span>{loading ? '登录中...' : '微信登录'}</span>
            </button>
          </div>
        )}

        {/* 协议勾选 */}
        <div className="flex items-center gap-2 mt-6" onClick={() => setAgreed(!agreed)}>
          <div
            className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
              agreed ? 'bg-primary border-primary' : 'border-input'
            }`}>
            {agreed && <div className="i-mdi-check text-base text-primary-foreground" />}
          </div>
          <div className="text-base text-muted-foreground">
            我已阅读并同意
            <span className="text-primary">《用户服务协议》</span>
            和
            <span className="text-primary">《隐私政策》</span>
          </div>
        </div>

        {/* 测试账号 */}
        <div className="mt-8">
          <div className="text-base text-muted-foreground mb-3">测试账号（点击快速填充）</div>
          <div className="flex flex-col gap-3">
            <div
              onClick={() => fillTestAccount('15232101989')}
              className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg p-4">
              <div className="text-xl text-white font-bold mb-1">系统管理员</div>
              <div className="text-base text-white/90">手机号：15232101989</div>
              <div className="text-base text-white/90">密码：123456</div>
            </div>
            <div
              onClick={() => fillTestAccount('17685587922')}
              className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg p-4">
              <div className="text-xl text-white font-bold mb-1">系统管理员</div>
              <div className="text-base text-white/90">手机号：17685587922</div>
              <div className="text-base text-white/90">密码：123456</div>
            </div>
            <div
              onClick={() => fillTestAccount('13869824089')}
              className="bg-card border border-border rounded-lg p-4">
              <div className="text-xl text-foreground font-bold mb-1">公司领导</div>
              <div className="text-base text-muted-foreground">手机号：13869824089</div>
              <div className="text-base text-muted-foreground">密码：123456</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
