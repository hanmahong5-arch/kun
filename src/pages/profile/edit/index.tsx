import {useState, useCallback, useEffect} from 'react'
import Taro from '@tarojs/taro'
import {Image} from '@tarojs/components'
import {withRouteGuard} from '@/components/RouteGuard'
import {useAuth} from '@/contexts/AuthContext'
import {supabase} from '@/client/supabase'
import {selectMediaFiles, uploadToSupabase} from '@/utils/upload'
import {ImageEditor} from '@/components/ImageEditor'
import type {MiniProgramFileInput} from '@/utils/upload'

function ProfileEditPage() {
  const {profile, refreshProfile} = useAuth()
  const [name, setName] = useState('')
  const [department, setDepartment] = useState('')
  const [signature, setSignature] = useState('')
  const [avatarFile, setAvatarFile] = useState<MiniProgramFileInput | File | null>(null)
  const [avatarUrl, setAvatarUrl] = useState('')
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showEditor, setShowEditor] = useState(false)
  const [tempImagePath, setTempImagePath] = useState('')

  useEffect(() => {
    if (profile) {
      setName((profile.name as string) || '')
      setDepartment((profile.department as string) || '')
      setSignature((profile.signature as string) || '')
      setAvatarUrl((profile.avatar_url as string) || '')
    }
  }, [profile])

  const handleSelectAvatar = async () => {
    try {
      const files = await selectMediaFiles({
        count: 1,
        mediaType: ['image']
      })

      if (files && files.length > 0) {
        const file = files[0]

        // 获取临时路径
        if ('tempFilePath' in file) {
          setTempImagePath(file.tempFilePath)
          setAvatarFile(file)
          setShowEditor(true)
        } else {
          // H5环境，直接上传
          setAvatarFile(file)
          await handleUploadAvatar(file)
        }
      }
    } catch (error) {
      console.error('选择图片失败:', error)
    }
  }

  const handleEditorConfirm = async (editedPath: string) => {
    setShowEditor(false)
    setAvatarUrl(editedPath)

    // 创建新的文件对象用于上传
    const editedFile: MiniProgramFileInput = {
      tempFilePath: editedPath,
      size: 0,
      type: 'image/jpeg',
      name: 'avatar.jpg'
    }

    setAvatarFile(editedFile)
  }

  const handleEditorCancel = () => {
    setShowEditor(false)
    setTempImagePath('')
  }

  const handleUploadAvatar = async (file?: MiniProgramFileInput | File) => {
    const fileToUpload = file || avatarFile
    if (!fileToUpload || !profile) return

    setUploading(true)
    try {
      const result = await uploadToSupabase(fileToUpload, {
        bucket: 'avatars',
        userId: profile.id as string
      })

      if (!result.success || !result.data) {
        throw new Error((result.error as string) || '上传失败')
      }

      // 获取公开URL
      const {data: urlData} = supabase.storage.from('avatars').getPublicUrl(result.data.path)

      setAvatarUrl(urlData.publicUrl)
      Taro.showToast({title: '头像上传成功', icon: 'success'})
    } catch (error) {
      console.error('上传头像失败:', error)
      Taro.showToast({title: '上传失败', icon: 'none'})
    } finally {
      setUploading(false)
    }
  }

  const handleSave = async () => {
    if (!name) {
      Taro.showToast({title: '请输入姓名', icon: 'none'})
      return
    }

    setSaving(true)
    try {
      // 如果有新头像且在weapp环境，先上传
      if (avatarFile && 'tempFilePath' in avatarFile && avatarUrl.startsWith('wxfile://')) {
        await handleUploadAvatar()
      }

      // 更新用户信息
      const {error} = await supabase
        .from('profiles')
        .update({
          name,
          department: department || null,
          signature: signature || null,
          avatar_url: avatarUrl || null
        })
        .eq('id', profile?.id)

      if (error) throw error

      Taro.showToast({title: '保存成功', icon: 'success'})
      await refreshProfile()
      setTimeout(() => {
        Taro.navigateBack()
      }, 1500)
    } catch (error) {
      console.error('保存失败:', error)
      Taro.showToast({title: '保存失败', icon: 'none'})
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-background pb-6">
      {/* 页面标题 */}
      <div className="px-6 py-6 bg-gradient-primary">
        <div className="text-3xl text-primary-foreground font-bold mb-2">编辑资料</div>
        <div className="text-xl text-primary-foreground/80">完善您的个人信息</div>
      </div>

      {/* 表单 */}
      <div className="px-6 mt-4">
        <div className="bg-card rounded p-5 border border-border flex flex-col gap-4">
          {/* 头像 */}
          <div>
            <div className="text-xl text-foreground mb-3">头像</div>
            <div className="flex items-center gap-4">
              <div className="w-24 h-24 rounded-full bg-muted overflow-hidden flex items-center justify-center">
                {avatarUrl ? (
                  <Image src={avatarUrl} mode="aspectFill" className="w-full h-full" />
                ) : (
                  <div className="i-mdi-account text-[60px] text-muted-foreground" />
                )}
              </div>
              <button
                type="button"
                onClick={handleSelectAvatar}
                disabled={uploading}
                className={`px-6 py-3 bg-primary text-primary-foreground text-xl rounded flex items-center justify-center leading-none ${
                  uploading ? 'opacity-50' : ''
                }`}>
                {uploading ? '上传中...' : '选择头像'}
              </button>
            </div>
          </div>

          {/* 姓名 */}
          <div>
            <div className="text-xl text-foreground mb-2">姓名</div>
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

          {/* 手机号（只读） */}
          <div>
            <div className="text-xl text-foreground mb-2">手机号</div>
            <div className="border-2 border-input rounded px-4 py-3 bg-muted">
              <div className="text-xl text-muted-foreground">{(profile?.phone as string) || ''}</div>
            </div>
            <div className="text-sm text-muted-foreground mt-1">手机号不可修改</div>
          </div>

          {/* 部门 */}
          <div>
            <div className="text-xl text-foreground mb-2">部门</div>
            <div className="border-2 border-input rounded px-4 py-3 bg-card overflow-hidden">
              <input
                type="text"
                value={department}
                onInput={(e) => {
                  const ev = e as unknown
                  setDepartment(
                    (ev as {detail?: {value?: string}}).detail?.value ??
                      (ev as {target?: {value?: string}}).target?.value ??
                      ''
                  )
                }}
                placeholder="请输入部门"
                className="w-full text-xl text-foreground bg-transparent outline-none"
              />
            </div>
          </div>

          {/* 个人签名 */}
          <div>
            <div className="text-xl text-foreground mb-2">个人签名</div>
            <div className="border-2 border-input rounded px-4 py-3 bg-card overflow-hidden">
              <textarea
                value={signature}
                onInput={(e) => {
                  const ev = e as unknown
                  setSignature(
                    (ev as {detail?: {value?: string}}).detail?.value ??
                      (ev as {target?: {value?: string}}).target?.value ??
                      ''
                  )
                }}
                placeholder="请输入个人签名"
                maxLength={100}
                className="w-full text-xl text-foreground bg-transparent outline-none"
                style={{minHeight: '80px'}}
              />
            </div>
            <div className="text-sm text-muted-foreground mt-1">
              {signature.length}/100
            </div>
          </div>

          {/* 保存按钮 */}
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || uploading}
            className={`w-full py-4 bg-primary text-primary-foreground text-xl rounded flex items-center justify-center leading-none ${
              saving || uploading ? 'opacity-50' : ''
            }`}>
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>

      {/* 图片编辑器 */}
      {showEditor && tempImagePath && (
        <ImageEditor
          imagePath={tempImagePath}
          onConfirm={handleEditorConfirm}
          onCancel={handleEditorCancel}
        />
      )}
    </div>
  )
}

export default withRouteGuard(ProfileEditPage)
