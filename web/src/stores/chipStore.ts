import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { ChipDefinition, PinCapability } from '@/types/chip'
import { inferChipData } from '@/utils/chipInferencer'

import { useUIStore } from './uiStore'

export const useChipStore = defineStore('chip', () => {
  // State
  const currentChip = ref<ChipDefinition | null>(null)
  const pinConfigurations = ref<Record<string, string>>({}) // Key: PinName, Value: SelectedFunction
  const selectedPinName = ref<string | null>(null)
  const isLoaded = computed(() => !!currentChip.value)

  // Actions
  function loadChip(rawData: any) {
    const data = inferChipData(rawData)
    currentChip.value = data
    selectedPinName.value = null // Reset selection on chip load
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

  // Helper to find peripheral context from a function name
  function findFunctionContext(funcName: string, pinName?: string) {
    if (!currentChip.value?.peripherals) return null
    
    // Iterate all peripherals
    for (const [periphName, def] of Object.entries(currentChip.value.peripherals)) {
      if (!def.pinmaps) continue
      
      // Iterate all pinmaps
      for (let mapIndex = 0; mapIndex < def.pinmaps.length; mapIndex++) {
        const map = def.pinmaps[mapIndex]
        if (!map) continue
        const suffix = mapIndex === 0 ? '' : `_${mapIndex}`
        
        // Iterate all signals in the map
        for (const [signalName, mapPin] of Object.entries(map)) {
           // Optimization: if pinName is provided, mapPin must match
           // Relaxed check: Only check if pinName is strictly provided and valid
           if (pinName && mapPin !== pinName) continue 
           
           // Check if funcName matches expected patterns
           // Pattern 1: Periph_Signal + Suffix
           const full = `${periphName}_${signalName}${suffix}`
           if (funcName === full) {
             return { periphName, signalName, mapIndex, periphDef: def }
           }
           
           // Pattern 2: Signal + Suffix (Short name)
           if (funcName === `${signalName}${suffix}`) {
              return { periphName, signalName, mapIndex, periphDef: def }
           }
        }
      }
    }
    return null
  }

  function setPinFunction(pinName: string, func: string) {
    if (!currentChip.value) return
    const uiStore = useUIStore()
    
    // Create a mutable copy of configurations
    let newConfig = { ...pinConfigurations.value }

    // 如果选择的是默认功能或空，则移除配置
    if (!func) {
      delete newConfig[pinName]
      pinConfigurations.value = newConfig
      saveConfigurations()
      return
    }

    // 检查该引脚是否支持该功能
    const supported = getPinFunctions(pinName)
    if (!supported.includes(func)) {
      console.warn(`Pin ${pinName} does not support function ${func}`)
      return
    }

    // --- Conflict Resolution & Linkage Logic ---
    const context = findFunctionContext(func, pinName)
    
    if (context) {
      const { periphName, signalName, mapIndex, periphDef } = context
      
      // 1. Conflict Resolution: Clear same signal from other pins
      for (const [otherPin, otherFunc] of Object.entries(newConfig)) {
        if (otherPin === pinName) continue
        
        const otherContext = findFunctionContext(otherFunc) // No pin constraint for reverse lookup
        if (otherContext && 
            otherContext.periphName === periphName && 
            otherContext.signalName === signalName) {
           delete newConfig[otherPin]
        }
      }

      // 2. Group Switching (Linkage)
      const targetPinmap = periphDef.pinmaps[mapIndex]
      if (targetPinmap) {
        const switchOperations: Array<{pin: string, func: string}> = []
        const conflicts: string[] = []

        for (const [sig, targetPin] of Object.entries(targetPinmap)) {
          if (sig === signalName) continue // Skip self
          
          // Determine target function name
          let targetFunc = ''
          const suffix = mapIndex === 0 ? '' : `_${mapIndex}`
          const possibleFunc1 = `${periphName}_${sig}${suffix}`
          const possibleFunc2 = `${sig}${suffix}`
          
          const pinFuncs = getPinFunctions(targetPin)
          if (pinFuncs.includes(possibleFunc1)) targetFunc = possibleFunc1
          else if (pinFuncs.includes(possibleFunc2)) targetFunc = possibleFunc2
          
          if (!targetFunc) continue 

          // Check if we should switch this signal
          // Only switch if this signal is currently active on SOME pin
          let signalActive = false
          for (const [p, f] of Object.entries(newConfig)) {
             const c = findFunctionContext(f)
             if (c && c.periphName === periphName && c.signalName === sig) {
               signalActive = true
               break
             }
          }
          
          if (signalActive) {
             const currentOwner = newConfig[targetPin]
             // Check if target pin is free or already set correctly
             if (!currentOwner || currentOwner === targetFunc) {
               switchOperations.push({ pin: targetPin, func: targetFunc })
             } else {
               // Conflict
               conflicts.push(`${sig} -> ${targetPin} (Occupied by ${currentOwner})`)
             }
          }
        }
        
        if (conflicts.length > 0) {
          // alert(`无法自动切换同组信号 (Peripheral: ${periphName}):\n${conflicts.join('\n')}\n请手动解决冲突。`)
          uiStore.showModal(
            '外设信号冲突警告',
            `无法自动切换同组信号 (Peripheral: ${periphName}):\n${conflicts.join('\n')}\n\n请先手动释放冲突引脚，再进行切换。`,
            'warning'
          )
          return // Abort operation
        } else {
          // Apply switches
          // First clear old pins for these signals
          switchOperations.forEach(op => {
             const ctx = findFunctionContext(op.func)
             if (ctx) {
                for (const [p, f] of Object.entries(newConfig)) {
                   const c = findFunctionContext(f)
                   if (c && c.periphName === ctx.periphName && c.signalName === ctx.signalName) {
                      delete newConfig[p]
                   }
                }
             }
          })
          // Then set new
          switchOperations.forEach(op => {
             newConfig[op.pin] = op.func
          })
        }
      }
    }

    // Set the requested pin
    newConfig[pinName] = func
    pinConfigurations.value = newConfig

    // 保存到 localStorage
    saveConfigurations()
  }

  function setSelectedPin(pinName: string | null) {
    selectedPinName.value = pinName
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
   * 获取引脚占用统计
   */
  const usageStats = computed(() => {
    if (!currentChip.value) return { occupied: 0, total: 0 }
    
    const allPins = currentChip.value.package.pins
    const total = allPins.length
    let occupied = 0
    
    for (const pin of allPins) {
      const pinCap = currentChip.value.pins[pin.name]
      if (!pinCap) continue // Should not happen
      
      // 1. 固定功能的引脚（如电源、地、复位等）默认视为占用
      if (pinCap.fixed) {
        occupied++
        continue
      }
      
      // 2. 被用户配置了功能的引脚
      // 注意：getPinConfiguration 返回 undefined 表示未配置
      if (pinConfigurations.value[pin.name]) {
        occupied++
      }
    }
    
    return { occupied, total }
  })

  /**
   * 获取物理引脚信息（编号和名称）
   */
  const physicalPins = computed(() => {
    if (!currentChip.value) return []
    return currentChip.value.package.pins
  })

  return {
    currentChip,
    pinConfigurations,
    selectedPinName,
    isLoaded,
    physicalPins,
    usageStats,
    loadChip,
    setPinFunction,
    setSelectedPin,
    getPinConfiguration,
    getPinFunctions,
    getPinType,
    clearConfigurations
  }
})
