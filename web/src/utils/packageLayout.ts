import type { PackageInfo, PhysicalPin } from '@/types/chip'

/**
 * 渲染用的引脚对象 (包含坐标信息)
 */
export interface RenderedPin extends PhysicalPin {
  x: number
  y: number
  width: number
  height: number
  /** 文字标签坐标 */
  labelX: number
  labelY: number
  /** 文字对齐方式 */
  textAnchor: 'start' | 'middle' | 'end'
  /** 文字基线对齐 */
  dominantBaseline: 'auto' | 'middle' | 'hanging'
  /** 旋转角度 (备用) */
  rotation: number
}

/**
 * 布局计算结果
 */
export interface PackageLayout {
  width: number
  height: number
  body: {
    x: number
    y: number
    width: number
    height: number
  }
  pins: RenderedPin[]
}

/**
 * 计算四边扁平封装 (QFN/LQFP) 的布局
 * 假设引脚逆时针排列，起始点在左上角 (Left Side Top)
 * 
 * 布局顺序：
 * 1. 左侧 (Left): 从上到下
 * 2. 下侧 (Bottom): 从左到右
 * 3. 右侧 (Right): 从下到上
 * 4. 上侧 (Top): 从右到左
 */
export function calculateQuadLayout(pkg: PackageInfo): PackageLayout {
  const { pinCount, pins } = pkg
  
  // 配置参数 (单位：无量纲 SVG 坐标)
  const PIN_WIDTH = 40 // 30 -> 40
  const PIN_HEIGHT = 15 // 10 -> 15
  const PIN_SPACING = 20 // 15 -> 20
  const BODY_PADDING = 30 // 20 -> 30
  // const LABEL_OFFSET = 5 // 文字距离引脚的距离 (不再需要，因为文字在框内)
  
  // 计算每边的引脚数 (假设均匀分布)
  const pinsPerSide = Math.ceil(pinCount / 4)
  
  // 计算芯片主体尺寸
  // 主体边长 = 引脚数 * 间距 + padding
  const sideLength = pinsPerSide * PIN_SPACING + BODY_PADDING * 2
  
  // 画布总尺寸
  const totalSize = sideLength + PIN_HEIGHT * 2 + 100 // +100 用于留白
  const center = totalSize / 2
  const bodySize = sideLength
  const bodyStart = center - bodySize / 2
  
  const layout: PackageLayout = {
    width: totalSize,
    height: totalSize,
    body: {
      x: bodyStart,
      y: bodyStart,
      width: bodySize,
      height: bodySize
    },
    pins: []
  }

  // 辅助函数：计算引脚坐标
  pins.forEach((pin, index) => {
    // 确定当前引脚在哪一边 (0: Left, 1: Bottom, 2: Right, 3: Top)
    const sideIndex = Math.floor(index / pinsPerSide) % 4
    const indexInSide = index % pinsPerSide
    
    let x = 0, y = 0, w = 0, h = 0
    let lx = 0, ly = 0
    let anchor: RenderedPin['textAnchor'] = 'middle'
    let baseline: RenderedPin['dominantBaseline'] = 'middle'

    // 偏移量计算：从边的一端开始
    // 居中偏移：(主体长度 - (引脚数 * 间距)) / 2 + 半个间距
    const contentWidth = pinsPerSide * PIN_SPACING
    const startOffset = (bodySize - contentWidth) / 2 + PIN_SPACING / 2
    const step = startOffset + indexInSide * PIN_SPACING

    switch (sideIndex) {
      case 0: // Left Side (Top to Bottom)
        w = PIN_HEIGHT
        h = PIN_WIDTH / 2 // 稍微窄一点
        x = bodyStart - w
        y = bodyStart + step - h / 2
        break
        
      case 1: // Bottom Side (Left to Right)
        w = PIN_WIDTH / 2
        h = PIN_HEIGHT
        x = bodyStart + step - w / 2
        y = bodyStart + bodySize
        break
        
      case 2: // Right Side (Bottom to Top)
        w = PIN_HEIGHT
        h = PIN_WIDTH / 2
        x = bodyStart + bodySize
        y = (bodyStart + bodySize) - step - h / 2
        break
        
      case 3: // Top Side (Right to Left)
        w = PIN_WIDTH / 2
        h = PIN_HEIGHT
        x = (bodyStart + bodySize) - step - w / 2
        y = bodyStart - h
        break
    }

    // Label 统一居中显示在引脚框内
    lx = x + w / 2
    ly = y + h / 2
    anchor = 'middle'
    baseline = 'middle'

    layout.pins.push({
      ...pin,
      x, y, width: w, height: h,
      labelX: lx,
      labelY: ly,
      textAnchor: anchor,
      dominantBaseline: baseline,
      rotation: 0
    })
  })

  return layout
}
