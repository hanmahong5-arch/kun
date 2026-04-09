import {useState, useCallback, useEffect, useMemo, useRef} from 'react'
import {isAdmin} from '@/db/permissions-utils'
import Taro, {useDidShow} from '@tarojs/taro'
import {withRouteGuard} from '@/components/RouteGuard'
import {useAuth} from '@/contexts/AuthContext'
import {getDocuments, getDocumentCategories, getDocumentUrl, deleteDocument, uploadDocument, createDocument} from '@/db/documents'

const ALLOWED_EXTENSIONS = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.jpg', '.jpeg', '.png']
const ACCEPT_STRING = ALLOWED_EXTENSIONS.join(',')
const MAX_FILE_SIZE = 10 * 1024 * 1024

const DEFAULT_CATEGORIES = [
  {value: 'standard', label: '标准规范'},
  {value: 'template', label: '模板文档'},
  {value: 'manual', label: '操作手册'},
  {value: 'other', label: '其他'}
]

const FILE_ICON_MAP: Record<string, string> = {
  pdf: 'i-mdi-file-pdf-box text-red-500',
  doc: 'i-mdi-file-word-box text-blue-500',
  docx: 'i-mdi-file-word-box text-blue-500',
  xls: 'i-mdi-file-excel-box text-green-600',
  xlsx: 'i-mdi-file-excel-box text-green-600',
  ppt: 'i-mdi-file-powerpoint-box text-orange-500',
  pptx: 'i-mdi-file-powerpoint-box text-orange-500',
  jpg: 'i-mdi-file-image text-purple-500',
  jpeg: 'i-mdi-file-image text-purple-500',
  png: 'i-mdi-file-image text-purple-500',
}

function getFileIcon(fileName: string): string {
  const ext = fileName.toLowerCase().split('.').pop() || ''
  return FILE_ICON_MAP[ext] || 'i-mdi-file-document text-primary'
}

