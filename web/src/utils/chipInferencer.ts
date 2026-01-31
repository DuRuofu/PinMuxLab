import type { ChipDefinition, PinCapability, PackageInfo, PeripheralDefinition } from '@/types/chip'

// New Format Types (Internal use for inference)
interface NewPeripheralMap {
  [category: string]: {
    Description?: string
    [key: string]: any // Sub-peripherals or Description
  }
}

/**
 * Infer full ChipDefinition from raw JSON data (New Format)
 * If data is already in Old Format (has complete pins and flat peripherals), returns it as is.
 */
export function inferChipData(raw: any): ChipDefinition {
  // 1. Check if it's already in Old Format (has 'pins' with capabilities and flat peripherals)
  // Simple check: if pins exists and first key has 'functions' array
  const hasPins = raw.pins && Object.keys(raw.pins).length > 0
  const firstPin = hasPins ? Object.values(raw.pins)[0] : null
  const isOldFormat = hasPins && (firstPin as any).functions
  
  // If strictly Old Format, we might still want to normalize peripherals if they are mixed?
  // But user request implies we are moving TO New Format on disk, but App needs Old Format structure.
  // If input is Old Format, we assume it matches ChipDefinition interface.
  if (isOldFormat) {
    return raw as ChipDefinition
  }

  // 2. It's New Format (or missing pins). We need to infer 'pins' and normalize 'peripherals'.
  
  const pkg: PackageInfo = raw.package
  const rawPeripherals: NewPeripheralMap = raw.peripherals || {}
  
  // Data structures for inference
  const pinFunctions: Record<string, Set<string>> = {}
  const allPins: Set<string> = new Set()
  
  // Helper to add function to pin
  function addFunction(pinName: string, funcName: string) {
    if (!pinFunctions[pinName]) {
      pinFunctions[pinName] = new Set()
    }
    pinFunctions[pinName].add(funcName)
  }

  // 2.1 Collect all pins from package
  if (pkg && pkg.pins) {
    pkg.pins.forEach(pin => {
      allPins.add(pin.name)
    })
  }

  // 2.2 Iterate peripherals to find functions AND build normalized peripherals list
  const normalizedPeripherals: Record<string, PeripheralDefinition> = {}

  for (const categoryKey in rawPeripherals) {
    const categoryData = rawPeripherals[categoryKey]
    
    for (const subKey in categoryData) {
      if (subKey === 'Description') continue
      
      const subData = categoryData[subKey]
      
      // Build normalized peripheral definition
      // Use Category as type if not specified? 
      // Old format expected 'type' like 'uart', 'timer'.
      // We can map known categories or just use the categoryKey.
      const periphType = mapCategoryToType(categoryKey)
      
      const signals: Record<string, string[]> = {}
      
      if (subData && subData.pinmaps) {
        subData.pinmaps.forEach((pinmap: any) => {
          for (const signalName in pinmap) {
            const pinName = pinmap[signalName]
            
            // 1. Add to Pin Functions
            let funcName = ''
            // If subKey is empty string (e.g. in SYS), use signalName directly?
            // In JSON example: "SYS": { "": [ ... ] }
            // Wait, looking at V203 JSON: "SYS": { "": [...] } is not present.
            // "SYS": { "SWDI0": "PC15" } direct mapping?
            // Re-checking V203 JSON:
            // "SYS": { "Description": "...", "": [{ "SWDI0": "PC15", ... }] }
            // So subKey is empty string "".
            
            if (subKey === '' || subKey === 'default') {
               funcName = signalName
            } else {
               funcName = `${subKey}_${signalName}`
            }
            
            addFunction(pinName, funcName)
            
            // 2. Add to Peripheral Signals
            if (!signals[signalName]) {
              signals[signalName] = []
            }
            if (!signals[signalName].includes(pinName)) {
              signals[signalName].push(pinName)
            }
          }
        })
      }
      
      // Store normalized peripheral
      // If subKey is empty, we might skip adding it to 'peripherals' map?
      // Or use categoryKey?
      // For SYS, typically it's not selected as a peripheral in PinMux?
      // But we should probably preserve it.
      const periphName = subKey === '' ? categoryKey : subKey
      
      normalizedPeripherals[periphName] = {
        type: periphType,
        signals: signals
      }
    }
  }

  // 2.3 Construct 'pins' object
  const distinctPins = new Set([...allPins, ...Object.keys(pinFunctions)])
  const finalPinsObj: Record<string, PinCapability> = {}
  
  // Sort order for types
  const typeOrder: Record<string, number> = {
    'power': 1,
    'gnd': 2,
    'reset': 3,
    'boot': 4,
    'gpio': 5
  }

  const sortedPinNames = Array.from(distinctPins).sort((a, b) => {
    const typeA = getPinType(a)
    const typeB = getPinType(b)
    const orderA = typeOrder[typeA] ?? 99
    const orderB = typeOrder[typeB] ?? 99
    if (orderA !== orderB) {
      return orderA - orderB
    }
    // Then alphanumeric sort
    return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
  })

  sortedPinNames.forEach(pinName => {
    const type = getPinType(pinName)
    const isFixed = type !== 'gpio'
    
    const functions: string[] = []
    
    // Add inferred functions
    if (pinFunctions[pinName]) {
      const funcs = Array.from(pinFunctions[pinName])
      functions.push(...funcs)
    }

    // Add default functions based on type
    if (type === 'gpio') {
      if (!functions.includes('GPIO')) {
        functions.unshift('GPIO')
      } else {
         functions.splice(functions.indexOf('GPIO'), 1)
         functions.unshift('GPIO')
      }
    } else if (type === 'gnd') {
       if (functions.length === 0) functions.push('GND')
    } else if (type === 'power') {
       if (functions.length === 0) functions.push(pinName) // VDD, VBAT
    } else if (type === 'reset') {
       if (functions.length === 0) functions.push('NRST')
    } else if (type === 'boot') {
       if (functions.length === 0) functions.push(pinName) // BOOT0
    }
    
    // Remove duplicates
    const uniqueFunctions = [...new Set(functions)]
    
    finalPinsObj[pinName] = {
      type: type,
      fixed: isFixed,
      functions: uniqueFunctions
    }
  })

  return {
    meta: raw.meta,
    package: raw.package,
    pins: finalPinsObj,
    peripherals: normalizedPeripherals
  }
}

// Helper to determine pin type
function getPinType(name: string): string {
  if (name.startsWith('VDD') || name === 'VBAT') return 'power'
  if (name.startsWith('VSS') || name === 'GND' || name === 'VSSA') return 'gnd'
  if (name === 'NRST') return 'reset'
  if (name.startsWith('BOOT')) return 'boot'
  return 'gpio'
}

// Helper to map Category to Type (simple heuristic)
function mapCategoryToType(category: string): string {
  const cat = category.toUpperCase()
  if (cat.includes('UART') || cat.includes('USART')) return 'uart'
  if (cat.includes('SPI')) return 'spi'
  if (cat.includes('I2C')) return 'i2c'
  if (cat.includes('ADC')) return 'adc'
  if (cat.includes('TIM') || cat.includes('GPTM') || cat.includes('ADTM')) return 'timer'
  if (cat.includes('CAN')) return 'can'
  if (cat.includes('USB')) return 'usb'
  if (cat.includes('ETH')) return 'eth'
  if (cat.includes('OPA')) return 'opa'
  if (cat.includes('COMP')) return 'comparator'
  if (cat.includes('SYS')) return 'sys'
  return category.toLowerCase()
}
