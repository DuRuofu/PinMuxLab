# PinMuxLab

> An open-source MCU pin & peripheral allocation visualizer

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![GitHub stars](https://img.shields.io/github/stars/duruofu/PinMuxLab)](https://github.com/duruofu/PinMuxLab/stargazers)
[![GitHub issues](https://img.shields.io/github/issues/duruofu/PinMuxLab)](https://github.com/duruofu/PinMuxLab/issues)
[![GitHub release (latest by date)](https://img.shields.io/github/v/release/duruofu/PinMuxLab)](https://github.com/duruofu/PinMuxLab/releases)

[English](./README.md) | [中文](./README_ZH.md)

English README is work in progress. See [README_ZH.md](./README_ZH.md) for Chinese version.

---

PinMuxLab is a web-based tool designed to help embedded engineers visualize and manage MCU pin assignments. It provides an interactive chip package diagram with peripheral mapping views, making pin multiplexing configuration intuitive and error-free.

## Features

- **Interactive SVG Visualization** - Dynamically rendered chip package diagrams (LQFP, QFN, TSSOP, etc.)
- **Peripheral Mapping** - View all available pin mappings for peripherals like UART, SPI, I2C, ADC
- **Remap Support** - Easily switch between default and alternate pin configurations
- **Auto-Inference** - Automatically infer pin types (power, GND, reset, boot, GPIO) from pin names
- **Chip Database** - JSON-based chip definition, easy to add new chips
- **Offline Support** - Works entirely in browser, no server required

## Quick Start

### Online Demo

Try it now: [https://duruofu.github.io/PinMuxLab](https://duruofu.github.io/PinMuxLab)

### Local Development

```bash
# Clone the repository
git clone https://github.com/duruofu/PinMuxLab.git
cd PinMuxLab/web

# Install dependencies
pnpm install

# Start dev server
pnpm dev
```

Visit `http://localhost:5173` after starting.

### Build for Production

```bash
pnpm build
```

Output will be in `dist/` directory.

## Supported Chips

Currently supported chip series:

| Vendor | Family | Package |
|--------|--------|---------|
| WCH (沁恒) | CH32V003 | SOP16, TSSOP20, QFN20 |
| WCH (沁恒) | CH32V203 | QFN20, TSSOP20, QSOP28, LQFP48, LQFP64 |
| WCH (沁恒) | CH32V208 | QFN68 |
| WCH (沁恒) | CH32V303 | LQFP64 |

> Want to add a new chip? See [芯片JSON数据定义](./docs/芯片JSON数据定义.md) for the data format specification.

## Architecture

```
┌─────────────┐
│  Chip JSON  │  ← Chip definition file
└─────┬───────┘
      │
┌─────▼────────────────────┐
│   Pin / Peripheral Model  │  ← Core abstraction layer
└─────┬────────────────────┘
      │
┌─────▼───────────┐
│   Pinia Store   │  ← State management
└─────┬───────────┘
      │
┌─────▼────────────────────┐
│   SVG Visualization       │  ← Interactive UI
└──────────────────────────┘
```

## Project Structure

```
PinMuxLab/
├── web/                    # Frontend Vue 3 project
│   ├── src/
│   │   ├── assets/chips/   # Chip JSON data files
│   │   ├── components/    # Vue components
│   │   │   └── ChipPackage.vue   # Core: SVG chip package renderer
│   │   ├── stores/         # Pinia stores
│   │   │   └── chipStore.ts      # Chip data management
│   │   ├── types/chip.ts   # TypeScript type definitions
│   │   ├── utils/
│   │   │   ├── packageLayout.ts   # Package layout algorithm
│   │   │   └── chipInferencer.ts  # Pin inference logic
│   │   └── view/
│   │       └── PinMuxEditor.vue    # Main editor view
│   └── package.json
├── docs/                   # Documentation
│   ├── 芯片JSON数据定义.md  # Chip data format spec
│   └── 技术实现文档.md       # Technical implementation doc
└── test/                   # Test files
```

## Documentation

- [Chip JSON Data Format](./docs/芯片JSON数据定义.md) - Specification for chip definition files
- [Technical Implementation](./docs/技术实现文档.md) - Internal implementation details
- [Basic Requirements](./docs/基础需求.md) - Project requirements analysis

## Tech Stack

- **Framework**: Vue 3 (Composition API)
- **Language**: TypeScript
- **State Management**: Pinia
- **Build Tool**: Vite
- **Visualization**: SVG

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

If this project helps you, please consider giving it a ⭐