function DocumentsPage() {
  const {profile} = useAuth()
  const [documents, setDocuments] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [category, setCategory] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<'created_at' | 'file_size' | 'name'>('created_at')
  const [showCategoryPicker, setShowCategoryPicker] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [dbCategories, setDbCategories] = useState<string[]>([])
  const pendingCategoryRef = useRef<string | null>(null)

  const canUpload = isAdmin(profile) || profile?.role === 'data_clerk'
  const canDelete = isAdmin(profile)

  // Merge default categories with custom ones from DB
  const allCategories = useMemo(() => {
    const customs = dbCategories.filter((c) => !DEFAULT_CATEGORIES.some((dc) => dc.value === c))
    return [
      ...DEFAULT_CATEGORIES,
      ...customs.map((c) => ({value: c, label: c}))
    ]
  }, [dbCategories])

  const categories = [{value: 'all', label: '全部'}, ...allCategories]

  const loadCategories = useCallback(async () => {
    const cats = await getDocumentCategories()
    setDbCategories(cats)
  }, [])

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
    loadCategories()
  })

  useEffect(() => {
    loadData()
  }, [loadData])

  useEffect(() => {
    loadCategories()
  }, [loadCategories])

  const getCategoryLabel = (cat: string) => {
    return categories.find((c) => c.value === cat)?.label || cat
  }

  const isH5 = Taro.getEnv() === Taro.ENV_TYPE.WEB

  const validateFile = (fileName: string, fileSize: number): boolean => {
    if (fileSize > MAX_FILE_SIZE) {
      Taro.showToast({title: '文件不能超过10MB', icon: 'none'})
      return false
    }
    const ext = fileName.toLowerCase().substring(fileName.lastIndexOf('.'))
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      Taro.showToast({title: '不支持该文件格式', icon: 'none'})
      return false
    }
    return true
  }

  // H5 file input handler
  const handleFileInputChange = async (e: any) => {
    const file = e.target?.files?.[0]
    if (!file) return
    if (!validateFile(file.name, file.size)) {
      e.target.value = ''
      return
    }
    e.target.value = ''
    await doUpload({data: file, name: file.name, type: file.type, size: file.size, isH5: true}, pendingCategoryRef.current || undefined)
  }

  // Upload file with the given category
  const doUpload = async (fileInfo: {data: any; name: string; type: string; size: number; isH5: boolean}, cat?: string) => {
    if (!cat) return

    try {
      Taro.showLoading({title: '上传中...'})

      if (!profile?.id) throw new Error('用户未登录')

      const uploadPayload = fileInfo.isH5 ? fileInfo.data : {tempFilePath: fileInfo.data, name: fileInfo.name, type: fileInfo.type}
      const {data: uploadData, error: uploadError} = await uploadDocument(uploadPayload, profile.id as string)

      if (uploadError || !uploadData) throw uploadError

      const {error: createError} = await createDocument({
        name: fileInfo.name,
        category: cat,
        file_size: fileInfo.size,
        file_path: uploadData.path,
        file_type: fileInfo.type,
        uploaded_by: profile.id as string
      })

      if (createError) throw createError

      Taro.showToast({title: '上传成功', icon: 'success'})
      pendingCategoryRef.current = null
      loadData()
      loadCategories()
    } catch (error) {
      console.error('上传文档失败:', error)
      Taro.showToast({title: '上传失败', icon: 'none'})
    } finally {
      Taro.hideLoading()
    }
  }

  // Step 1: show category picker
  const handleUpload = () => {
    setShowCategoryPicker(true)
  }

  // Step 2: category selected → trigger file picker
  const handleSelectCategory = (selectedCategory: string) => {
    setShowCategoryPicker(false)
    setNewCategoryName('')
    pendingCategoryRef.current = selectedCategory

    if (isH5) {
      setTimeout(() => {
        const input = document.getElementById('doc-file-input')
        if (input) input.click()
      }, 100)
    } else {
      handleWeAppFilePick(selectedCategory)
    }
  }

  // WeChat file picker
  const handleWeAppFilePick = async (selectedCategory: string) => {
    try {
      const res = await Taro.chooseMessageFile({count: 1, type: 'file'})
      if (!res.tempFiles || res.tempFiles.length === 0) return

      const file = res.tempFiles[0]
      if (!validateFile(file.name, file.size)) return
      await doUpload({data: file.path, name: file.name, type: file.type, size: file.size, isH5: false}, selectedCategory)
    } catch (error) {
      console.error('选择文件失败:', error)
      pendingCategoryRef.current = null
    }
  }

  // Download / preview document
  const handleDownload = (doc: any) => {
    if (!doc.file_path) {
      Taro.showToast({title: '文件路径无效', icon: 'none'})
      return
    }

    const url = getDocumentUrl(doc.file_path)
    const ext = doc.name?.toLowerCase().split('.').pop() || ''

    if (isH5) {
      // H5: open in new tab (PDF/images preview natively, others download)
      window.open(url, '_blank')
    } else {
      // WeChat: download then open with system viewer
      Taro.showLoading({title: '下载中...'})
      Taro.downloadFile({
        url,
        success: (res) => {
          Taro.hideLoading()
          if (res.statusCode === 200) {
            Taro.openDocument({
              filePath: res.tempFilePath,
              fileType: ext as any,
              showMenu: true,
              fail: () => Taro.showToast({title: '无法打开此文件', icon: 'none'})
            })
          } else {
            Taro.showToast({title: '下载失败', icon: 'none'})
          }
        },
        fail: () => {
          Taro.hideLoading()
          Taro.showToast({title: '下载失败', icon: 'none'})
        }
      })
    }
  }

  const handleDelete = async (doc: any) => {
    const res = await Taro.showModal({
      title: '确认删除',
      content: `确定要删除文档"${doc.name}"吗？此操作不可恢复。`,
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
      loadCategories()
    } catch (error) {
      console.error('删除文档失败:', error)
      Taro.showToast({title: '删除失败', icon: 'none'})
    } finally {
      Taro.hideLoading()
    }
  }

  const formatFileSize = (bytes: number) => {
    if (!bytes) return '-'
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  }

  return (
    <div className="min-h-screen bg-background pb-6">
      {/* H5 hidden file input */}
      {isH5 && (
        <input
          id="doc-file-input"
          type="file"
          accept={ACCEPT_STRING}
          onChange={handleFileInputChange}
          style={{display: 'none'}}
        />
      )}

      {/* Header */}
      <div className="bg-gradient-primary px-6 py-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-2xl text-primary-foreground font-bold">知识库</div>
            <div className="text-base text-primary-foreground/80 mt-1">
              共 {documents.length} 个文档
            </div>
          </div>
          {canUpload && (
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

      {/* Search */}
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

      {/* Category filter */}
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

      {/* Sort */}
      <div className="px-6 mt-4">
        <div className="flex gap-2">
          {([['created_at', '时间'], ['file_size', '大小'], ['name', '名称']] as const).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setSortBy(key)}
              className={`px-3 py-2 rounded text-base ${
                sortBy === key
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-card border border-border text-foreground'
              }`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Document list */}
      {loading ? (
        <div className="text-center py-12">
          <div className="text-xl text-muted-foreground">加载中...</div>
        </div>
      ) : documents.length === 0 ? (
        <div className="text-center py-12">
          <div className="i-mdi-book-open-variant text-6xl text-muted-foreground mb-4" />
          <div className="text-xl text-foreground mb-2">暂无文档</div>
          <div className="text-sm text-muted-foreground">
            支持 PDF、Word、Excel、PPT、图片，单文件 ≤ 10MB
          </div>
        </div>
      ) : (
        <div className="px-6 mt-4 space-y-3">
          {documents.map((doc) => (
            <div
              key={doc.id}
              onClick={() => handleDownload(doc)}
              className="bg-card rounded p-4 border border-border active:bg-muted/50">
              <div className="flex items-start gap-4">
                <div className={`${getFileIcon(doc.name)} text-4xl`} />

                <div className="flex-1 min-w-0">
                  <div className="text-xl text-foreground font-bold truncate">{doc.name}</div>
                  <div className="flex items-center gap-3 mt-2 text-base text-muted-foreground">
                    <span>{getCategoryLabel(doc.category)}</span>
                    <span>·</span>
                    <span>{formatFileSize(doc.file_size)}</span>
                    <span>·</span>
                    <span>{doc.profiles?.name || '未知'}</span>
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    {new Date(doc.created_at).toLocaleDateString('zh-CN')}
                  </div>
                </div>

                <div className="flex flex-col gap-2 flex-shrink-0">
                  <div className="p-2 bg-primary/10 text-primary rounded flex items-center justify-center leading-none">
                    <div className="i-mdi-open-in-new text-2xl" />
                  </div>

                  {canDelete && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDelete(doc)
                      }}
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

      {/* Info footer */}
      {documents.length > 0 && (
        <div className="px-6 mt-6">
          <div className="text-sm text-muted-foreground text-center">
            支持 PDF、Word、Excel、PPT、图片 | 单文件 ≤ 10MB | 文件永久保存 | 仅管理员可删除
          </div>
        </div>
      )}

      {/* Category picker modal */}
      {showCategoryPicker && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
          <div className="w-full max-w-lg bg-card rounded-t-xl p-6">
            <div className="text-xl text-foreground font-bold mb-2">选择文件类型</div>
            <div className="text-sm text-muted-foreground mb-4">
              支持 PDF、Word、Excel、PPT、图片，单文件不超过 10MB
            </div>

            <div className="flex flex-wrap gap-2 mb-4">
              {allCategories.map((cat) => (
                <button
                  key={cat.value}
                  type="button"
                  onClick={() => handleSelectCategory(cat.value)}
                  className="px-4 py-2 bg-muted rounded text-base text-foreground border border-border active:bg-primary active:text-primary-foreground">
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
                  onInput={(e) => {
                    const ev = e as any
                    setNewCategoryName(ev.detail?.value ?? ev.target?.value ?? '')
                  }}
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
                pendingCategoryRef.current = null
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
