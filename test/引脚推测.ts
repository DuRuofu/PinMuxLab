import * as fs from 'fs';
import * as path from 'path';

// Input file path
const inputFilePath = path.resolve(process.cwd(), 'WCH_CH32V203C8T6_LQFP48.json');
// Output file path
const outputFilePath = path.resolve(process.cwd(), 'WCH_CH32V203C8T6_LQFP48_pins.json');

console.log(`Reading from: ${inputFilePath}`);

// Read input file
try {
    const fileContent = fs.readFileSync(inputFilePath, 'utf-8');
    const data = JSON.parse(fileContent);

    const pinFunctions: Record<string, Set<string>> = {};
    const allPins: Set<string> = new Set();

    // Helper to add function to pin
    function addFunction(pinName: string, funcName: string) {
        if (!pinFunctions[pinName]) {
            pinFunctions[pinName] = new Set();
        }
        pinFunctions[pinName].add(funcName);
    }

    // 1. Collect all pins from package definition
    if (data.package && data.package.pins) {
        data.package.pins.forEach((pin: any) => {
            allPins.add(pin.name);
        });
    }

    // 2. Iterate peripherals to find functions
    if (data.peripherals) {
        for (const periphKey in data.peripherals) {
            const periphData = data.peripherals[periphKey];
            
            for (const subPeriphKey in periphData) {
                if (subPeriphKey === 'Description') continue;
                
                const subPeriphData = periphData[subPeriphKey];
                if (subPeriphData && subPeriphData.pinmaps) {
                    subPeriphData.pinmaps.forEach((pinmap: any) => {
                        for (const signalName in pinmap) {
                            const pinName = pinmap[signalName];
                            
                            // Construct function name
                            let funcName = '';
                            if (subPeriphKey === '') {
                                funcName = signalName;
                            } else {
                                funcName = `${subPeriphKey}_${signalName}`;
                            }
                            
                            addFunction(pinName, funcName);
                        }
                    });
                }
            }
        }
    }

    // 3. Construct the result "pins" object
    const distinctPins = new Set([...allPins, ...Object.keys(pinFunctions)]);

    // Helper to determine pin type
    function getPinType(name: string): string {
        if (name.startsWith('VDD') || name === 'VBAT') return 'power';
        if (name.startsWith('VSS') || name === 'GND' || name === 'VSSA') return 'gnd';
        if (name === 'NRST') return 'reset';
        if (name.startsWith('BOOT')) return 'boot';
        return 'gpio';
    }

    const finalPinsObj: Record<string, any> = {};

    // Sort order for types
    const typeOrder: Record<string, number> = {
        'power': 1,
        'gnd': 2,
        'reset': 3,
        'boot': 4,
        'gpio': 5
    };

    const sortedPinNames = Array.from(distinctPins).sort((a, b) => {
        const typeA = getPinType(a);
        const typeB = getPinType(b);
        if (typeOrder[typeA] !== typeOrder[typeB]) {
            return typeOrder[typeA] - typeOrder[typeB];
        }
        // Then alphanumeric sort
        return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
    });

    sortedPinNames.forEach(pinName => {
        const type = getPinType(pinName);
        const isFixed = type !== 'gpio';
        
        const functions: string[] = [];
        
        // Add inferred functions
        if (pinFunctions[pinName]) {
            const funcs = Array.from(pinFunctions[pinName]);
            functions.push(...funcs);
        }

        // Add default functions based on type
        if (type === 'gpio') {
            // Ensure GPIO is first
            if (!functions.includes('GPIO')) {
                functions.unshift('GPIO');
            } else {
                 // If GPIO is already there, make sure it's first
                 functions.splice(functions.indexOf('GPIO'), 1);
                 functions.unshift('GPIO');
            }
        } else if (type === 'gnd') {
             if (functions.length === 0) functions.push('GND');
        } else {
             // For power, reset, boot, use the pin name itself if no other function found?
             // Or typically they are just fixed.
             if (functions.length === 0) functions.push(pinName);
        }
        
        // Remove duplicates
        const uniqueFunctions = [...new Set(functions)];
        
        finalPinsObj[pinName] = {
            type: type,
            fixed: isFixed,
            functions: uniqueFunctions
        };
    });

    const outputJSON = {
        pins: finalPinsObj
    };

    console.log(JSON.stringify(outputJSON, null, 2));

    fs.writeFileSync(outputFilePath, JSON.stringify(outputJSON, null, 2), 'utf-8');
    console.log(`Saved to ${outputFilePath}`);

} catch (err) {
    console.error('Error:', err);
}
