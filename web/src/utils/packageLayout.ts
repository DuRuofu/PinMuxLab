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
  /** Pin 1 标识点坐标 */
  pin1Mark?: {
    cx: number
    cy: number
    r: number
  }
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
  const PIN_WIDTH = 54 // 30 -> 40 -> 48
  const PIN_HEIGHT = 36 // 10 -> 15 -> 24
  const PIN_SPACING = 28 // 15 -> 20 -> 28
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
    // Pin 1 标识位于左上角
    pin1Mark: {
      cx: bodyStart + 15,
      cy: bodyStart + 15,
      r: 4
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

/**
 * 计算双列直插/贴片封装 (DIP/SOP/TSSOP) 的布局
 * 假设引脚逆时针排列，起始点在左上角
 * 
 * 布局顺序：
 * 1. 左侧 (Left): 从上到下 (Pin 1 ~ N/2)
 * 2. 右侧 (Right): 从下到上 (Pin N/2+1 ~ N)
 */
export function calculateDualLayout(pkg: PackageInfo): PackageLayout {
  const { pinCount, pins } = pkg
  
  // 配置参数
  const PIN_WIDTH = 50 // 引脚长度
  const PIN_HEIGHT = 16 // 引脚宽度 (垂直方向)
  const PIN_SPACING = 24 // 引脚间距
  const BODY_PADDING_X = 40 // 芯片主体横向内边距
  const BODY_PADDING_Y = 30 // 芯片主体纵向内边距
  const BODY_WIDTH = 120 // 芯片主体宽度 (固定或根据内容调整)

  // 每边引脚数
  const pinsPerSide = Math.ceil(pinCount / 2)
  
  // 计算芯片主体高度
  const contentHeight = pinsPerSide * PIN_SPACING
  const bodyHeight = contentHeight + BODY_PADDING_Y * 2
  
  // 画布总尺寸
  const totalWidth = BODY_WIDTH + PIN_WIDTH * 2 + 100
  const totalHeight = bodyHeight + 100
  
  const bodyX = (totalWidth - BODY_WIDTH) / 2
  const bodyY = (totalHeight - bodyHeight) / 2
  
  const layout: PackageLayout = {
    width: totalWidth,
    height: totalHeight,
    body: {
      x: bodyX,
      y: bodyY,
      width: BODY_WIDTH,
      height: bodyHeight
    },
    // Pin 1 标识位于左上角
    pin1Mark: {
      cx: bodyX + 15,
      cy: bodyY + 15,
      r: 4
    },
    pins: []
  }

  // 计算引脚起始 Y 坐标 (垂直居中分布)
  const startY = bodyY + (bodyHeight - contentHeight) / 2 + PIN_SPACING / 2

  pins.forEach((pin, index) => {
    // 0: Left side, 1: Right side
    const sideIndex = index < pinsPerSide ? 0 : 1
    const indexInSide = sideIndex === 0 ? index : (index - pinsPerSide)
    
    let x = 0, y = 0, w = 0, h = 0
    let lx = 0, ly = 0
    
    // Y 坐标计算
    // Left: 从上到下 -> startY + index * spacing
    // Right: 从下到上 -> startY + (pinsPerSide - 1 - index) * spacing
    const yOffset = sideIndex === 0 
      ? indexInSide * PIN_SPACING
      : (pinsPerSide - 1 - indexInSide) * PIN_SPACING
      
    y = startY + yOffset - PIN_HEIGHT / 2
    h = PIN_HEIGHT
    w = PIN_WIDTH

    if (sideIndex === 0) {
      // Left
      x = bodyX - w
    } else {
      // Right
      x = bodyX + BODY_WIDTH
    }

    // Label
    lx = x + w / 2
    ly = y + h / 2

    layout.pins.push({
      ...pin,
      x, y, width: w, height: h,
      labelX: lx,
      labelY: ly,
      textAnchor: 'middle',
      dominantBaseline: 'middle',
      rotation: 0
    })
  })

  return layout
}

/**
 * 通用布局计算函数
 */
export function calculateLayout(pkg: PackageInfo): PackageLayout {
  // 简单判断：如果类型包含 QFN, QFP, LQFP 等，使用 Quad 布局
  // 如果包含 SOP, DIP, TSSOP 等，使用 Dual 布局
  const type = pkg.type.toUpperCase()
  
  if (type.includes('SOP') || type.includes('DIP')) {
    return calculateDualLayout(pkg)
  }
  
  // 默认 QFN/QFP
  return calculateQuadLayout(pkg)
}