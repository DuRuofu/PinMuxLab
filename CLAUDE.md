# PinMuxLab

开源 MCU 引脚与外设分配可视化工具，为无专用配置工具的 MCU（如沁恒 CH32 系列）提供网页版引脚管理界面。

## 项目结构

```
PinMuxLab/
├── web/                    # 前端 Vue 3 项目
│   ├── src/
│   │   ├── assets/chips/   # 芯片 JSON 数据（WCH/沁恒系列）
│   │   ├── components/       # Vue 组件
│   │   │   └── ChipPackage.vue   # 核心：SVG 芯片封装可视化
│   │   ├── stores/          # Pinia 状态管理
│   │   │   └── chipStore.ts      # 芯片数据管理
│   │   ├── types/chip.ts    # TypeScript 类型定义
│   │   ├── utils/
│   │   │   ├── packageLayout.ts  # 封装布局计算算法
│   │   │   └── chipInferencer.ts # 芯片数据推断逻辑
│   │   └── view/PinMuxEditor.vue # 主编辑视图
│   └── package.json
├── docs/                   # 设计文档
│   ├── 芯片JSON数据定义.md   # 芯片数据格式说明
│   └── 技术实现文档.md
└── test/                   # 测试文件
```

## 技术栈

- Vue 3 (Composition API) + TypeScript
- Pinia 状态管理
- Vite 构建工具
- SVG 芯片封装可视化

## 芯片数据格式

芯片数据采用**推断式 JSON**，只需定义：
- `meta` - 芯片元信息（厂商、型号、封装）
- `package` - 物理引脚排列
- `peripherals` - 外设功能映射

程序自动推断引脚类型（power/gnd/reset/boot/gpio）和功能列表。

## 常用命令

```bash
cd web
pnpm install    # 安装依赖
pnpm dev        # 启动开发服务器
pnpm build      # 构建生产版本
```

## 在线预览

https://duruofu.github.io/PinMuxLab
