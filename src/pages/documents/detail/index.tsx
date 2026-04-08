import Taro from '@tarojs/taro'
import {withRouteGuard} from '@/components/RouteGuard'

function DocumentsDetailPage() {
  return (
    <div className="min-h-screen bg-background px-6 py-6">
      <div className="bg-card rounded shadow-card p-12 flex flex-col items-center">
        <div className="i-mdi-wrench text-[100px] text-muted-foreground" />
        <div className="text-2xl text-foreground mt-4">文档详情</div>
        <div className="text-xl text-muted-foreground mt-2">功能开发中...</div>
        <button
          type="button"
          onClick={() => Taro.navigateBack()}
          className="mt-6 px-8 py-3 bg-primary text-primary-foreground text-xl rounded flex items-center justify-center leading-none">
          返回
        </button>
      </div>
    </div>
  )
}

export default withRouteGuard(DocumentsDetailPage)
