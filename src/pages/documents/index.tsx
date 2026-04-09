import {useState, useCallback, useEffect, useMemo} from 'react'
import {isAdmin, isLeaderOrAdmin} from '@/db/permissions-utils'
import Taro, {useDidShow} from '@tarojs/taro'
import {withRouteGuard} from '@/components/RouteGuard'
import {useAuth} from '@/contexts/AuthContext'
import {getDocuments, deleteDocument, uploadDocument, createDocument} from '@/db/documents'
import type {Document} from '@/db/types'

const DEFAULT_CATEGORIES = [
  {value: 'standard', label: '标准规范'},
  {value: 'template', label: '模板文档'},
  {value: 'manual', label: '操作手册'},
  {value: 'other', label: '其他'}
]

function DocumentsPage() {
  const {profile} = useAuth()
  const [documents, setDocuments] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [category, setCategory] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<'created_at' | 'file_size' | 'name'>('created_at')
  const [showCategoryPicker, setShowCategoryPicker] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [pendingFile, setPendingFile] = useState<{data: any; name: string; type: string; size: number; isH5: boolean} | null>(null)

  const canManage =
    isAdmin(profile) ||
    profile?.role === 'data_clerk'

  // Merge default categories with custom ones from existing documents
  const allCategories = useMemo(() => {
    const customCats = documents
      .map((d) => d.category)
      .filter((c) => c && !DEFAULT_CATEGORIES.some((dc) => dc.value === c))
    const uniqueCustom = [...new Set(customCats)]
    return [
      ...DEFAULT_CATEGORIES,
      ...uniqueCustom.map((c) => ({value: c, label: c}))
    ]
  }, [documents])

  const categories = [{value: 'all', label: '全部'}, ...allCategories]

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

  const isH5 = Taro.getEnv() === Taro.ENV_TYPE.WEB

  // H5 file input ref handler
  const handleFileInputChange = (e: any) => {
    const file = e.target?.files?.[0]
    if (!file) return
    if (!validateFile(file.name, file.size)) {
      e.target.value = ''
      return
    }
    setPendingFile({data: file, name: file.name, type: file.type, size: file.size, isH5: true})
    setShowCategoryPicker(true)
    e.target.value = ''
  }

  const validateFile = (fileName: string, fileSize: number): boolean => {
    if (fileSize > 10 * 1024 * 1024) {
      Taro.showToast({title: '文件大小不能超过10MB', icon: 'none'})
      return false
    }
    const allowedExtensions = ['.pdf', '.doc', '.docx', '.xls', '.xlsx']
    const ext = fileName.toLowerCase().substring(fileName.lastIndexOf('.'))
    if (!allowedExtensions.includes(ext)) {
      Taro.showToast({title: '仅支持PDF、Word、Excel格式', icon: 'none'})
      return false
    }
    return true
  }

  const handleSelectCategory = async (selectedCategory: string) => {
    if (!pendingFile) return
    setShowCategoryPicker(false)
    setNewCategoryName('')

    try {
      Taro.showLoading({title: '上传中...'})

      if (!profile?.id) {
        throw new Error('用户未登录')
      }

      const uploadPayload = pendingFile.isH5 ? pendingFile.data : {tempFilePath: pendingFile.data, name: pendingFile.name, type: pendingFile.type}
      const {data: uploadData, error: uploadError} = await uploadDocument(uploadPayload, profile.id as string)

      if (uploadError || !uploadData) throw uploadError

      const {error: createError} = await createDocument({
        name: pendingFile.name,
        category: selectedCategory,
        file_size: pendingFile.size,
        file_path: uploadData.path,
        file_type: pendingFile.type,
        uploaded_by: profile.id as string
      })

      if (createError) throw createError

      Taro.showToast({title: '上传成功', icon: 'success'})
      setPendingFile(null)
      loadData()
    } catch (error) {
      console.error('上传文档失败:', error)
      Taro.showToast({title: '上传失败', icon: 'none'})
    } finally {
      Taro.hideLoading()
    }
  }

  const handleUpload = async () => {
    if (isH5) {
      const input = document.getElementById('doc-file-input')
      if (input) input.click()
      return
    }

    try {
      const res = await Taro.chooseMessageFile({
        count: 1,
        type: 'file'
      })

      if (!res.tempFiles || res.tempFiles.length === 0) return

      const file = res.tempFiles[0]
      if (!validateFile(file.name, file.size)) return
      setPendingFile({data: file.path, name: file.name, type: file.type, size: file.size, isH5: false})
      setShowCategoryPicker(true)
    } catch (error) {
      console.error('选择文件失败:', error)
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
      {/* H5 hidden file input */}
      {isH5 && (
        <input
          id="doc-file-input"
          type="file"
          accept=".pdf,.doc,.docx,.xls,.xlsx"
          onChange={handleFileInputChange}
          style={{display: 'none'}}
        />
      )}
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

      {/* Category picker modal */}
      {showCategoryPicker && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
          <div className="w-full max-w-lg bg-card rounded-t-xl p-6 animate-slide-up">
            <div className="text-xl text-foreground font-bold mb-4">选择文件类型</div>

            <div className="flex flex-wrap gap-2 mb-4">
              {allCategories.map((cat) => (
                <button
                  key={cat.value}
                  type="button"
                  onClick={() => handleSelectCategory(cat.value)}
                  className="px-4 py-2 bg-muted rounded text-base text-foreground border border-border">
                  {cat.label}
                </button>
              ))}
            </div>

            <div className="text-base text-muted-foreground mb-2">或创建新类型</div>
            <div className="flex gap-2">
              <div className="flex-1 border-2 border-input rounded px-3 py-2 bg-background">
                <input
                  type="text"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="输入新类型名称"
                  className="w-full text-base text-foreground bg-transparent outline-none"
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!newCategoryName.trim()) {
                    Taro.showToast({title: '请输入类型名称', icon: 'none'})
                    return
                  }
                  handleSelectCategory(newCategoryName.trim())
                }}
                className="px-4 py-2 bg-primary text-primary-foreground text-base rounded">
                确定
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                setShowCategoryPicker(false)
                setPendingFile(null)
                setNewCategoryName('')
              }}
              className="w-full mt-4 py-3 bg-muted text-muted-foreground text-base rounded">
              取消
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default withRouteGuard(DocumentsPage)


