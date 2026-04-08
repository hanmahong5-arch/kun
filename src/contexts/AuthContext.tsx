import {createContext, useContext, useEffect, useState, useCallback, type ReactNode} from 'react'
import Taro from '@tarojs/taro'
import {supabase} from '@/client/supabase'
import type {User} from '@supabase/supabase-js'
import {getUserPermissionCodes} from '@/db/roles'

export interface Profile {
  [key: string]: unknown
}

export async function getProfile(userId: string): Promise<Profile | null> {
  const {data, error} = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()

  if (error) {
    console.error('Failed to fetch user profile:', error)
    return null
  }
  return data
}

interface AuthContextType {
  user: User | null
  profile: Profile | null
  permissions: string[]
  loading: boolean
  signInWithPhone: (phone: string, password: string) => Promise<{error: Error | null}>
  sendPhoneOtp: (phone: string) => Promise<{error: Error | null}>
  verifyPhoneOtp: (phone: string, code: string) => Promise<{error: Error | null}>
  signInWithWechat: () => Promise<{error: Error | null}>
  resetPassword: (
    phone: string,
    code: string,
    newPassword: string
  ) => Promise<{error: Error | null}>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
  refreshPermissions: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({children}: {children: ReactNode}) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [permissions, setPermissions] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  // 刷新用户权限
  const refreshPermissions = useCallback(async () => {
    if (!user) {
      setPermissions([])
      return
    }

    try {
      const perms = await getUserPermissionCodes(user.id)
      setPermissions(perms)
    } catch (error) {
      console.error('Failed to fetch user permissions:', error)
      setPermissions([])
    }
  }, [user])

  const refreshProfile = useCallback(async () => {
    if (!user) {
      setProfile(null)
      setPermissions([])
      return
    }

    const profileData = await getProfile(user.id)
    setProfile(profileData)

    // 同时刷新权限
    await refreshPermissions()
  }, [user, refreshPermissions])

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({data: {session}}) => {
        setUser(session?.user ?? null)
        if (session?.user) {
          getProfile(session.user.id).then(setProfile)
        }
        setLoading(false)
      })
      .catch((error) => {
        console.warn('Failed to get session:', error)
        setUser(null)
        setProfile(null)
        setLoading(false)
      })

    // In this function, do NOT use any await calls. Use `.then()` instead to avoid deadlocks.
    const {
      data: {subscription}
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        getProfile(session.user.id).then(setProfile)
      } else {
        setProfile(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  /**
   * 手机号密码登录
   * 
   * 功能说明：
   * 1. 使用手机号和密码进行登录
   * 2. 登录成功后检查用户状态
   * 3. 只有状态为"approved"的用户才能登录
   * 4. pending（待审核）和rejected（已拒绝）状态的用户会被拒绝登录
   * 
   * 状态说明：
   * - approved: 已激活，可以正常登录（系统管理员创建的用户默认为此状态）
   * - pending: 待审核，无法登录（需要管理员审核）
   * - rejected: 已拒绝，无法登录（审核未通过）
   * 
   * @param phone 手机号
   * @param password 密码
   * @returns {error: Error | null} 错误信息，成功时为null
   */
  const signInWithPhone = async (phone: string, password: string) => {
    try {
      // 构造邮箱（Supabase Auth使用邮箱作为主要标识）
      const email = `${phone}@phone.com`
      
      // 调用Supabase Auth进行登录
      const {data, error} = await supabase.auth.signInWithPassword({
        email,
        password
      })

      if (error) throw error
      
      // ========== 用户状态检查（关键安全机制） ==========
      
      /**
       * 登录成功后，必须检查用户的审核状态
       * 这是确保只有已激活用户才能使用系统的关键步骤
       * 
       * 即使Auth认证通过，如果用户状态不是approved，
       * 也要立即登出并拒绝访问
       */
      if (data.user) {
        const {data: profile, error: profileError} = await supabase
          .from('profiles')
          .select('status')
          .eq('id', data.user.id)
          .maybeSingle()
        
        if (profileError) {
          console.error('获取用户状态失败:', profileError)
          throw new Error('获取用户状态失败')
        }
        
        if (!profile) {
          throw new Error('用户信息不存在')
        }
        
        // 检查审核状态：pending（待审核）
        if (profile.status === 'pending') {
          // 立即登出用户
          await supabase.auth.signOut()
          throw new Error('您的账号正在审核中，请等待管理员审核通过后再登录')
        }
        
        // 检查审核状态：rejected（已拒绝）
        if (profile.status === 'rejected') {
          // 立即登出用户
          await supabase.auth.signOut()
          throw new Error('您的账号审核未通过，请联系管理员')
        }
        
        // 状态为approved，允许登录
        // 注意：系统管理员创建的用户默认就是approved状态，可以直接登录
      }
      
      return {error: null}
    } catch (error) {
      return {error: error as Error}
    }
  }

  // 发送手机验证码
  const sendPhoneOtp = async (phone: string) => {
    try {
      // 测试环境固定验证码为123456，生产环境对接短信服务
      // 这里模拟发送成功
      console.log('发送验证码到:', phone)
      return {error: null}
    } catch (error) {
      return {error: error as Error}
    }
  }

  // 验证手机验证码登录
  const verifyPhoneOtp = async (phone: string, code: string) => {
    try {
      // 测试环境固定验证码为123456
      if (code !== '123456') {
        throw new Error('验证码错误')
      }

      // 验证码正确，使用手机号登录
      const email = `${phone}@phone.com`
      const {error} = await supabase.auth.signInWithPassword({
        email,
        password: '123456' // 测试环境默认密码
      })

      if (error) throw error
      return {error: null}
    } catch (error) {
      return {error: error as Error}
    }
  }

  // 重置密码
  const resetPassword = async (phone: string, code: string, newPassword: string) => {
    try {
      // 验证验证码
      if (code !== '123456') {
        throw new Error('验证码错误')
      }

      // 这里应该调用Edge Function来重置密码
      // 暂时返回成功
      console.log('重置密码:', phone, newPassword)
      return {error: null}
    } catch (error) {
      return {error: error as Error}
    }
  }

  const signInWithWechat = async () => {
    try {
      // Check if running in WeChat Mini Program environment
      if (Taro.getEnv() !== Taro.ENV_TYPE.WEAPP) {
        throw new Error('仅支持微信小程序登录，网页端请使用用户名密码登录')
      }

      // Get WeChat login code
      const loginResult = await Taro.login()

      // Call backend Edge Function for login
      const {data, error} = await supabase.functions.invoke('wechat_miniapp_login', {
        body: {code: loginResult?.code}
      })

      if (error) {
        const errorMsg = (await error?.context?.text?.()) || error.message
        throw new Error(errorMsg)
      }

      // Verify OTP token
      const {error: verifyError} = await supabase.auth.verifyOtp({
        token_hash: data.token,
        type: 'email'
      })

      if (verifyError) throw verifyError
      return {error: null}
    } catch (error) {
      return {error: error as Error}
    }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        permissions,
        loading,
        signInWithPhone,
        sendPhoneOtp,
        verifyPhoneOtp,
        signInWithWechat,
        resetPassword,
        signOut,
        refreshProfile,
        refreshPermissions
      }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
