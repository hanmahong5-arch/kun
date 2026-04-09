import {useState, useCallback, useEffect} from 'react'
import Taro from '@tarojs/taro'
import {withRouteGuard} from '@/components/RouteGuard'
import {useAuth} from '@/contexts/AuthContext'
import {
  getJobLevelMappings,
  createJobLevelMapping,
  deleteJobLevelMapping,
  batchUpdateJobLevelMappings
} from '@/db/jobLevelMapping'
import type {JobLevelRoleMapping, JobLevel, UserRole} from '@/db/types'
import {JobLevelOptions, RoleDisplayNames} from '@/db/types'

function JobLevelMappingPage() {
  const {profile} = useAuth()
  const [mappings, setMappings] = useState<JobLevelRoleMapping[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [selectedJobLevel, setSelectedJobLevel] = useState<JobLevel | ''>('')
  const [selectedRole, setSelectedRole] = useState<UserRole | ''>('')
  const [showJobLevelPicker, setShowJobLevelPicker] = useState(false)
  const [showRolePicker, setShowRolePicker] = useState(false)

  const roleOptions: UserRole[] = [
    'system_admin',
    'system_admin',
    'leader',
    'market_staff',
    'data_clerk'
  ]

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      const data = await getJobLevelMappings()
      setMappings(data)
    } catch (error) {
      console.error('加载映射失败:', error)
      Taro.showToast({title: '加载失败', icon: 'none'})
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  // 添加映射
  const handleAdd = async () => {
    if (!selectedJobLevel || !selectedRole) {
      Taro.showToast({title: '请选择职级和角色', icon: 'none'})
      return
    }

    try {
      await createJobLevelMapping(selectedJobLevel, selectedRole)
      Taro.showToast({title: '添加成功', icon: 'success'})
      setShowAddDialog(false)
      setSelectedJobLevel('')
      setSelectedRole('')
      loadData()
    } catch (error) {
      console.error('添加映射失败:', error)
      Taro.showToast({title: '添加失败', icon: 'none'})
    }
  }

  // 删除映射
  const handleDelete = async (id: string) => {
    const result = await Taro.showModal({
      title: '确认删除',
      content: '确定要删除这条映射关系吗？'
    })

    if (!result.confirm) return

    try {
      await deleteJobLevelMapping(id)
      Taro.showToast({title: '删除成功', icon: 'success'})
      loadData()
    } catch (error) {
      console.error('删除映射失败:', error)
      Taro.showToast({title: '删除失败', icon: 'none'})
    }
  }

  // 导出配置
  const handleExport = () => {
    try {
      const exportData = mappings.map((m) => ({
        job_level: m.job_level,
        role: m.role
      }))

      const jsonStr = JSON.stringify(exportData, null, 2)

      // 小程序环境：保存为文件
      if (Taro.getEnv() !== 'WEB') {
        const fs = Taro.getFileSystemManager()
        const filePath = `${Taro.env.USER_DATA_PATH}/job_level_mapping.json`

        fs.writeFile({
          filePath,
          data: jsonStr,
          encoding: 'utf8',
          success: () => {
            Taro.showToast({title: '导出成功', icon: 'success'})
            Taro.openDocument({
              filePath,
              showMenu: true
            })
          },
          fail: (err) => {
            console.error('保存文件失败:', err)
            Taro.showToast({title: '导出失败', icon: 'none'})
          }
        })
      } else {
        // H5环境：下载文件
        const blob = new Blob([jsonStr], {type: 'application/json'})
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'job_level_mapping.json'
        a.click()
        URL.revokeObjectURL(url)
        Taro.showToast({title: '导出成功', icon: 'success'})
      }
    } catch (error) {
      console.error('导出失败:', error)
      Taro.showToast({title: '导出失败', icon: 'none'})
    }
  }

  // 导入配置
  const handleImport = async () => {
    try {
      if (Taro.getEnv() !== 'WEB') {
        // 小程序环境：选择文件
        const res = await Taro.chooseMessageFile({
          count: 1,
          type: 'file',
          extension: ['json']
        })

        if (!res.tempFiles || res.tempFiles.length === 0) return

        const fs = Taro.getFileSystemManager()
        const fileContent = fs.readFileSync(res.tempFiles[0].path, 'utf8') as string
        const importData = JSON.parse(fileContent)

        await batchUpdateJobLevelMappings(importData)
        Taro.showToast({title: '导入成功', icon: 'success'})
        loadData()
      } else {
        // H5环境：文件选择器
        const input = document.createElement('input')
        input.type = 'file'
        input.accept = '.json'
        input.onchange = async (e) => {
          const file = (e.target as HTMLInputElement).files?.[0]
          if (!file) return

          const reader = new FileReader()
          reader.onload = async (event) => {
            try {
              const importData = JSON.parse(event.target?.result as string)
              await batchUpdateJobLevelMappings(importData)
              Taro.showToast({title: '导入成功', icon: 'success'})
              loadData()
            } catch (error) {
              console.error('导入失败:', error)
              Taro.showToast({title: '导入失败', icon: 'none'})
            }
          }
          reader.readAsText(file)
        }
        input.click()
      }
    } catch (error) {
      console.error('导入失败:', error)
      Taro.showToast({title: '导入失败', icon: 'none'})
    }
  }

  // 按职级分组
  const groupedMappings = mappings.reduce(
    (acc, mapping) => {
      if (!acc[mapping.job_level]) {
        acc[mapping.job_level] = []
      }
      acc[mapping.job_level].push(mapping)
      return acc
    },
    {} as Record<string, JobLevelRoleMapping[]>
  )

  if (!profile || (profile.role !== 'system_admin' && profile.role !== 'super_admin')) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6">
        <div className="text-center">
          <div className="i-mdi-lock text-6xl text-muted-foreground mb-4" />
          <div className="text-xl text-foreground">暂无权限访问</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background pb-6">
      {/* 头部 */}
      <div className="bg-gradient-primary px-6 py-6">
        <div className="text-2xl text-primary-foreground font-bold">职级权限配置</div>
        <div className="text-base text-primary-foreground/80 mt-1">
          管理职级与角色的映射关系
        </div>
      </div>

      {/* 操作按钮 */}
      <div className="px-6 mt-4">
        <div className="grid grid-cols-3 gap-3">
          <button
            type="button"
            onClick={() => setShowAddDialog(true)}
            className="py-3 bg-primary text-primary-foreground text-xl rounded flex items-center justify-center leading-none gap-2">
            <div className="i-mdi-plus text-2xl" />
            <span>添加</span>
          </button>
          <button
            type="button"
            onClick={handleExport}
            className="py-3 bg-card border-2 border-border text-foreground text-xl rounded flex items-center justify-center leading-none gap-2">
            <div className="i-mdi-export text-2xl" />
            <span>导出</span>
          </button>
          <button
            type="button"
            onClick={handleImport}
            className="py-3 bg-card border-2 border-border text-foreground text-xl rounded flex items-center justify-center leading-none gap-2">
            <div className="i-mdi-import text-2xl" />
            <span>导入</span>
          </button>
        </div>
      </div>

      {/* 映射列表 */}
      <div className="px-6 mt-4">
        {loading ? (
          <div className="text-center py-12">
            <div className="text-xl text-muted-foreground">加载中...</div>
          </div>
        ) : Object.keys(groupedMappings).length === 0 ? (
          <div className="text-center py-12">
            <div className="i-mdi-database-off text-6xl text-muted-foreground mb-4" />
            <div className="text-xl text-muted-foreground">暂无映射配置</div>
          </div>
        ) : (
          <div className="space-y-4">
            {JobLevelOptions.map((jobLevel) => {
              const levelMappings = groupedMappings[jobLevel] || []
              if (levelMappings.length === 0) return null

              return (
                <div key={jobLevel} className="bg-card rounded p-4 border border-border">
                  <div className="text-xl text-foreground font-bold mb-3">{jobLevel}</div>
                  <div className="space-y-2">
                    {levelMappings.map((mapping) => (
                      <div
                        key={mapping.id}
                        className="flex items-center justify-between p-3 bg-muted/30 rounded">
                        <div className="flex items-center gap-3">
                          <div className="i-mdi-account-key text-2xl text-primary" />
                          <div className="text-xl text-foreground">
                            {RoleDisplayNames[mapping.role]}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDelete(mapping.id)}
                          className="p-2 bg-destructive/10 text-destructive rounded flex items-center justify-center leading-none">
                          <div className="i-mdi-delete text-xl" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 添加映射对话框 */}
      {showAddDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-6">
          <div className="bg-card rounded p-6 w-full max-w-md">
            <div className="text-xl text-foreground font-bold mb-4">添加映射关系</div>

            <div className="space-y-4 mb-6">
              {/* 职级选择 */}
              <div>
                <div className="text-base text-foreground mb-2">职级</div>
                <button
                  type="button"
                  onClick={() => setShowJobLevelPicker(true)}
                  className="w-full border-2 border-input rounded px-4 py-3 bg-background text-left flex items-center justify-between">
                  <span className="text-xl text-foreground">
                    {selectedJobLevel || '请选择职级'}
                  </span>
                  <div className="i-mdi-chevron-down text-2xl text-muted-foreground" />
                </button>
              </div>

              {/* 角色选择 */}
              <div>
                <div className="text-base text-foreground mb-2">角色</div>
                <button
                  type="button"
                  onClick={() => setShowRolePicker(true)}
                  className="w-full border-2 border-input rounded px-4 py-3 bg-background text-left flex items-center justify-between">
                  <span className="text-xl text-foreground">
                    {selectedRole ? RoleDisplayNames[selectedRole] : '请选择角色'}
                  </span>
                  <div className="i-mdi-chevron-down text-2xl text-muted-foreground" />
                </button>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowAddDialog(false)
                  setSelectedJobLevel('')
                  setSelectedRole('')
                }}
                className="flex-1 py-3 bg-card border-2 border-border text-foreground text-xl rounded flex items-center justify-center leading-none">
                取消
              </button>
              <button
                type="button"
                onClick={handleAdd}
                className="flex-1 py-3 bg-primary text-primary-foreground text-xl rounded flex items-center justify-center leading-none">
                确定
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 职级选择器 */}
      {showJobLevelPicker && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-6">
          <div className="bg-card rounded p-6 w-full max-w-md">
            <div className="text-xl text-foreground font-bold mb-4">选择职级</div>

            <div className="max-h-[60vh] overflow-y-auto mb-4">
              {JobLevelOptions.map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => {
                    setSelectedJobLevel(level)
                    setShowJobLevelPicker(false)
                  }}
                  className={`w-full p-4 mb-2 rounded text-left flex items-center justify-between ${
                    selectedJobLevel === level
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted/30 text-foreground'
                  }`}>
                  <span className="text-xl">{level}</span>
                  {selectedJobLevel === level && <div className="i-mdi-check text-2xl" />}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setShowJobLevelPicker(false)}
              className="w-full py-3 bg-card border-2 border-border text-foreground text-xl rounded flex items-center justify-center leading-none">
              取消
            </button>
          </div>
        </div>
      )}

      {/* 角色选择器 */}
      {showRolePicker && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-6">
          <div className="bg-card rounded p-6 w-full max-w-md">
            <div className="text-xl text-foreground font-bold mb-4">选择角色</div>

            <div className="max-h-[60vh] overflow-y-auto mb-4">
              {roleOptions.map((role) => (
                <button
                  key={role}
                  type="button"
                  onClick={() => {
                    setSelectedRole(role)
                    setShowRolePicker(false)
                  }}
                  className={`w-full p-4 mb-2 rounded text-left flex items-center justify-between ${
                    selectedRole === role
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted/30 text-foreground'
                  }`}>
                  <span className="text-xl">{RoleDisplayNames[role]}</span>
                  {selectedRole === role && <div className="i-mdi-check text-2xl" />}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setShowRolePicker(false)}
              className="w-full py-3 bg-card border-2 border-border text-foreground text-xl rounded flex items-center justify-center leading-none">
              取消
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default withRouteGuard(JobLevelMappingPage)
