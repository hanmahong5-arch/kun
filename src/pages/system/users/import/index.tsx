import {useState} from 'react'
import Taro from '@tarojs/taro'
import * as XLSX from 'xlsx'
import {withRouteGuard} from '@/components/RouteGuard'
import {supabase} from '@/client/supabase'
import type {UserRole} from '@/db/types'

interface ImportUser {
  phone: string
  name: string
  role: UserRole
  department?: string
  status?: 'valid' | 'invalid'
  error?: string
}

function UserImportPage() {
  const [step, setStep] = useState<'upload' | 'mapping' | 'preview' | 'result'>('upload')
  const [fileData, setFileData] = useState<string[][]>([])
  const [headers, setHeaders] = useState<string[]>([])
  const [fieldMapping, setFieldMapping] = useState<Record<string, string>>({
    phone: '',
    name: '',
    role: '',
    department: ''
  })
  const [users, setUsers] = useState<ImportUser[]>([])
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{
    success: number
    failed: number
    errors: string[]
  }>({success: 0, failed: 0, errors: []})

  // 下载模板
  const handleDownloadTemplate = () => {
    try {
      // 创建模板数据
      const templateData = [
        ['手机号', '姓名', '角色', '部门', '职级'],
        ['13800138000', '张三', 'market_staff', '经营中心', '一级职员'],
        ['13900139000', '李四', 'leader', '管理层', '主要领导'],
        ['13700137000', '王五', 'data_clerk', '资料室', '资料员']
      ]

      // 创建工作簿
      const wb = XLSX.utils.book_new()
      const ws = XLSX.utils.aoa_to_sheet(templateData)

      // 设置列宽
      ws['!cols'] = [
        {wch: 15}, // 手机号
        {wch: 10}, // 姓名
        {wch: 15}, // 角色
        {wch: 15}, // 部门
        {wch: 15} // 职级
      ]

      // 添加工作表
      XLSX.utils.book_append_sheet(wb, ws, '用户导入模板')

      // 生成Excel文件
      const wbout = XLSX.write(wb, {bookType: 'xlsx', type: 'binary'})

      // 判断环境
      if (Taro.getEnv() === 'WEB') {
        // H5环境：直接下载
        const blob = new Blob([s2ab(wbout)], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = '用户导入模板.xlsx'
        a.click()
        URL.revokeObjectURL(url)
        Taro.showToast({title: '模板已下载', icon: 'success'})
      } else {
        // 小程序环境：保存并打开
        const buf = new ArrayBuffer(wbout.length)
        const view = new Uint8Array(buf)
        for (let i = 0; i < wbout.length; i++) {
          view[i] = wbout.charCodeAt(i) & 0xff
        }

        const fs = Taro.getFileSystemManager()
        const filePath = `${Taro.env.USER_DATA_PATH}/用户导入模板.xlsx`

        fs.writeFile({
          filePath,
          data: buf,
          encoding: 'binary',
          success: () => {
            Taro.showToast({title: '模板已生成', icon: 'success'})
            Taro.openDocument({
              filePath,
              fileType: 'xlsx',
              showMenu: true
            })
          },
          fail: (err) => {
            console.error('保存模板失败:', err)
            Taro.showToast({title: '保存失败', icon: 'none'})
          }
        })
      }
    } catch (error) {
      console.error('生成模板失败:', error)
      Taro.showToast({title: '生成失败', icon: 'none'})
    }
  }

  // 辅助函数：字符串转ArrayBuffer
  const s2ab = (s: string) => {
    const buf = new ArrayBuffer(s.length)
    const view = new Uint8Array(buf)
    for (let i = 0; i < s.length; i++) {
      view[i] = s.charCodeAt(i) & 0xff
    }
    return buf
  }

  // 选择文件
  const handleSelectFile = async () => {
    try {
      const res = await Taro.chooseMessageFile({
        count: 1,
        type: 'file',
        extension: ['xlsx', 'xls', 'csv']
      })

      if (res.tempFiles && res.tempFiles.length > 0) {
        const file = res.tempFiles[0]
        await parseFile(file.path)
      }
    } catch (error) {
      console.error('选择文件失败:', error)
      Taro.showToast({title: '选择文件失败', icon: 'none'})
    }
  }

  // 解析文件
  const parseFile = async (filePath: string) => {
    try {
      Taro.showLoading({title: '解析中...'})

      // 读取文件
      const fs = Taro.getFileSystemManager()
      const fileContent = fs.readFileSync(filePath, 'binary')

      // 解析Excel
      const workbook = XLSX.read(fileContent, {type: 'binary'})
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
      const data = XLSX.utils.sheet_to_json<string[]>(firstSheet, {header: 1})

      if (data.length < 2) {
        Taro.showToast({title: '文件数据不足', icon: 'none'})
        return
      }

      // 第一行作为表头
      const headerRow = data[0] as string[]
      const dataRows = data.slice(1) as string[][]

      setHeaders(headerRow)
      setFileData(dataRows)
      setStep('mapping')

      Taro.hideLoading()
      Taro.showToast({title: '解析成功', icon: 'success'})
    } catch (error) {
      console.error('解析文件失败:', error)
      Taro.hideLoading()
      Taro.showToast({title: '解析失败', icon: 'none'})
    }
  }

  // 字段映射
  const handleMapping = () => {
    if (!fieldMapping.phone || !fieldMapping.name || !fieldMapping.role) {
      Taro.showToast({title: '请完成必填字段映射', icon: 'none'})
      return
    }

    // 根据映射生成用户数据
    const mappedUsers: ImportUser[] = fileData.map((row) => {
      const user: ImportUser = {
        phone: row[parseInt(fieldMapping.phone)] || '',
        name: row[parseInt(fieldMapping.name)] || '',
        role: (row[parseInt(fieldMapping.role)] || 'market_staff') as UserRole,
        department: fieldMapping.department ? row[parseInt(fieldMapping.department)] : undefined,
        status: 'valid'
      }

      // 数据校验
      if (!user.phone || !/^1[3-9]\d{9}$/.test(user.phone)) {
        user.status = 'invalid'
        user.error = '手机号格式错误'
      } else if (!user.name) {
        user.status = 'invalid'
        user.error = '姓名不能为空'
      }

      return user
    })

    setUsers(mappedUsers)
    setStep('preview')
  }

  // 批量导入
  const handleImport = async () => {
    const validUsers = users.filter((u) => u.status === 'valid')

    if (validUsers.length === 0) {
      Taro.showToast({title: '没有有效数据', icon: 'none'})
      return
    }

    setImporting(true)
    const errors: string[] = []
    let successCount = 0
    let failedCount = 0

    try {
      for (const user of validUsers) {
        try {
          // 1. 创建auth用户
          const email = `${user.phone}@phone.com`
          const password = '123456' // 默认密码

          const {data: authData, error: authError} = await supabase.auth.admin.createUser({
            email,
            password,
            phone: user.phone,
            email_confirm: true,
            phone_confirm: true,
            user_metadata: {phone: user.phone}
          })

          if (authError) throw authError
          if (!authData.user) throw new Error('创建用户失败')

          // 2. 创建profile记录
          const {error: profileError} = await supabase.from('profiles').insert({
            id: authData.user.id,
            phone: user.phone,
            name: user.name,
            role: user.role,
            department: user.department || null,
            status: 'approved',
            approved_at: new Date().toISOString()
          })

          if (profileError) throw profileError

          successCount++
        } catch (error) {
          failedCount++
          const err = error as Error
          errors.push(`${user.name}(${user.phone}): ${err.message}`)
        }
      }

      setImportResult({success: successCount, failed: failedCount, errors})
      setStep('result')
    } catch (error) {
      console.error('批量导入失败:', error)
      Taro.showToast({title: '导入失败', icon: 'none'})
    } finally {
      setImporting(false)
    }
  }

  // 重新开始
  const handleReset = () => {
    setStep('upload')
    setFileData([])
    setHeaders([])
    setFieldMapping({phone: '', name: '', role: '', department: ''})
    setUsers([])
    setImportResult({success: 0, failed: 0, errors: []})
  }

  return (
    <div className="min-h-screen bg-background pb-6">
      {/* 页面标题 */}
      <div className="px-6 py-6 bg-gradient-primary">
        <div className="text-3xl text-primary-foreground font-bold mb-2">批量导入用户</div>
        <div className="text-xl text-primary-foreground/80">从Excel/CSV文件导入用户数据</div>
      </div>

      {/* 步骤指示器 */}
      <div className="px-6 mt-4">
        <div className="flex items-center justify-between">
          {[
            {key: 'upload', label: '上传文件'},
            {key: 'mapping', label: '字段映射'},
            {key: 'preview', label: '预览数据'},
            {key: 'result', label: '导入结果'}
          ].map((s, index) => (
            <div key={s.key} className="flex items-center flex-1">
              <div className="flex flex-col items-center flex-1">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-xl font-bold ${
                    step === s.key
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  }`}>
                  {index + 1}
                </div>
                <div
                  className={`text-sm mt-1 ${
                    step === s.key ? 'text-primary font-bold' : 'text-muted-foreground'
                  }`}>
                  {s.label}
                </div>
              </div>
              {index < 3 && (
                <div className="w-12 h-1 bg-muted" style={{marginTop: '-20px'}} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 步骤内容 */}
      <div className="px-6 mt-6">
        {/* 步骤1：上传文件 */}
        {step === 'upload' && (
          <div className="bg-card rounded p-6 border border-border">
            <div className="text-center">
              <div className="i-mdi-file-upload text-[80px] text-primary mb-4" />
              <div className="text-xl text-foreground font-bold mb-2">选择文件</div>
              <div className="text-base text-muted-foreground mb-6">
                支持Excel (.xlsx, .xls) 和 CSV 格式
              </div>
              <div className="flex gap-3 justify-center">
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="px-6 py-4 bg-card border-2 border-primary text-primary text-xl rounded flex items-center justify-center leading-none gap-2">
                  <div className="i-mdi-download text-2xl" />
                  <span>下载模板</span>
                </button>
                <button
                  type="button"
                  onClick={handleSelectFile}
                  className="px-6 py-4 bg-primary text-primary-foreground text-xl rounded flex items-center justify-center leading-none gap-2">
                  <div className="i-mdi-folder-open text-2xl" />
                  <span>选择文件</span>
                </button>
              </div>
            </div>

            {/* 使用说明 */}
            <div className="mt-6 p-4 bg-muted/50 rounded">
              <div className="text-base text-foreground font-bold mb-2">文件格式要求：</div>
              <div className="text-sm text-muted-foreground space-y-1">
                <div>• 第一行必须是表头（字段名）</div>
                <div>• 必须包含：手机号、姓名、角色</div>
                <div>• 可选字段：部门</div>
                <div>• 手机号格式：11位数字</div>
                <div>• 角色可选值：leader、market_staff、data_clerk、system_admin</div>
              </div>
            </div>

            {/* 模板说明 */}
            <div className="mt-4 p-4 bg-primary/10 rounded border border-primary/30">
              <div className="flex items-start gap-3">
                <div className="i-mdi-information text-2xl text-primary mt-1" />
                <div className="flex-1">
                  <div className="text-base text-foreground font-bold mb-2">模板说明</div>
                  <div className="text-sm text-muted-foreground space-y-1">
                    <div>• 模板包含标准字段和示例数据</div>
                    <div>• 下载后可直接填写或参考格式</div>
                    <div>• 建议先下载模板，按格式填写后再导入</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 步骤2：字段映射 */}
        {step === 'mapping' && (
          <div className="bg-card rounded p-5 border border-border flex flex-col gap-4">
            <div className="text-xl text-foreground font-bold mb-2">字段映射</div>
            <div className="text-base text-muted-foreground mb-4">
              将文件中的列映射到系统字段
            </div>

            {/* 手机号 */}
            <div>
              <div className="text-xl text-foreground mb-2">
                手机号<span className="text-destructive ml-1">*</span>
              </div>
              <div className="border-2 border-input rounded px-4 py-3 bg-card overflow-hidden">
                <select
                  value={fieldMapping.phone}
                  onChange={(e) => {
                    const ev = e as unknown
                    setFieldMapping({
                      ...fieldMapping,
                      phone:
                        (ev as {detail?: {value?: string}}).detail?.value ??
                        (ev as {target?: {value?: string}}).target?.value ??
                        ''
                    })
                  }}
                  className="w-full text-xl text-foreground bg-transparent outline-none">
                  <option value="">请选择列</option>
                  {headers.map((header, index) => (
                    <option key={index} value={index.toString()}>
                      {header}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* 姓名 */}
            <div>
              <div className="text-xl text-foreground mb-2">
                姓名<span className="text-destructive ml-1">*</span>
              </div>
              <div className="border-2 border-input rounded px-4 py-3 bg-card overflow-hidden">
                <select
                  value={fieldMapping.name}
                  onChange={(e) => {
                    const ev = e as unknown
                    setFieldMapping({
                      ...fieldMapping,
                      name:
                        (ev as {detail?: {value?: string}}).detail?.value ??
                        (ev as {target?: {value?: string}}).target?.value ??
                        ''
                    })
                  }}
                  className="w-full text-xl text-foreground bg-transparent outline-none">
                  <option value="">请选择列</option>
                  {headers.map((header, index) => (
                    <option key={index} value={index.toString()}>
                      {header}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* 角色 */}
            <div>
              <div className="text-xl text-foreground mb-2">
                角色<span className="text-destructive ml-1">*</span>
              </div>
              <div className="border-2 border-input rounded px-4 py-3 bg-card overflow-hidden">
                <select
                  value={fieldMapping.role}
                  onChange={(e) => {
                    const ev = e as unknown
                    setFieldMapping({
                      ...fieldMapping,
                      role:
                        (ev as {detail?: {value?: string}}).detail?.value ??
                        (ev as {target?: {value?: string}}).target?.value ??
                        ''
                    })
                  }}
                  className="w-full text-xl text-foreground bg-transparent outline-none">
                  <option value="">请选择列</option>
                  {headers.map((header, index) => (
                    <option key={index} value={index.toString()}>
                      {header}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* 部门 */}
            <div>
              <div className="text-xl text-foreground mb-2">部门</div>
              <div className="border-2 border-input rounded px-4 py-3 bg-card overflow-hidden">
                <select
                  value={fieldMapping.department}
                  onChange={(e) => {
                    const ev = e as unknown
                    setFieldMapping({
                      ...fieldMapping,
                      department:
                        (ev as {detail?: {value?: string}}).detail?.value ??
                        (ev as {target?: {value?: string}}).target?.value ??
                        ''
                    })
                  }}
                  className="w-full text-xl text-foreground bg-transparent outline-none">
                  <option value="">请选择列（可选）</option>
                  {headers.map((header, index) => (
                    <option key={index} value={index.toString()}>
                      {header}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* 按钮 */}
            <div className="flex gap-3 mt-4">
              <button
                type="button"
                onClick={() => setStep('upload')}
                className="flex-1 py-4 bg-card border-2 border-border text-foreground text-xl rounded flex items-center justify-center leading-none">
                上一步
              </button>
              <button
                type="button"
                onClick={handleMapping}
                className="flex-1 py-4 bg-primary text-primary-foreground text-xl rounded flex items-center justify-center leading-none">
                下一步
              </button>
            </div>
          </div>
        )}

        {/* 步骤3：预览数据 */}
        {step === 'preview' && (
          <div className="bg-card rounded border border-border">
            <div className="px-5 py-4 border-b border-border">
              <div className="text-xl text-foreground font-bold">数据预览</div>
              <div className="text-base text-muted-foreground mt-1">
                共 {users.length} 条数据，有效 {users.filter((u) => u.status === 'valid').length}{' '}
                条
              </div>
            </div>

            <div className="p-2 max-h-96 overflow-y-auto">
              {users.map((user, index) => (
                <div
                  key={index}
                  className={`p-3 mb-2 rounded ${
                    user.status === 'valid' ? 'bg-muted/30' : 'bg-destructive/10'
                  }`}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="text-xl text-foreground font-bold">{user.name}</div>
                      <div className="text-base text-muted-foreground mt-1">
                        {user.phone} | {user.role}
                        {user.department && ` | ${user.department}`}
                      </div>
                      {user.error && (
                        <div className="text-sm text-destructive mt-1">{user.error}</div>
                      )}
                    </div>
                    <div
                      className={`px-2 py-1 rounded text-sm ${
                        user.status === 'valid'
                          ? 'bg-primary/10 text-primary'
                          : 'bg-destructive/10 text-destructive'
                      }`}>
                      {user.status === 'valid' ? '有效' : '无效'}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="px-5 py-4 border-t border-border flex gap-3">
              <button
                type="button"
                onClick={() => setStep('mapping')}
                className="flex-1 py-4 bg-card border-2 border-border text-foreground text-xl rounded flex items-center justify-center leading-none">
                上一步
              </button>
              <button
                type="button"
                onClick={handleImport}
                disabled={importing || users.filter((u) => u.status === 'valid').length === 0}
                className={`flex-1 py-4 bg-primary text-primary-foreground text-xl rounded flex items-center justify-center leading-none ${
                  importing || users.filter((u) => u.status === 'valid').length === 0
                    ? 'opacity-50'
                    : ''
                }`}>
                {importing ? '导入中...' : '开始导入'}
              </button>
            </div>
          </div>
        )}

        {/* 步骤4：导入结果 */}
        {step === 'result' && (
          <div className="bg-card rounded p-6 border border-border">
            <div className="text-center mb-6">
              <div className="i-mdi-check-circle text-[80px] text-primary mb-4" />
              <div className="text-2xl text-foreground font-bold mb-2">导入完成</div>
            </div>

            <div className="flex gap-4 mb-6">
              <div className="flex-1 bg-primary/10 rounded p-4 text-center">
                <div className="text-3xl text-primary font-bold">{importResult.success}</div>
                <div className="text-base text-muted-foreground mt-1">成功</div>
              </div>
              <div className="flex-1 bg-destructive/10 rounded p-4 text-center">
                <div className="text-3xl text-destructive font-bold">{importResult.failed}</div>
                <div className="text-base text-muted-foreground mt-1">失败</div>
              </div>
            </div>

            {importResult.errors.length > 0 && (
              <div className="mb-6">
                <div className="text-xl text-foreground font-bold mb-2">失败记录：</div>
                <div className="max-h-48 overflow-y-auto bg-muted/30 rounded p-3">
                  {importResult.errors.map((error, index) => (
                    <div key={index} className="text-sm text-destructive mb-1">
                      {error}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleReset}
                className="flex-1 py-4 bg-card border-2 border-border text-foreground text-xl rounded flex items-center justify-center leading-none">
                继续导入
              </button>
              <button
                type="button"
                onClick={() => Taro.navigateBack()}
                className="flex-1 py-4 bg-primary text-primary-foreground text-xl rounded flex items-center justify-center leading-none">
                完成
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default withRouteGuard(UserImportPage)
