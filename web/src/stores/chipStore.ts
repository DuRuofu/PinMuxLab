import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { ChipDefinition, PinCapability } from '@/types/chip'
import { inferChipData } from '@/utils/chipInferencer'

export const useChipStore = defineStore('chip', () => {
  // State
  const currentChip = ref<ChipDefinition | null>(null)
  const pinConfigurations = ref<Record<string, string>>({}) // Key: PinName, Value: SelectedFunction
  const isLoaded = computed(() => !!currentChip.value)

  // Actions
  function loadChip(rawData: any) {
    const data = inferChipData(rawData)
    currentChip.value = data
    // 尝试从 localStorage 加载配置
    const storageKey = `pinmux_config_${data.meta.name}`
    const savedConfig = localStorage.getItem(storageKey)
    if (savedConfig) {
      try {
        pinConfigurations.value = JSON.parse(savedConfig)
      } catch (e) {
        console.error('Failed to parse saved configuration', e)
        pinConfigurations.value = {}
      }
    } else {
      pinConfigurations.value = {} // 重置配置
    }
  }

  function saveConfigurations() {
    if (!currentChip.value) return
    const storageKey = `pinmux_config_${currentChip.value.meta.name}`
    localStorage.setItem(storageKey, JSON.stringify(pinConfigurations.value))
  }

  function clearConfigurations() {
    pinConfigurations.value = {}
    if (currentChip.value) {
      const storageKey = `pinmux_config_${currentChip.value.meta.name}`
      localStorage.removeItem(storageKey)
    }
  }

  function setPinFunction(pinName: string, func: string) {
    if (!currentChip.value) return
    
    // 如果选择的是默认功能或空，则移除配置
    if (!func) {
      const { [pinName]: _, ...rest } = pinConfigurations.value
      pinConfigurations.value = rest
    } else {
      // 检查该引脚是否支持该功能
      const supported = getPinFunctions(pinName)
      if (supported.includes(func)) {
        pinConfigurations.value = {
          ...pinConfigurations.value,
          [pinName]: func
        }
      }
    }
    // 保存到 localStorage
    saveConfigurations()
  }

  function getPinConfiguration(pinName: string): string | undefined {
    return pinConfigurations.value[pinName]
  }

  /**
   * 根据引脚名称获取引脚能力定义
   * @param pinName 引脚名称 (如 "PA1")
   */
  function getPinFunctions(pinName: string): string[] {
    if (!currentChip.value) return []
    const pin = currentChip.value.pins[pinName]
    return pin ? pin.functions : []
  }

  /**
   * 获取引脚的类型（gpio/power/reset等）
   */
  function getPinType(pinName: string): string {
    if (!currentChip.value) return 'unknown'
    const pin = currentChip.value.pins[pinName]
    return pin ? pin.type : 'unknown'
  }

  /**
   * 获取物理引脚信息（编号和名称）
   */
  const physicalPins = computed(() => {
    if (!currentChip.value) return []
    return currentChip.value.package.pins
  })

  return {
    currentChip,
    isLoaded,
    physicalPins,
    pinConfigurations,
    loadChip,
    getPinFunctions,
    getPinType,
    setPinFunction,
    getPinConfiguration,
    clearConfigurations
  }
})
