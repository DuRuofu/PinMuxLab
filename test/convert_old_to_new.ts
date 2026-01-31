import * as fs from 'fs';
import * as path from 'path';

function getJsonFiles(dir: string): string[] {
    let results: string[] = [];
    if (!fs.existsSync(dir)) return results;
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            results = results.concat(getJsonFiles(file));
        } else {
            if (file.endsWith('.json')) {
                results.push(file);
            }
        }
    });
    return results;
}

// Helper to determine Category
function getCategory(type: string, name: string): string {
    const t = type.toLowerCase();
    const n = name.toUpperCase();
    if (t === 'uart' || n.includes('UART') || n.includes('USART')) return 'UART/USART';
    if (t === 'spi' || n.includes('SPI')) return 'SPI';
    if (t === 'i2c' || n.includes('I2C')) return 'I2C';
    if (t === 'adc' || n.includes('ADC')) return 'ADC';
    if (t === 'timer' || n.includes('TIM')) {
        // Simple heuristic for CH32
        if (n === 'TIM1' || n === 'TIM8') return 'ADTM'; // Advanced
        return 'GPTM'; // General Purpose
    }
    if (t === 'comparator' || n.includes('COMP')) return 'OPA'; // Or COMP? V203 uses OPA for OpAmp, but V003 has Comparator. 
    // Let's use COMP for Comparator if it exists? V203 JSON doesn't have COMP, it has OPA.
    // V003 has COMP1. Let's use "COMP" category.
    if (n.includes('COMP')) return 'COMP';
    if (t === 'can' || n.includes('CAN')) return 'CAN';
    if (t === 'usb' || n.includes('USB')) return 'USB';
    if (t === 'eth' || n.includes('ETH')) return 'ETH';
    if (n.includes('OPA')) return 'OPA';
    return 'Others';
}

async function convertFile(filePath: string) {
    console.log(`Processing ${filePath}...`);
    const content = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content);

    // Check if Old Format (has pins and peripherals with type)
    if (data.pins && data.peripherals) {
        console.log(`Converting Old Format: ${filePath}`);
        const newPeripherals: any = {};

        for (const key in data.peripherals) {
            const p = data.peripherals[key];
            if (!p.type) continue; // Skip if malformed

            const category = getCategory(p.type, key);
            if (!newPeripherals[category]) {
                newPeripherals[category] = {
                    "Description": `${category} Peripheral`
                };
            }

            // Extract signals
            const signals: Record<string, string[]> = {};
            if (p.signals) {
                for (const [sigName, sigPins] of Object.entries(p.signals)) {
                     if (Array.isArray(sigPins)) {
                         signals[sigName] = sigPins as string[];
                     }
                }
            }

            // Generate Grouped Pinmaps
            const pinmaps = generateGroupedPinmaps(signals);
            
            newPeripherals[category][key] = {
                "pinmaps": pinmaps
            };
        }
        
        data.peripherals = newPeripherals;
        delete data.pins;
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
        console.log(`Converted (Old -> New) ${filePath}`);
        return;
    }

    // Check if New Format (Nested categories) but maybe needs merging pinmaps
    // We assume if it has no 'pins' and has 'peripherals', it's New Format.
    // We will traverse and re-normalize pinmaps.
    if (!data.pins && data.peripherals) {
        console.log(`Refining New Format: ${filePath}`);
        let modified = false;

        for (const catKey in data.peripherals) {
            const category = data.peripherals[catKey];
            for (const periphKey in category) {
                if (periphKey === 'Description') continue;
                
                const periph = category[periphKey];
                if (periph.pinmaps && Array.isArray(periph.pinmaps)) {
                    // Reconstruct signals from pinmaps
                    const signals: Record<string, string[]> = {};
                    
                    // Flatten existing pinmaps to collect all options
                    // If pinmaps are "Split" (My previous bad output), this works.
                    // If pinmaps are "Grouped" (Good output), this also works (collects all values).
                    periph.pinmaps.forEach((map: any) => {
                        for (const [sig, pin] of Object.entries(map)) {
                            if (!signals[sig]) signals[sig] = [];
                            signals[sig].push(pin as string);
                        }
                    });

                    const newPinmaps = generateGroupedPinmaps(signals);
                    
                    // Simple check if changed to avoid unnecessary writes
                    if (JSON.stringify(newPinmaps) !== JSON.stringify(periph.pinmaps)) {
                        periph.pinmaps = newPinmaps;
                        modified = true;
                    }
                }
            }
        }

        if (modified) {
             fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
             console.log(`Refined (Fixed Pinmaps) ${filePath}`);
        } else {
             console.log(`No changes needed for ${filePath}`);
        }
    }
}

function generateGroupedPinmaps(signals: Record<string, string[]>): any[] {
    let maxLen = 0;
    for (const pins of Object.values(signals)) {
        if (pins.length > maxLen) maxLen = pins.length;
    }

    if (maxLen === 0) return [];

    const maps: any[] = [];
    for (let i = 0; i < maxLen; i++) {
        const map: any = {};
        let hasContent = false;
        
        for (const [sig, pins] of Object.entries(signals)) {
            // Logic:
            // 1. If pins.length == 1, always use it (Common/Fixed pin).
            // 2. If pins.length > 1, use pin at index i.
            //    If i >= pins.length, do not include (Partial remap? or Wrap? or Clamp?)
            //    Let's assume "Partial Remap" means this signal is NOT present in this config.
            //    BUT, old format usually padded or aligned.
            //    If we have TX:[A,B] and CTS:[C], and maxLen=2.
            //    Map 0: TX:A, CTS:C.
            //    Map 1: TX:B, CTS:? (C? or None?)
            //    If we assume CTS is available in ALL configs, it should be length 1?
            //    If it's length 1, we handled it.
            //    If it's length > 1 but < maxLen? e.g. CTS:[C, D] and TX:[A, B, E, F].
            //    Map 2: TX:E, CTS:?
            //    In CH32, usually remaps are consistent.
            //    Let's be strict: if index exists, use it. If not, omit.
            
            if (pins.length === 1) {
                map[sig] = pins[0];
                hasContent = true;
            } else if (i < pins.length) {
                map[sig] = pins[i];
                hasContent = true;
            }
        }
        
        if (hasContent) {
            maps.push(map);
        }
    }
    return maps;
}

async function main() {
    const rootDir = path.resolve(process.cwd(), 'web/src/assets/chips');
    
    // Target specific directories
    const targetDirs = [
        path.join(rootDir, 'WCH/CH32V003'),
        path.join(rootDir, 'WCH/CH32V208')
    ];

    for (const dir of targetDirs) {
        if (!fs.existsSync(dir)) {
            console.log(`Directory not found: ${dir}`);
            continue;
        }
        
        const files = getJsonFiles(dir);
         for (const file of files) {
              await convertFile(file);
         }
    }
}


main();
