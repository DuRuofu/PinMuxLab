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
  // 1. Determine Format based on Peripherals structure
  // Old/Flat Format: Peripherals are flat objects with 'pinmaps' or 'signals' directly.
  // New/Nested Format: Peripherals are grouped by Category (e.g. ADTM -> TIM1). Values have 'Description' or sub-objects.
  
  const rawPeripherals = raw.peripherals || {}
  const periphKeys = Object.keys(rawPeripherals)
  const hasPeripherals = periphKeys.length > 0
  
  let isOldFormat = false
  
  if (hasPeripherals) {
    const firstPeriph = rawPeripherals[periphKeys[0]]
    // Check if the first peripheral has 'pinmaps' or 'signals' directly
    // Also check if it already has 'group' (idempotency)
    if (firstPeriph.pinmaps || firstPeriph.signals || firstPeriph.group) {
      isOldFormat = true
    }
  } else {
    // If no peripherals, rely on 'pins' existence to decide if it's a valid definition
    if (raw.pins && Object.keys(raw.pins).length > 0) {
      isOldFormat = true
    }
  }

  // If strictly Old Format, return as is.
  if (isOldFormat) {
    return raw as ChipDefinition
  }

  // 2. It's New Format (or missing pins). We need to infer 'pins' and normalize 'peripherals'.
  
  const pkg: PackageInfo = raw.package
  // const rawPeripherals is already defined at top of function
  
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
    const categoryDesc = categoryData.Description || ''
    
    for (const subKey in categoryData) {
      if (subKey === 'Description') continue
      
      const subData = categoryData[subKey]
      
      // Build normalized peripheral definition
      // Use Category as type if not specified? 
      // Old format expected 'type' like 'uart', 'timer'.
      // We can map known categories or just use the categoryKey.
      const periphType = mapCategoryToType(categoryKey)
      
      // Define peripheral name (e.g., TIM1, USART1)
      // If subKey is empty (e.g. SYS), use categoryKey
      const periphName = (subKey === '' || subKey === 'default') ? categoryKey : subKey
      
      const signals: Record<string, string[]> = {}
      
      // Handle both object with pinmaps and direct array (robustness)
      const pinmaps = Array.isArray(subData) ? subData : (subData?.pinmaps || [])

      if (pinmaps.length > 0) {
        pinmaps.forEach((pinmap: any) => {
          for (const signalName in pinmap) {
            const pinName = pinmap[signalName]
            
            // 1. Add to Pin Functions
            let funcName = ''
            // If subKey is empty string (e.g. in SYS), use signalName directly?
            // In JSON example: "SYS": { "": [ ... ] }
            
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
      
      normalizedPeripherals[periphName] = {
        type: periphType,
        group: categoryKey, // Store the original category key as group
        description: categoryDesc, // Store category description
        signals: signals,
        pinmaps: pinmaps
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
