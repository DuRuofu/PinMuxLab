# PinMuxLab Web Client

PinMuxLab 的前端可视化界面，基于 Vue 3 + TypeScript + Vite 构建。

## 技术栈

- **框架**: Vue 3 (Composition API)
- **语言**: TypeScript
- **状态管理**: Pinia
- **构建工具**: Vite
- **样式**: CSS (Scoped)

## 项目结构

```
web/
├── src/
│   ├── assets/          # 静态资源 (含示例芯片 JSON)
│   ├── components/      # Vue 组件
│   │   └── ChipPackage.vue  # 核心：芯片封装可视化组件 (SVG)
│   ├── stores/          # Pinia 状态管理
│   │   └── chipStore.ts     # 芯片数据管理 Store
│   ├── types/           # TypeScript 类型定义
│   │   └── chip.ts          # 芯片 JSON 数据结构定义
│   ├── utils/           # 工具函数
│   │   └── packageLayout.ts # 封装布局计算算法 (核心几何逻辑)
│   ├── App.vue          # 主应用入口
│   └── main.ts          # 程序入口
├── index.html           # HTML 模板
└── package.json         # 依赖配置
```

## 开发与运行

本项目使用 `pnpm` 作为包管理器。

### 1. 安装依赖

```bash
pnpm install
```

### 2. 启动开发服务器

```bash
pnpm dev
```

启动后访问终端显示的本地地址（通常是 `http://localhost:5173`）。

### 3. 构建生产版本

```bash
pnpm build
```

## 功能说明

目前处于 v0.1 原型阶段，主要功能包括：
1. **自动加载芯片数据**：启动时自动读取 `src/assets` 下的 JSON 示例。
2. **SVG 动态渲染**：根据 JSON 中的封装信息，自动计算并绘制 QFN/LQFP 封装图。
3. **交互查询**：点击芯片引脚，右侧边栏显示该引脚的详细功能定义。
