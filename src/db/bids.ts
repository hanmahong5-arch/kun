import {supabase} from '@/client/supabase'
import type {Bid} from './types'

// 获取投标列表
export async function getBids(filter?: 'all' | 'pending' | 'won' | 'lost') {
  try {
    let query = supabase.from('bids').select('*').order('bid_date', {ascending: false})

    if (filter && filter !== 'all') {
      query = query.eq('bid_result', filter)
    }

    const {data, error} = await query

    if (error) throw error
    return {data: Array.isArray(data) ? data : [], error: null}
  } catch (error) {
    console.error('获取投标列表失败:', error)
    return {data: [], error}
  }
}

// 获取投标详情
export async function getBidById(id: string) {
  try {
    const {data, error} = await supabase
      .from('bids')
      .select('*, profiles!created_by(name)')
      .eq('id', id)
      .maybeSingle()

    if (error) throw error
    return {data, error: null}
  } catch (error) {
    console.error('获取投标详情失败:', error)
    return {data: null, error}
  }
}

// 创建投标
export async function createBid(bid: {
  project_name: string
  bid_date: string
  bid_amount?: number
  bid_result?: string
  won_amount?: number
  won_date?: string
  remarks?: string
  attachments?: Array<{name: string; url: string; size?: number}>
  created_by: string
}) {
  try {
    const {data, error} = await supabase
      .from('bids')
      .insert({
        ...bid,
        attachments: bid.attachments || []
      })
      .select()
      .maybeSingle()

    if (error) throw error
    return {data, error: null}
  } catch (error) {
    console.error('创建投标失败:', error)
    return {data: null, error}
  }
}

// 更新投标
export async function updateBid(
  id: string,
  updates: {
    project_name?: string
    bid_date?: string
    bid_amount?: number
    bid_result?: string
    won_amount?: number
    won_date?: string
    remarks?: string
    attachments?: Array<{name: string; url: string; size?: number}>
  }
) {
  try {
    const {data, error} = await supabase
      .from('bids')
      .update(updates)
      .eq('id', id)
      .select()
      .maybeSingle()

    if (error) throw error
    return {data, error: null}
  } catch (error) {
    console.error('更新投标失败:', error)
    return {data: null, error}
  }
}

// 删除投标
export async function deleteBid(id: string) {
  try {
    const {error} = await supabase.from('bids').delete().eq('id', id)

    if (error) throw error
    return {error: null}
  } catch (error) {
    console.error('删除投标失败:', error)
    return {error}
  }
}

// 上传投标附件
export async function uploadBidAttachment(
  file: File | {tempFilePath: string; name: string; type: string},
  userId: string
) {
  try {
    const fileName = `${userId}/${Date.now()}_${file.name}`

    let uploadData
    if ('tempFilePath' in file) {
      // 小程序环境
      const {data, error} = await supabase.storage
        .from('bid-attachments')
        .upload(fileName, file.tempFilePath as any, {
          contentType: file.type,
          upsert: false
        })
      if (error) throw error
      uploadData = data
    } else {
      // H5环境
      const {data, error} = await supabase.storage
        .from('bid-attachments')
        .upload(fileName, file, {
          contentType: file.type,
          upsert: false
        })
      if (error) throw error
      uploadData = data
    }

    if (!uploadData) throw new Error('上传失败')

    const {data: urlData} = supabase.storage.from('bid-attachments').getPublicUrl(uploadData.path)

    return {
      data: {
        path: uploadData.path,
        url: urlData.publicUrl
      },
      error: null
    }
  } catch (error) {
    console.error('上传投标附件失败:', error)
    return {data: null, error}
  }
}
