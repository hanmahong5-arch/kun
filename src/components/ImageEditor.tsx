import {useState, useRef, useEffect} from 'react'
import Taro from '@tarojs/taro'
import {Canvas} from '@tarojs/components'

interface ImageEditorProps {
  imagePath: string
  onConfirm: (editedPath: string) => void
  onCancel: () => void
}

export function ImageEditor({imagePath, onConfirm, onCancel}: ImageEditorProps) {
  const [scale, setScale] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [processing, setProcessing] = useState(false)
  const canvasId = 'image-editor-canvas'

  // 应用编辑并导出
  const handleConfirm = async () => {
    setProcessing(true)
    try {
      // 创建canvas上下文
      const ctx = Taro.createCanvasContext(canvasId)

      // 获取图片信息
      const imgInfo = await Taro.getImageInfo({src: imagePath})

      // 计算canvas尺寸（正方形，取较小边）
      const size = Math.min(imgInfo.width, imgInfo.height)
      const canvasSize = 300 // 输出尺寸

      // 清空canvas
      ctx.clearRect(0, 0, canvasSize, canvasSize)

      // 保存状态
      ctx.save()

      // 移动到中心点
      ctx.translate(canvasSize / 2, canvasSize / 2)

      // 应用旋转
      ctx.rotate((rotation * Math.PI) / 180)

      // 应用缩放
      ctx.scale(scale, scale)

      // 绘制图片（居中）
      const drawSize = canvasSize / scale
      ctx.drawImage(
        imagePath,
        (imgInfo.width - size) / 2,
        (imgInfo.height - size) / 2,
        size,
        size,
        -drawSize / 2,
        -drawSize / 2,
        drawSize,
        drawSize
      )

      // 恢复状态
      ctx.restore()

      // 绘制到canvas
      ctx.draw(false, async () => {
        // 导出图片
        const tempFilePath = await Taro.canvasToTempFilePath({
          canvasId,
          fileType: 'jpg',
          quality: 0.9
        })

        onConfirm(tempFilePath.tempFilePath)
      })
    } catch (error) {
      console.error('图片编辑失败:', error)
      Taro.showToast({title: '编辑失败', icon: 'none'})
    } finally {
      setProcessing(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex flex-col">
      {/* 顶部工具栏 */}
      <div className="px-6 py-4 flex items-center justify-between">
        <button
          type="button"
          onClick={onCancel}
          className="text-xl text-white flex items-center gap-2">
          <div className="i-mdi-close text-2xl" />
          <span>取消</span>
        </button>
        <div className="text-xl text-white font-bold">编辑图片</div>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={processing}
          className={`text-xl text-primary flex items-center gap-2 ${
            processing ? 'opacity-50' : ''
          }`}>
          <span>{processing ? '处理中...' : '完成'}</span>
          <div className="i-mdi-check text-2xl" />
        </button>
      </div>

      {/* 图片预览区域 */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div
          className="relative bg-white/10 rounded overflow-hidden"
          style={{
            width: '300px',
            height: '300px',
            transform: `scale(${scale}) rotate(${rotation}deg)`,
            transition: 'transform 0.3s'
          }}>
          <img
            src={imagePath}
            alt="preview"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover'
            }}
          />
        </div>
      </div>

      {/* 底部控制栏 */}
      <div className="px-6 py-6 bg-black/50">
        {/* 缩放控制 */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <div className="text-base text-white">缩放</div>
            <div className="text-base text-white">{Math.round(scale * 100)}%</div>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setScale(Math.max(0.5, scale - 0.1))}
              className="w-10 h-10 bg-white/20 rounded flex items-center justify-center">
              <div className="i-mdi-minus text-2xl text-white" />
            </button>
            <input
              type="range"
              min="0.5"
              max="2"
              step="0.1"
              value={scale}
              onChange={(e) => setScale(parseFloat(e.target.value))}
              className="flex-1"
            />
            <button
              type="button"
              onClick={() => setScale(Math.min(2, scale + 0.1))}
              className="w-10 h-10 bg-white/20 rounded flex items-center justify-center">
              <div className="i-mdi-plus text-2xl text-white" />
            </button>
          </div>
        </div>

        {/* 旋转控制 */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="text-base text-white">旋转</div>
            <div className="text-base text-white">{rotation}°</div>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setRotation((rotation - 90 + 360) % 360)}
              className="flex-1 py-3 bg-white/20 rounded flex items-center justify-center gap-2">
              <div className="i-mdi-rotate-left text-2xl text-white" />
              <span className="text-base text-white">左转90°</span>
            </button>
            <button
              type="button"
              onClick={() => setRotation((rotation + 90) % 360)}
              className="flex-1 py-3 bg-white/20 rounded flex items-center justify-center gap-2">
              <div className="i-mdi-rotate-right text-2xl text-white" />
              <span className="text-base text-white">右转90°</span>
            </button>
          </div>
        </div>
      </div>

      {/* 隐藏的canvas用于导出 */}
      <Canvas
        canvasId={canvasId}
        style={{
          width: '300px',
          height: '300px',
          position: 'fixed',
          left: '-9999px',
          top: '-9999px'
        }}
      />
    </div>
  )
}
