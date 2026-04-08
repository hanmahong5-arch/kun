import {useState, useCallback, useEffect} from 'react'
import {isAdmin, isLeaderOrAdmin} from '@/db/permissions-utils'
import Taro, {useDidShow} from '@tarojs/taro'
import {withRouteGuard} from '@/components/RouteGuard'
import {useAuth} from '@/contexts/AuthContext'
import {getDocuments, deleteDocument, uploadDocument, createDocument} from '@/db/documents'
import type {Document} from '@/db/types'

function DocumentsPage() {
  const {profile} = useAuth()
  const [documents, setDocuments] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [category, setCategory] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<'created_at' | 'file_size' | 'name'>('created_at')

  const canManage =
    isAdmin(profile) ||
    profile?.role === 'data_clerk'

  const categories = [
    {value: 'all', label: '全部'},
    {value: 'standard', label: '标准规范'},
    {value: 'template', label: '模板文档'},
    {value: 'manual', label: '操作手册'},
    {value: 'other', label: '其他'}
  ]

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      const {data} = await getDocuments({
        category: category === 'all' ? undefined : category,
        search: search || undefined,
        sortBy,
        sortOrder: 'desc'
      })
      setDocuments(data)
    } catch (error) {
      console.error('加载文档失败:', error)
      Taro.showToast({title: '加载失败', icon: 'none'})
    } finally {
      setLoading(false)
    }
  }, [category, search, sortBy])

  useDidShow(() => {
    loadData()
  })

  useEffect(() => {
    loadData()
  }, [loadData])

  const getCategoryLabel = (cat: string) => {
    return categories.find((c) => c.value === cat)?.label || cat
  }

  const handleUpload = async () => {
    try {
      // 选择文件
      const res = await Taro.chooseMessageFile({
        count: 1,
        type: 'file'
      })

      if (!res.tempFiles || res.tempFiles.length === 0) return

      const file = res.tempFiles[0]

      // 检查文件大小（10MB限制）
      if (file.size > 10 * 1024 * 1024) {
        Taro.showToast({title: '文件大小不能超过10MB', icon: 'none'})
        return
      }

      // 检查文件类型
      const allowedTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      ]

      if (!allowedTypes.includes(file.type)) {
        Taro.showToast({title: '仅支持PDF、Word、Excel格式', icon: 'none'})
        return
      }

      // 选择分类
      const categoryRes = await Taro.showActionSheet({
        itemList: ['标准规范', '模板文档', '操作手册', '其他']
      })

      const categoryMap = ['standard', 'template', 'manual', 'other']
      const selectedCategory = categoryMap[categoryRes.tapIndex]

      Taro.showLoading({title: '上传中...'})

      if (!profile?.id) {
        throw new Error('用户未登录')
      }

      // 上传文件
      const {data: uploadData, error: uploadError} = await uploadDocument(
        {
          tempFilePath: file.path,
          name: file.name,
          type: file.type
        },
        profile.id as string
      )

      if (uploadError || !uploadData) throw uploadError

      // 创建文档记录
      const {error: createError} = await createDocument({
        name: file.name,
        category: selectedCategory,
        file_size: file.size,
        file_path: uploadData.path,
        file_type: file.type,
        uploaded_by: profile.id as string
      })

      if (createError) throw createError

      Taro.showToast({title: '上传成功', icon: 'success'})
      loadData()
    } catch (error) {
      console.error('上传文档失败:', error)
      Taro.showToast({title: '上传失败', icon: 'none'})
    } finally {
      Taro.hideLoading()
    }
  }

  const handleDelete = async (doc: any) => {
    const res = await Taro.showModal({
      title: '确认删除',
      content: `确定要删除文档"${doc.name}"吗？`,
      confirmText: '删除',
      confirmColor: '#ef4444'
    })

    if (!res.confirm) return

    try {
      Taro.showLoading({title: '删除中...'})
      const {error} = await deleteDocument(doc.id, doc.file_path)

      if (error) throw error

      Taro.showToast({title: '删除成功', icon: 'success'})
      loadData()
    } catch (error) {
      console.error('删除文档失败:', error)
      Taro.showToast({title: '删除失败', icon: 'none'})
    } finally {
      Taro.hideLoading()
    }
  }

  const handleDownload = (doc: any) => {
    Taro.showToast({
      title: '文档下载功能开发中',
      icon: 'none'
    })
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`
  }

  return (
    <div className="min-h-screen bg-background pb-6">
      {/* 头部 */}
      <div className="bg-gradient-primary px-6 py-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-2xl text-primary-foreground font-bold">知识库</div>
            <div className="text-base text-primary-foreground/80 mt-1">
              共 {documents.length} 个文档
            </div>
          </div>
          {canManage && (
            <button
              type="button"
              onClick={handleUpload}
              className="px-4 py-2 bg-primary-foreground text-primary text-base rounded flex items-center justify-center leading-none">
              <div className="i-mdi-upload text-xl mr-1" />
              上传
            </button>
          )}
        </div>
      </div>

      {/* 搜索栏 */}
      <div className="px-6 mt-4">
        <div className="border-2 border-input rounded px-4 py-3 bg-background">
          <input
            type="text"
            placeholder="搜索文档名称..."
            value={search}
            onInput={(e) => {
              const ev = e as any
              setSearch(ev.detail?.value ?? ev.target?.value ?? '')
            }}
            className="w-full text-xl text-foreground bg-transparent outline-none"
          />
        </div>
      </div>

      {/* 分类筛选 */}
      <div className="px-6 mt-4">
        <div className="flex gap-2 overflow-x-auto">
          {categories.map((cat) => (
            <button
              key={cat.value}
              type="button"
              onClick={() => setCategory(cat.value)}
              className={`px-4 py-2 rounded text-base whitespace-nowrap ${
                category === cat.value
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-card border-2 border-border text-foreground'
              }`}>
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* 排序选项 */}
      <div className="px-6 mt-4">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setSortBy('created_at')}
            className={`px-3 py-2 rounded text-base ${
              sortBy === 'created_at'
                ? 'bg-primary text-primary-foreground'
                : 'bg-card border border-border text-foreground'
            }`}>
            时间
          </button>
          <button
            type="button"
            onClick={() => setSortBy('file_size')}
            className={`px-3 py-2 rounded text-base ${
              sortBy === 'file_size'
                ? 'bg-primary text-primary-foreground'
                : 'bg-card border border-border text-foreground'
            }`}>
            大小
          </button>
          <button
            type="button"
            onClick={() => setSortBy('name')}
            className={`px-3 py-2 rounded text-base ${
              sortBy === 'name'
                ? 'bg-primary text-primary-foreground'
                : 'bg-card border border-border text-foreground'
            }`}>
            名称
          </button>
        </div>
      </div>

      {/* 文档列表 */}
      {loading ? (
        <div className="text-center py-12">
          <div className="text-xl text-muted-foreground">加载中...</div>
        </div>
      ) : documents.length === 0 ? (
        <div className="text-center py-12">
          <div className="i-mdi-book-open-variant text-6xl text-muted-foreground mb-4" />
          <div className="text-xl text-foreground">暂无文档</div>
        </div>
      ) : (
        <div className="px-6 mt-4 space-y-3">
          {documents.map((doc) => (
            <div key={doc.id} className="bg-card rounded p-4 border border-border">
              <div className="flex items-start gap-4">
                <div className="i-mdi-file-document text-4xl text-primary" />

                <div className="flex-1">
                  <div className="text-xl text-foreground font-bold">{doc.name}</div>
                  <div className="flex items-center gap-3 mt-2 text-base text-muted-foreground">
                    <span>{getCategoryLabel(doc.category)}</span>
                    <span>•</span>
                    <span>{formatFileSize(doc.file_size)}</span>
                    <span>•</span>
                    <span>{doc.profiles?.name || '未知'}</span>
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    {new Date(doc.created_at).toLocaleDateString('zh-CN')}
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => handleDownload(doc)}
                    className="p-2 bg-primary/10 text-primary rounded flex items-center justify-center leading-none">
                    <div className="i-mdi-download text-2xl" />
                  </button>

                  {canManage && (
                    <button
                      type="button"
                      onClick={() => handleDelete(doc)}
                      className="p-2 bg-destructive/10 text-destructive rounded flex items-center justify-center leading-none">
                      <div className="i-mdi-delete text-2xl" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default withRouteGuard(DocumentsPage)


