import {useState} from 'react'
import Taro from '@tarojs/taro'
import {withRouteGuard} from '@/components/RouteGuard'
import {createCustomRole} from '@/db/permissions'

function AddRolePage() {
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    if (!code) {
      Taro.showToast({title: '请输入角色代码', icon: 'none'})
      return
    }
    if (!name) {
      Taro.showToast({title: '请输入角色名称', icon: 'none'})
      return
    }

    setLoading(true)
    try {
      const result = await createCustomRole({
        code,
        name,
        description: description || null,
        is_system: false,
        is_active: true
      })

      if (result.success) {
        Taro.showToast({title: '创建成功', icon: 'success'})
        setTimeout(() => {
          Taro.navigateBack()
        }, 1500)
      } else {
        Taro.showToast({title: result.error || '创建失败', icon: 'none'})
      }
    } catch (error) {
      console.error('创建角色失败:', error)
      Taro.showToast({title: '创建失败', icon: 'none'})
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background pb-6">
      {/* 页面标题 */}
      <div className="px-6 py-6 bg-gradient-primary">
        <div className="text-3xl text-primary-foreground font-bold mb-2">添加角色</div>
        <div className="text-xl text-primary-foreground/80">创建新的系统角色</div>
      </div>

      {/* 表单 */}
      <div className="px-6 mt-4">
        <div className="bg-card rounded p-5 border border-border flex flex-col gap-4">
          {/* 角色代码 */}
          <div>
            <div className="text-xl text-foreground mb-2">
              角色代码<span className="text-destructive ml-1">*</span>
            </div>
            <div className="border-2 border-input rounded px-4 py-3 bg-card overflow-hidden">
              <input
                type="text"
                value={code}
                onInput={(e) => {
                  const ev = e as unknown
                  setCode(
                    (ev as {detail?: {value?: string}}).detail?.value ??
                      (ev as {target?: {value?: string}}).target?.value ??
                      ''
                  )
                }}
                placeholder="请输入角色代码（英文，如：manager）"
                className="w-full text-xl text-foreground bg-transparent outline-none"
              />
            </div>
            <div className="text-sm text-muted-foreground mt-1">
              角色代码用于系统内部识别，建议使用英文
            </div>
          </div>

          {/* 角色名称 */}
          <div>
            <div className="text-xl text-foreground mb-2">
              角色名称<span className="text-destructive ml-1">*</span>
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
                placeholder="请输入角色名称"
                className="w-full text-xl text-foreground bg-transparent outline-none"
              />
            </div>
          </div>

          {/* 角色描述 */}
          <div>
            <div className="text-xl text-foreground mb-2">角色描述</div>
            <div className="border-2 border-input rounded px-4 py-3 bg-card overflow-hidden">
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
                placeholder="请输入角色描述"
                maxLength={200}
                className="w-full text-xl text-foreground bg-transparent outline-none"
                style={{minHeight: '80px'}}
              />
            </div>
            <div className="text-sm text-muted-foreground mt-1">{description.length}/200</div>
          </div>

          {/* 提交按钮 */}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className={`w-full py-4 bg-primary text-primary-foreground text-xl rounded flex items-center justify-center leading-none ${
              loading ? 'opacity-50' : ''
            }`}>
            {loading ? '创建中...' : '创建角色'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default withRouteGuard(AddRolePage)
