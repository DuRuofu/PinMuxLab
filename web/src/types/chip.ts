/**
 * 芯片元信息 (Meta Information)
 * 用于展示和识别芯片的基本信息，不参与逻辑判断
 */
export interface ChipMeta {
  /** 芯片厂商，如 "WCH", "ST" */
  vendor: string
  /** 芯片系列，如 "CH32V003" */
  family: string
  /** 具体型号，如 "CH32V003F4U6" */
  name: string
  /** 内核架构，如 "RISC-V", "Cortex-M3" */
  core: string
  /** 封装名称，如 "QFN20" */
  package: string
  /** Flash 大小，如 "32K" */
  flash?: string
  /** SRAM 大小，如 "10K" */
  sram?: string
  /** 数据手册文件名或链接 */
  datasheet: string
}

/**
 * 物理引脚对象 (Physical Pin)
 * 描述封装上的一个物理引脚
 */
export interface PhysicalPin {
  /** 引脚物理编号 (1, 2, 3...) */
  number: number
  /** 引脚丝印名称 (如 "PA1", "VSS", "NRST") */
  name: string
}

/**
 * 封装信息 (Package Information)
 * 描述芯片的物理封装结构
 */
export interface PackageInfo {
  /** 封装类型，如 "QFN20", "LQFP48" */
  type: string
  /** 总引脚数量 */
  pinCount: number
  /** 物理引脚列表，按顺序排列 */
  pins: PhysicalPin[]
}

/**
 * 引脚逻辑能力 (Pin Capability)
 * 描述一个引脚在逻辑上可以做什么
 */
export interface PinCapability {
  /** 引脚类型：gpio, power, gnd, reset, boot 等 */
  type: 'gpio' | 'power' | 'gnd' | 'reset' | 'boot' | string
  /** 是否为固定功能（true 表示不可复用，如电源引脚） */
  fixed: boolean
  /** 该引脚支持的所有功能全集，如 ["GPIO", "USART1_TX", "ADC_IN1"] */
  functions: string[]
}

/**
 * 外设定义 (Peripheral Definition)
 * 描述一个外设包含哪些信号，以及这些信号可以映射到哪些引脚
 */
export interface PeripheralDefinition {
  /** 外设类型，如 "uart", "spi", "i2c", "timer" */
  type: string
  /** 信号映射表 */
  /** Key: 信号名称 (如 "TX", "SCK") */
  /** Value: 支持该信号的引脚名称列表 (如 ["PA2", "PB10"]) */
  signals: Record<string, string[]>
}

/**
 * 完整的芯片描述对象 (Root)
 * 对应整个 JSON 文件的结构
 */
export interface ChipDefinition {
  /** 芯片元信息 */
  meta: ChipMeta
  /** 物理封装信息 */
  package: PackageInfo
  /** 引脚能力映射表 (Key: 引脚名称，如 "PA1") */
  pins: Record<string, PinCapability>
  /** 外设定义映射表 (Key: 外设名称，如 "USART1") */
  peripherals?: Record<string, PeripheralDefinition>
}
