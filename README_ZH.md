# PinMuxLab

> 开源 MCU 引脚与外设分配可视化工具

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![GitHub stars](https://img.shields.io/github/stars/duruofu/PinMuxLab)](https://github.com/duruofu/PinMuxLab/stargazers)
[![GitHub issues](https://img.shields.io/github/issues/duruofu/PinMuxLab)](https://github.com/duruofu/PinMuxLab/issues)
[![GitHub release (latest by date)](https://img.shields.io/github/v/release/duruofu/PinMuxLab)](https://github.com/duruofu/PinMuxLab/releases)

[English](./README.md) | 中文

---

PinMuxLab 是一款基于 Web 的可视化工具，旨在帮助嵌入式工程师直观地管理和分配 MCU 引脚功能。通过交互式封装图和外设映射视图，让引脚复用配置变得简单可靠。

## 功能特性

- **交互式 SVG 可视化** - 动态渲染芯片封装图（LQFP、QFN、TSSOP 等）
- **外设映射查看** - 查看 UART、SPI、I2C、ADC 等外设的所有可用引脚映射
- **重映射支持** - 轻松切换默认和备选引脚配置
- **自动推断** - 根据引脚名称自动识别引脚类型（电源、地、复位、启动、GPIO）
- **芯片数据库** - 基于 JSON 的芯片定义，易于添加新芯片
- **离线支持** - 完全在浏览器中运行，无需服务器

## 快速开始

### 在线演示

访问: [https://duruofu.github.io/PinMuxLab](https://duruofu.github.io/PinMuxLab)

### 本地开发

```bash
# 克隆仓库
git clone https://github.com/duruofu/PinMuxLab.git
cd PinMuxLab/web

# 安装依赖
pnpm install

# 启动开发服务器
pnpm dev
```

启动后访问 `http://localhost:5173`

### 生产构建

```bash
pnpm build
```

构建产物将输出到 `dist/` 目录

## 支持的芯片

目前支持的芯片系列：

| 厂商 | 系列 | 封装 |
|------|------|------|
| WCH (沁恒) | CH32V003 | SOP16, TSSOP20, QFN20 |
| WCH (沁恒) | CH32V203 | QFN20, TSSOP20, QSOP28, LQFP48, LQFP64 |
| WCH (沁恒) | CH32V208 | QFN68 |
| WCH (沁恒) | CH32V303 | LQFP64 |

> 想添加新芯片？查看 [芯片JSON数据定义](./docs/芯片JSON数据定义.md) 了解数据格式规范。

## 系统架构

```
┌─────────────┐
│  芯片 JSON   │  ← 芯片定义文件
└─────┬───────┘
      │
┌─────▼────────────────────┐
│   Pin / Peripheral Model  │  ← 核心抽象层
└─────┬────────────────────┘
      │
┌─────▼───────────┐
│   Pinia Store   │  ← 状态管理
└─────┬───────────┘
      │
┌─────▼────────────────────┐
│   SVG 可视化层            │  ← 交互界面
└──────────────────────────┘
```

## 项目结构

```
PinMuxLab/
├── web/                    # 前端 Vue 3 项目
│   ├── src/
│   │   ├── assets/chips/   # 芯片 JSON 数据文件
│   │   ├── components/      # Vue 组件
│   │   │   └── ChipPackage.vue   # 核心：SVG 芯片封装渲染器
│   │   ├── stores/          # Pinia 状态管理
│   │   │   └── chipStore.ts       # 芯片数据管理
│   │   ├── types/chip.ts    # TypeScript 类型定义
│   │   ├── utils/
│   │   │   ├── packageLayout.ts   # 封装布局算法
│   │   │   └── chipInferencer.ts  # 引脚推断逻辑
│   │   └── view/
│   │       └── PinMuxEditor.vue    # 主编辑视图
│   └── package.json
├── docs/                   # 文档
│   ├── 芯片JSON数据定义.md  # 芯片数据格式规范
│   ├── 技术实现文档.md       # 技术实现文档
│   └── 基础需求.md           # 需求分析
└── test/                   # 测试文件
```

## 文档

- [芯片 JSON 数据格式](./docs/芯片JSON数据定义.md) - 芯片定义文件格式说明
- [技术实现文档](./docs/技术实现文档.md) - 内部实现细节
- [基础需求分析](./docs/基础需求.md) - 项目需求分析

## 技术栈

- **框架**: Vue 3 (Composition API)
- **语言**: TypeScript
- **状态管理**: Pinia
- **构建工具**: Vite
- **可视化**: SVG

## 贡献

欢迎提交 Pull Request！如有问题请开 Issue。

## 开源许可

本项目采用 MIT 许可证 - 详见 [LICENSE](LICENSE) 文件。

---

如果这个项目对你有帮助，请考虑给一个 ⭐
