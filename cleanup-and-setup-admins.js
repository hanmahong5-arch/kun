// ========================================
// 用户清理和管理员添加脚本
// ========================================
//
// 使用方法：
// 1. 以管理员身份登录系统
// 2. 打开浏览器控制台
// 3. 复制并粘贴此脚本
// 4. 运行 executeCleanupAndSetup()
//
// ========================================

async function executeCleanupAndSetup() {
  console.log('========================================')
  console.log('开始执行用户清理和管理员添加')
  console.log('========================================\n')

  try {
    // 步骤1：删除旧用户的Auth记录
    console.log('步骤1：删除用户15232101989的Auth记录...')
    const { data: deleteData, error: deleteError } = await supabase.functions.invoke('delete-old-user')
    
    if (deleteError) {
      console.error('❌ 删除失败:', deleteError)
      return
    }
    
    console.log('✅ 删除成功:', deleteData)

    // 步骤2：添加新管理员15610496919
    console.log('\n步骤2：添加新管理员15610496919...')
    
    // 首先查询system_admin角色的ID
    const { data: roleData, error: roleError } = await supabase
      .from('roles')
      .select('id')
      .eq('code', 'system_admin')
      .single()
    
    if (roleError) {
      console.error('❌ 查询角色失败:', roleError)
      return
    }
    
    console.log('角色ID:', roleData.id)
    
    // 调用create-user函数创建新管理员
    const { data: createData, error: createError } = await supabase.functions.invoke('create-user', {
      body: {
        phone: '15610496919',
        name: '系统管理员2',
        role_ids: [roleData.id],
        password: '123456',
        job_level: null,
        department: null,
        team_ids: []
      }
    })
    
    if (createError) {
      console.error('❌ 创建管理员失败:', createError)
      const errorMsg = await createError?.context?.text?.()
      console.error('详细错误:', errorMsg)
      return
    }
    
    console.log('✅ 创建管理员成功:', createData)

    // 步骤3：验证最终结果
    console.log('\n步骤3：验证最终结果...')
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, phone, name, role, status')
      .order('phone')
    
    if (profilesError) {
      console.error('❌ 查询失败:', profilesError)
      return
    }
    
    console.log('✅ 当前系统中的用户:')
    console.table(profiles)

    console.log('\n========================================')
    console.log('用户清理和管理员添加完成！')
    console.log('========================================')
    console.log('\n最终结果：')
    console.log('- 保留管理员1: 17685587922')
    console.log('- 新增管理员2: 15610496919')
    console.log('- 删除用户: 15232101989')
    
  } catch (error) {
    console.error('❌ 执行失败:', error)
  }
}

// 导出函数
console.log('用户清理和管理员添加脚本已加载')
console.log('运行 executeCleanupAndSetup() 开始执行')
