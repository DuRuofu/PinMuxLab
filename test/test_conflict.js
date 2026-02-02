
const chipData = {
  peripherals: {
    "CAN1": {
      "pinmaps": [
        { "RX": "PA11", "TX": "PA12" },
        { "RX": "PB8", "TX": "PB9" }
      ]
    }
  }
};

const pinFunctions = {
    "PA11": ["CAN1_RX"],
    "PA12": ["CAN1_TX"],
    "PB8": ["CAN1_RX_1"],
    "PB9": ["CAN1_TX_1"]
};

function getPinFunctions(pinName) {
    return pinFunctions[pinName] || [];
}

let pinConfigurations = {
  "PB8": "CAN1_RX_1",
  "PB9": "CAN1_TX_1"
};

function findFunctionContext(funcName, pinName) {
  if (!chipData.peripherals) return null;

  for (const [periphName, def] of Object.entries(chipData.peripherals)) {
    if (!def.pinmaps) continue;

    for (let mapIndex = 0; mapIndex < def.pinmaps.length; mapIndex++) {
      const map = def.pinmaps[mapIndex];
      const suffix = mapIndex === 0 ? '' : `_${mapIndex}`;

      for (const [signalName, mapPin] of Object.entries(map)) {
        if (pinName && mapPin !== pinName) continue;

        const full = `${periphName}_${signalName}${suffix}`;
        if (funcName === full) {
          return { periphName, signalName, mapIndex, periphDef: def };
        }

        if (funcName === `${signalName}${suffix}`) {
           return { periphName, signalName, mapIndex, periphDef: def };
        }
      }
    }
  }
  return null;
}

function setPinFunction(pinName, func) {
  let newConfig = { ...pinConfigurations };

  const context = findFunctionContext(func, pinName);
  
  if (context) {
    console.log(`Setting ${pinName} to ${func}. Context found: ${context.periphName}.${context.signalName} (Map ${context.mapIndex})`);
    const { periphName, signalName, mapIndex, periphDef } = context;

    // 1. Conflict Resolution
    for (const [otherPin, otherFunc] of Object.entries(newConfig)) {
      if (otherPin === pinName) continue;
      const otherContext = findFunctionContext(otherFunc);
      if (otherContext && otherContext.periphName === periphName && otherContext.signalName === signalName) {
        console.log(`  Conflict: Removing ${otherPin} (${otherFunc})`);
        delete newConfig[otherPin];
      }
    }

    // 2. Linkage
    const targetPinmap = periphDef.pinmaps[mapIndex];
    if (targetPinmap) {
        const switchOperations = [];
        const conflicts = [];

        for (const [sig, targetPin] of Object.entries(targetPinmap)) {
            if (sig === signalName) continue;

            let targetFunc = '';
            const suffix = mapIndex === 0 ? '' : `_${mapIndex}`;
            const possibleFunc1 = `${periphName}_${sig}${suffix}`;
            const possibleFunc2 = `${sig}${suffix}`;

            const pinFuncs = getPinFunctions(targetPin);
            if (pinFuncs.includes(possibleFunc1)) targetFunc = possibleFunc1;
            else if (pinFuncs.includes(possibleFunc2)) targetFunc = possibleFunc2;

            if (!targetFunc) {
                console.log(`  Target func not found for ${sig} on ${targetPin}`);
                continue;
            }

            let signalActive = false;
            for (const [p, f] of Object.entries(newConfig)) {
                const c = findFunctionContext(f);
                if (c && c.periphName === periphName && c.signalName === sig) {
                    signalActive = true;
                    break;
                }
            }

            if (signalActive) {
                const currentOwner = newConfig[targetPin];
                if (!currentOwner || currentOwner === targetFunc) {
                    switchOperations.push({ pin: targetPin, func: targetFunc });
                } else {
                    conflicts.push(`${sig} -> ${targetPin} (Occupied by ${currentOwner})`);
                }
            }
        }

        if (conflicts.length > 0) {
            console.log("  Linkage Conflicts:", conflicts);
        } else {
            console.log("  Linkage Operations:", switchOperations);
            // Apply switches
            switchOperations.forEach(op => {
                const ctx = findFunctionContext(op.func);
                if (ctx) {
                    // Remove old pins for this signal
                    for (const [p, f] of Object.entries(newConfig)) {
                        const c = findFunctionContext(f);
                        if (c && c.periphName === ctx.periphName && c.signalName === ctx.signalName) {
                             console.log(`    Linkage: Removing ${p} (${f})`);
                             delete newConfig[p];
                        }
                    }
                }
            });
            switchOperations.forEach(op => {
                console.log(`    Linkage: Setting ${op.pin} to ${op.func}`);
                newConfig[op.pin] = op.func;
            });
        }
    }
  }

  newConfig[pinName] = func;
  pinConfigurations = newConfig;
}

console.log("Initial:", pinConfigurations);
setPinFunction("PA11", "CAN1_RX");
console.log("Final:", pinConfigurations);
