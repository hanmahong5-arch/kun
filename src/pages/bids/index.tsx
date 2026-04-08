import {useState, useCallback, useEffect} from 'react'
import {isAdmin, isLeaderOrAdmin} from '@/db/permissions-utils'
import Taro, {useDidShow} from '@tarojs/taro'
import {withRouteGuard} from '@/components/RouteGuard'
import {useAuth} from '@/contexts/AuthContext'
import {supabase} from '@/client/supabase'
import type {Bid} from '@/db/types'

function BidsPage() {
  const {profile} = useAuth()
  const [bids, setBids] = useState<Bid[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'pending' | 'won' | 'lost'>('all')

  const canManage =
    isAdmin(profile) ||
    profile?.role === 'data_clerk'

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      let query = supabase.from('bids').select('*').order('bid_date', {ascending: false})

      if (filter !== 'all') {
        query = query.eq('bid_result', filter)
      }

      const {data, error} = await query

      if (error) throw error
      setBids(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('加载投标信息失败:', error)
      Taro.showToast({title: '加载失败', icon: 'none'})
    } finally {
      setLoading(false)
    }
  }, [filter])

  useDidShow(() => {
    loadData()
  })

  useEffect(() => {
    loadData()
  }, [loadData])

  const getResultLabel = (result: string) => {
    const labels = {
      pending: '待定',
      won: '中标',
      lost: '未中标'
    }
    return labels[result as keyof typeof labels] || result
  }

  const getResultColor = (result: string) => {
    const colors = {
      pending: 'text-warning',
      won: 'text-success',
      lost: 'text-muted-foreground'
    }
    return colors[result as keyof typeof colors] || 'text-foreground'
  }

  return (
    <div className="min-h-screen bg-background pb-6">
      {/* 头部 */}
      <div className="bg-gradient-primary px-6 py-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-2xl text-primary-foreground font-bold">投标管理</div>
            <div className="text-base text-primary-foreground/80 mt-1">
              共 {bids.length} 条记录
            </div>
          </div>
          {canManage && (
            <button
              type="button"
              onClick={() =>
                Taro.showToast({title: '投标创建功能开发中', icon: 'none'})
              }
              className="px-4 py-2 bg-primary-foreground text-primary text-base rounded flex items-center justify-center leading-none">
              <div className="i-mdi-plus text-xl mr-1" />
              新增
            </button>
          )}
        </div>
      </div>

      {/* 筛选器 */}
      <div className="px-6 mt-4">
        <div className="flex gap-2">
          {(['all', 'pending', 'won', 'lost'] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded text-base ${
                filter === f
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-card border-2 border-border text-foreground'
              }`}>
              {f === 'all' ? '全部' : getResultLabel(f)}
            </button>
          ))}
        </div>
      </div>

      {/* 投标列表 */}
      {loading ? (
        <div className="text-center py-12">
          <div className="text-xl text-muted-foreground">加载中...</div>
        </div>
      ) : bids.length === 0 ? (
        <div className="text-center py-12">
          <div className="i-mdi-gavel text-6xl text-muted-foreground mb-4" />
          <div className="text-xl text-foreground">暂无投标记录</div>
        </div>
      ) : (
        <div className="px-6 mt-4 space-y-3">
          {bids.map((bid) => (
            <div
              key={bid.id}
              onClick={() => Taro.navigateTo({url: `/pages/bids/detail/index?id=${bid.id}`})}
              className="bg-card rounded p-4 border border-border">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="text-xl text-foreground font-bold">{bid.project_name}</div>
                  <div className="text-base text-muted-foreground mt-1">
                    投标日期: {new Date(bid.bid_date).toLocaleDateString('zh-CN')}
                  </div>
                </div>
                <div className={`text-xl font-bold ${getResultColor(bid.bid_result)}`}>
                  {getResultLabel(bid.bid_result)}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-base text-muted-foreground">投标金额</div>
                  <div className="text-xl text-foreground font-bold">
                    {bid.bid_amount ? `${bid.bid_amount.toFixed(0)}万元` : '-'}
                  </div>
                </div>
                {bid.bid_result === 'won' && bid.won_amount && (
                  <div>
                    <div className="text-base text-muted-foreground">中标金额</div>
                    <div className="text-xl text-success font-bold">
                      {bid.won_amount.toFixed(0)}万元
                    </div>
                  </div>
                )}
              </div>

              {bid.remarks && (
                <div className="mt-3 text-base text-muted-foreground line-clamp-2">
                  {bid.remarks}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default withRouteGuard(BidsPage)
