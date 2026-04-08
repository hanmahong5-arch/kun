import {supabase} from '@/client/supabase'
import type {Document} from './types'

// 获取文档列表
export async function getDocuments(params?: {
  category?: string
  search?: string
  sortBy?: 'created_at' | 'file_size' | 'name'
  sortOrder?: 'asc' | 'desc'
}) {
  try {
    let query = supabase.from('documents').select('*, profiles!uploaded_by(name)')

    if (params?.category && params.category !== 'all') {
      query = query.eq('category', params.category)
    }

    if (params?.search) {
      query = query.ilike('name', `%${params.search}%`)
    }

    const sortBy = params?.sortBy || 'created_at'
    const sortOrder = params?.sortOrder || 'desc'
    query = query.order(sortBy, {ascending: sortOrder === 'asc'})

    const {data, error} = await query

    if (error) throw error
    return {data: Array.isArray(data) ? data : [], error: null}
  } catch (error) {
    console.error('获取文档列表失败:', error)
    return {data: [], error}
  }
}

// 获取文档详情
export async function getDocumentById(id: string) {
  try {
    const {data, error} = await supabase
      .from('documents')
      .select('*, profiles!uploaded_by(name)')
      .eq('id', id)
      .maybeSingle()

    if (error) throw error
    return {data, error: null}
  } catch (error) {
    console.error('获取文档详情失败:', error)
    return {data: null, error}
  }
}

// 创建文档记录
export async function createDocument(doc: {
  name: string
  category: string
  file_size: number
  file_path: string
  file_type: string
  uploaded_by: string
}) {
  try {
    const {data, error} = await supabase.from('documents').insert(doc).select().maybeSingle()

    if (error) throw error
    return {data, error: null}
  } catch (error) {
    console.error('创建文档记录失败:', error)
    return {data: null, error}
  }
}

// 删除文档
export async function deleteDocument(id: string, filePath: string) {
  try {
    // 删除存储文件
    const {error: storageError} = await supabase.storage.from('documents').remove([filePath])

    if (storageError) throw storageError

    // 删除数据库记录
    const {error: dbError} = await supabase.from('documents').delete().eq('id', id)

    if (dbError) throw dbError

    return {error: null}
  } catch (error) {
    console.error('删除文档失败:', error)
    return {error}
  }
}

// 上传文档到Storage
export async function uploadDocument(file: File | {tempFilePath: string; name: string; type: string}, userId: string) {
  try {
    const fileName = `${userId}/${Date.now()}_${file.name}`
    
    let uploadData
    if ('tempFilePath' in file) {
      // 小程序环境
      const {data, error} = await supabase.storage
        .from('documents')
        .upload(fileName, file.tempFilePath as any, {
          contentType: file.type,
          upsert: false
        })
      if (error) throw error
      uploadData = data
    } else {
      // H5环境
      const {data, error} = await supabase.storage
        .from('documents')
        .upload(fileName, file, {
          contentType: file.type,
          upsert: false
        })
      if (error) throw error
      uploadData = data
    }

    if (!uploadData) throw new Error('上传失败')

    const {data: urlData} = supabase.storage.from('documents').getPublicUrl(uploadData.path)

    return {
      data: {
        path: uploadData.path,
        url: urlData.publicUrl
      },
      error: null
    }
  } catch (error) {
    console.error('上传文档失败:', error)
    return {data: null, error}
  }
}
