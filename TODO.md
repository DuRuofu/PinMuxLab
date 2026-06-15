# TODO

## ⚠️ 芯片数据待确认

- [ ] **CH32V006K8** — QFN32 物理引脚编号是估计的，必须对照手册修改 `package.pins`
- [ ] **CH32V307VCT6** — LQFP100 物理引脚编号是估计的，必须对照手册修改 `package.pins`
- [ ] **CH32V303 ETH** — `pinmaps: [{}]` 空的，需要填 RMII 引脚映射
- [ ] **CH32V307 ETH** — 同上，`pinmaps: [{}]` 空的

## 🐛 已知 Bug

- [ ] **CH32V208WBU6 QFN68** — pin 32 和 pin 34 都叫 `PD6`（疑似复制粘贴错误）
- [ ] **CH32V208WBU6 QFN68** — `meta` 缺 `flash` 和 `sram` 字段
- [ ] **CH32V303 FSMC** — 数据可能不完整（NADV/D9 都映射到 PB7，冲突）

## 🆕 待新增芯片

- [ ] CH32L103 — Arduino Core 有 `CH32L103C8T6` 的 PeripheralPins
- [ ] CH32X035 — Arduino Core 有 `CH32X035G8U` 的 PeripheralPins

## 🔧 技术改进

- [x] **芯片数据懒加载** — 改用 `import.meta.glob({ eager: false })`，按需加载 JSON
- [ ] **加单元测试** — chipInferencer / packageLayout / pinConfig 测试用例（预估半天）
- [ ] **撤销/重做** — pinConfigurations 历史栈实现 undo/redo（预估 2h）

## ✨ 用户体验提升

- [x] **引脚 hover 提示** — 鼠标悬停显示该引脚支持的所有功能
- [ ] **冲突 SVG 可视化** — 引脚被多个外设争用时在芯片图上标红（预估 2h）
- [ ] **一键自动分配** — 遍历外设未配信号，自动分配空闲默认引脚（预估半天）
- [ ] **引脚搜索** — 搜索框输入 `PA9` / `USART1_TX` 直接定位高亮（预估 2h）
- [ ] **资源统计面板** — 细分 GPIO/TIM/UART/SPI 等资源占用统计（预估 1h）
- [ ] **C 代码生成导出** — 根据配置生成 GPIO 初始化代码（预估一天）
