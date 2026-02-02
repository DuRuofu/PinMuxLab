export const PIN_CATEGORIES = {
  power: ['VDD', 'VCC', 'VBAT', 'VDDA', 'VIN'],
  gnd: ['VSS', 'GND', 'VSSA'],
  clock: ['OSC_IN', 'OSC_OUT', 'OSC32_IN', 'OSC32_OUT'],
  reset: ['NRST', 'RST', 'RESET'],
  boot: ['BOOT0', 'BOOT1'],
  nc: ['NC']
}

// Regex to identify standard GPIO pins (e.g., PA0, PB12, PC15)
export const GPIO_REGEX = /^P[A-Z]\d+$/

export const DEFAULT_SPECIAL_TYPE = 'special'
