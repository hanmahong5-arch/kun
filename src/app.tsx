/**
 * @file Taro application entry file
 */

import type React from 'react'
import {useEffect} from 'react'
import type {PropsWithChildren} from 'react'
import Taro from '@tarojs/taro'
import {useTabBarPageClass} from '@/hooks/useTabBarPageClass'
import {AuthProvider} from '@/contexts/AuthContext'

import './app.scss'

const App: React.FC = ({children}: PropsWithChildren<unknown>) => {
  useTabBarPageClass()

  // Global network status monitoring
  useEffect(() => {
    const onStatusChange = (res: Taro.onNetworkStatusChange.CallbackResult) => {
      if (!res.isConnected) {
        Taro.showToast({
          title: '网络连接已断开，请检查网络设置',
          icon: 'none',
          duration: 5000
        })
      }
    }
    Taro.onNetworkStatusChange(onStatusChange)
    return () => Taro.offNetworkStatusChange(onStatusChange)
  }, [])

  return <AuthProvider>{children}</AuthProvider>
}

export default App
