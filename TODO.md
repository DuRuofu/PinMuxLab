# TODO

## ⚠️ 芯片数据待确认

- [ ] **CH32V006K8** — QFN32 物理引脚编号是估计的，必须对照手册修改 `package.pins`
- [ ] **CH32V307VCT6** — LQFP100 物理引脚编号是估计的，必须对照手册修改 `package.pins`
- [ ] **CH32V303 ETH** — `pinmaps: [{}]` 空的，需要填 RMII 引脚映射
- [ ] **CH32V307 ETH** — 同上，`pinmaps: [{}]` 空的

## 🐛 已知 Bug

- [ ] **CH32V203F8U6 QFN20** — `package.type` 写了 `LQFP20`，应为 `QFN20`
- [ ] **CH32V208WBU6 QFN68** — pin 32 和 pin 34 都叫 `PD6`（疑似复制粘贴错误）
- [ ] **CH32V208WBU6 QFN68** — `meta` 缺 `flash` 和 `sram` 字段
- [ ] **CH32V303 FSMC** — 数据可能不完整（NADV/D9 都映射到 PB7，冲突）

## 🆕 待新增芯片

- [ ] CH32L103 — Arduino Core 有 `CH32L103C8T6` 的 PeripheralPins
- [ ] CH32X035 — Arduino Core 有 `CH32X035G8U` 的 PeripheralPins
