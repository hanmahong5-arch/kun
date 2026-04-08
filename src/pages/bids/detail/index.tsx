import {useState, useCallback, useEffect, useMemo} from 'react'
import {isAdmin, isLeaderOrAdmin} from '@/db/permissions-utils'
import Taro, {useDidShow} from '@tarojs/taro'
import {withRouteGuard} from '@/components/RouteGuard'
import {useAuth} from '@/contexts/AuthContext'
import {getBidById, deleteBid} from '@/db/bids'
import type {Bid} from '@/db/types'

function BidDetailPage() {
  const {profile} = useAuth()
  const bidId = useMemo(() => Taro.getCurrentInstance().router?.params?.id || '', [])
  const [bid, setBid] = useState<Bid | null>(null)
  const [loading, setLoading] = useState(true)

  const canManage =
    isAdmin(profile) ||
    profile?.role === 'data_clerk'

  const loadData = useCallback(async () => {
    if (!bidId) return

    try {
      setLoading(true)
      const {data, error} = await getBidById(bidId)

      if (error) throw error
      setBid(data)
    } catch (error) {
      console.error('加载投标详情失败:', error)
      Taro.showToast({title: '加载失败', icon: 'none'})
    } finally {
      setLoading(false)
    }
  }, [bidId])

  useDidShow(() => {
    loadData()
  })

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleEdit = () => {
    Taro.showToast({title: '投标编辑功能开发中', icon: 'none'})
  }

  const handleDelete = async () => {
    const res = await Taro.showModal({
      title: '确认删除',
      content: '确定要删除这条投标记录吗？',
      confirmText: '删除',
      confirmColor: '#ef4444'
    })

    if (!res.confirm) return

    try {
      Taro.showLoading({title: '删除中...'})
      const {error} = await deleteBid(bidId)

      if (error) throw error

      Taro.showToast({title: '删除成功', icon: 'success'})
      setTimeout(() => {
        Taro.navigateBack()
      }, 1500)
    } catch (error) {
      console.error('删除投标失败:', error)
      Taro.showToast({title: '删除失败', icon: 'none'})
    } finally {
      Taro.hideLoading()
    }
  }

  const handleDownloadAttachment = (url: string, name: string) => {
    Taro.showToast({
      title: '附件下载功能开发中',
      icon: 'none'
    })
  }

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

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-xl text-muted-foreground">加载中...</div>
      </div>
    )
  }

  if (!bid) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6">
        <div className="text-center">
          <div className="i-mdi-alert-circle text-6xl text-muted-foreground mb-4" />
          <div className="text-xl text-foreground">投标信息不存在</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background pb-6">
      {/* 头部 */}
      <div className="bg-gradient-primary px-6 py-6">
        <div className="text-2xl text-primary-foreground font-bold">{bid.project_name}</div>
        <div className={`text-xl font-bold mt-2 ${getResultColor(bid.bid_result)}`}>
          {getResultLabel(bid.bid_result)}
        </div>
      </div>

      {/* 基本信息 */}
      <div className="px-6 mt-4">
        <div className="bg-card rounded p-4 border border-border space-y-4">
          <div className="text-xl text-foreground font-bold mb-3">基本信息</div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-base text-muted-foreground">投标日期</div>
              <div className="text-xl text-foreground mt-1">
                {new Date(bid.bid_date).toLocaleDateString('zh-CN')}
              </div>
            </div>

            <div>
              <div className="text-base text-muted-foreground">投标金额</div>
              <div className="text-xl text-foreground mt-1">
                {bid.bid_amount ? `${bid.bid_amount.toFixed(0)}万元` : '-'}
              </div>
            </div>

            {bid.bid_result === 'won' && (
              <>
                <div>
                  <div className="text-base text-muted-foreground">中标日期</div>
                  <div className="text-xl text-foreground mt-1">
                    {bid.won_date ? new Date(bid.won_date).toLocaleDateString('zh-CN') : '-'}
                  </div>
                </div>

                <div>
                  <div className="text-base text-muted-foreground">中标金额</div>
                  <div className="text-xl text-success mt-1">
                    {bid.won_amount ? `${bid.won_amount.toFixed(0)}万元` : '-'}
                  </div>
                </div>
              </>
            )}
          </div>

          {bid.remarks && (
            <div>
              <div className="text-base text-muted-foreground">备注说明</div>
              <div className="text-xl text-foreground mt-2">{bid.remarks}</div>
            </div>
          )}
        </div>
      </div>

      {/* 附件列表 */}
      {bid.attachments && bid.attachments.length > 0 && (
        <div className="px-6 mt-4">
          <div className="bg-card rounded p-4 border border-border">
            <div className="text-xl text-foreground font-bold mb-3">附件列表</div>

            <div className="space-y-3">
              {bid.attachments.map((attachment, index) => (
                <div
                  key={index}
                  className="flex items-center gap-3 p-3 bg-muted/30 rounded border border-border">
                  <div className="i-mdi-file-document text-3xl text-primary" />

                  <div className="flex-1">
                    <div className="text-base text-foreground">{attachment.name}</div>
                    {attachment.size && (
                      <div className="text-sm text-muted-foreground mt-1">
                        {(attachment.size / 1024 / 1024).toFixed(2)} MB
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDownloadAttachment(attachment.url, attachment.name)}
                    className="p-2 bg-primary/10 text-primary rounded flex items-center justify-center leading-none">
                    <div className="i-mdi-download text-2xl" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 操作按钮 */}
      {canManage && (
        <div className="px-6 mt-6 flex gap-3">
          <button
            type="button"
            onClick={handleEdit}
            className="flex-1 py-3 bg-primary text-primary-foreground text-xl rounded flex items-center justify-center leading-none">
            <div className="i-mdi-pencil text-2xl mr-2" />
            编辑
          </button>

          <button
            type="button"
            onClick={handleDelete}
            className="flex-1 py-3 bg-destructive text-destructive-foreground text-xl rounded flex items-center justify-center leading-none">
            <div className="i-mdi-delete text-2xl mr-2" />
            删除
          </button>
        </div>
      )}
    </div>
  )
}

export default withRouteGuard(BidDetailPage)
