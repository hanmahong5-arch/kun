import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * 获取权限继承关系图谱
 * 
 * 功能：
 * 1. 查询用户-角色关系
 * 2. 查询角色-权限关系
 * 3. 查询用户-小组关系
 * 4. 构建图谱数据结构（nodes + edges）
 * 
 * 请求参数：
 * - user_id: 可选，指定用户ID（查询该用户的关系图谱）
 * - role_id: 可选，指定角色ID（查询该角色的关系图谱）
 * - scope: 可选，范围（all/user/role），默认all
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const url = new URL(req.url)
    const userId = url.searchParams.get('user_id')
    const roleId = url.searchParams.get('role_id')
    const scope = url.searchParams.get('scope') || 'all'

    const nodes: any[] = []
    const edges: any[] = []

    // 如果指定了用户ID，查询该用户的关系图谱
    if (userId) {
      // 查询用户信息
      const { data: user } = await supabaseAdmin
        .from('profiles')
        .select('id, name, phone, role')
        .eq('id', userId)
        .single()

      if (user) {
        nodes.push({
          id: user.id,
          type: 'user',
          label: user.name,
          data: {
            name: user.name,
            phone: user.phone,
            role: user.role
          }
        })

        // 查询用户的角色
        const { data: userRoles } = await supabaseAdmin
          .from('user_roles')
          .select(`
            role_id,
            roles (
              id,
              code,
              name,
              description
            )
          `)
          .eq('user_id', userId)

        if (userRoles) {
          for (const ur of userRoles) {
            const role = ur.roles as any
            if (role) {
              // 添加角色节点
              if (!nodes.find(n => n.id === role.id)) {
                nodes.push({
                  id: role.id,
                  type: 'role',
                  label: role.name,
                  data: {
                    code: role.code,
                    name: role.name,
                    description: role.description
                  }
                })
              }

              // 添加用户-角色边
              edges.push({
                id: `${user.id}-${role.id}`,
                source: user.id,
                target: role.id,
                type: 'user-role',
                label: '拥有角色'
              })

              // 查询角色的权限
              const { data: rolePermissions } = await supabaseAdmin
                .from('role_permissions')
                .select(`
                  permission_id,
                  permissions (
                    id,
                    code,
                    name,
                    type,
                    description
                  )
                `)
                .eq('role_id', role.id)

              if (rolePermissions) {
                for (const rp of rolePermissions) {
                  const permission = rp.permissions as any
                  if (permission) {
                    // 添加权限节点
                    if (!nodes.find(n => n.id === permission.id)) {
                      nodes.push({
                        id: permission.id,
                        type: 'permission',
                        label: permission.name,
                        data: {
                          code: permission.code,
                          name: permission.name,
                          type: permission.type,
                          description: permission.description
                        }
                      })
                    }

                    // 添加角色-权限边
                    const edgeId = `${role.id}-${permission.id}`
                    if (!edges.find(e => e.id === edgeId)) {
                      edges.push({
                        id: edgeId,
                        source: role.id,
                        target: permission.id,
                        type: 'role-permission',
                        label: '拥有权限'
                      })
                    }
                  }
                }
              }
            }
          }
        }

        // 查询用户的小组
        const { data: userTeams } = await supabaseAdmin
          .from('user_teams')
          .select(`
            team_id,
            teams (
              id,
              name,
              description
            )
          `)
          .eq('user_id', userId)

        if (userTeams) {
          for (const ut of userTeams) {
            const team = ut.teams as any
            if (team) {
              // 添加小组节点
              if (!nodes.find(n => n.id === team.id)) {
                nodes.push({
                  id: team.id,
                  type: 'team',
                  label: team.name,
                  data: {
                    name: team.name,
                    description: team.description
                  }
                })
              }

              // 添加用户-小组边
              edges.push({
                id: `${user.id}-${team.id}`,
                source: user.id,
                target: team.id,
                type: 'user-team',
                label: '所属小组'
              })
            }
          }
        }
      }
    }
    // 如果指定了角色ID，查询该角色的关系图谱
    else if (roleId) {
      // 查询角色信息
      const { data: role } = await supabaseAdmin
        .from('roles')
        .select('id, code, name, description')
        .eq('id', roleId)
        .single()

      if (role) {
        nodes.push({
          id: role.id,
          type: 'role',
          label: role.name,
          data: {
            code: role.code,
            name: role.name,
            description: role.description
          }
        })

        // 查询拥有该角色的用户
        const { data: userRoles } = await supabaseAdmin
          .from('user_roles')
          .select(`
            user_id,
            profiles (
              id,
              name,
              phone,
              role
            )
          `)
          .eq('role_id', roleId)

        if (userRoles) {
          for (const ur of userRoles) {
            const user = ur.profiles as any
            if (user) {
              // 添加用户节点
              if (!nodes.find(n => n.id === user.id)) {
                nodes.push({
                  id: user.id,
                  type: 'user',
                  label: user.name,
                  data: {
                    name: user.name,
                    phone: user.phone,
                    role: user.role
                  }
                })
              }

              // 添加用户-角色边
              edges.push({
                id: `${user.id}-${role.id}`,
                source: user.id,
                target: role.id,
                type: 'user-role',
                label: '拥有角色'
              })
            }
          }
        }

        // 查询角色的权限
        const { data: rolePermissions } = await supabaseAdmin
          .from('role_permissions')
          .select(`
            permission_id,
            permissions (
              id,
              code,
              name,
              type,
              description
            )
          `)
          .eq('role_id', roleId)

        if (rolePermissions) {
          for (const rp of rolePermissions) {
            const permission = rp.permissions as any
            if (permission) {
              // 添加权限节点
              if (!nodes.find(n => n.id === permission.id)) {
                nodes.push({
                  id: permission.id,
                  type: 'permission',
                  label: permission.name,
                  data: {
                    code: permission.code,
                    name: permission.name,
                    type: permission.type,
                    description: permission.description
                  }
                })
              }

              // 添加角色-权限边
              const edgeId = `${role.id}-${permission.id}`
              if (!edges.find(e => e.id === edgeId)) {
                edges.push({
                  id: edgeId,
                  source: role.id,
                  target: permission.id,
                  type: 'role-permission',
                  label: '拥有权限'
                })
              }
            }
          }
        }
      }
    }
    // 否则查询全局关系图谱（限制数量）
    else {
      // 查询所有用户（限制10个）
      const { data: users } = await supabaseAdmin
        .from('profiles')
        .select('id, name, phone, role')
        .limit(10)

      if (users) {
        for (const user of users) {
          nodes.push({
            id: user.id,
            type: 'user',
            label: user.name,
            data: {
              name: user.name,
              phone: user.phone,
              role: user.role
            }
          })
        }
      }

      // 查询所有角色
      const { data: roles } = await supabaseAdmin
        .from('roles')
        .select('id, code, name, description')

      if (roles) {
        for (const role of roles) {
          nodes.push({
            id: role.id,
            type: 'role',
            label: role.name,
            data: {
              code: role.code,
              name: role.name,
              description: role.description
            }
          })
        }
      }

      // 查询用户-角色关系
      const { data: userRoles } = await supabaseAdmin
        .from('user_roles')
        .select('user_id, role_id')

      if (userRoles) {
        for (const ur of userRoles) {
          edges.push({
            id: `${ur.user_id}-${ur.role_id}`,
            source: ur.user_id,
            target: ur.role_id,
            type: 'user-role',
            label: '拥有角色'
          })
        }
      }

      // 查询角色-权限关系（限制显示）
      const { data: rolePermissions } = await supabaseAdmin
        .from('role_permissions')
        .select(`
          role_id,
          permission_id,
          permissions (
            id,
            code,
            name,
            type,
            description
          )
        `)
        .limit(50)

      if (rolePermissions) {
        for (const rp of rolePermissions) {
          const permission = rp.permissions as any
          if (permission) {
            // 添加权限节点
            if (!nodes.find(n => n.id === permission.id)) {
              nodes.push({
                id: permission.id,
                type: 'permission',
                label: permission.name,
                data: {
                  code: permission.code,
                  name: permission.name,
                  type: permission.type,
                  description: permission.description
                }
              })
            }

            // 添加角色-权限边
            const edgeId = `${rp.role_id}-${permission.id}`
            if (!edges.find(e => e.id === edgeId)) {
              edges.push({
                id: edgeId,
                source: rp.role_id,
                target: permission.id,
                type: 'role-permission',
                label: '拥有权限'
              })
            }
          }
        }
      }
    }

    // 统计信息
    const statistics = {
      totalNodes: nodes.length,
      totalEdges: edges.length,
      nodesByType: {
        user: nodes.filter(n => n.type === 'user').length,
        role: nodes.filter(n => n.type === 'role').length,
        permission: nodes.filter(n => n.type === 'permission').length,
        team: nodes.filter(n => n.type === 'team').length
      },
      edgesByType: {
        userRole: edges.filter(e => e.type === 'user-role').length,
        rolePermission: edges.filter(e => e.type === 'role-permission').length,
        userTeam: edges.filter(e => e.type === 'user-team').length
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          nodes: nodes,
          edges: edges,
          statistics: statistics
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error: any) {
    console.error('操作失败:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
