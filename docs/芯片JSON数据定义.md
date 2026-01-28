# 芯片 JSON 数据定义

本文档用于说明 **PinMuxLab** 项目中，如何使用**单一 JSON 文件**来描述一颗 MCU 芯片的引脚、封装与外设复用能力。

设计目标：

- 一个芯片 **只对应一个 JSON 文件**
- 面向工程师，**对照 datasheet 即可填写**
- 结构稳定，支持后续能力扩展（外设联动、冲突检测等）

本文将以 **CH32V003F4U6** 为示例，说明完整定义流程。

------

## 一、文件命名约定

推荐命名格式：

```
<Vendor>_<ChipName>_<Package>.json
```

示例：

```
WCH_CH32V003F4U6_QFN20.json
```

------

## 二、整体结构概览

一个完整的芯片 JSON 文件由以下四个顶层字段组成：

```json
{
  "meta": {},
  "package": {},
  "pins": {},
  "peripherals": {}
}
```

> 说明：
>
> - 所有字段均为 **声明式数据**，不包含运行时状态
> - 允许字段内容不完整（v0.1 阶段尤其如此）

------

## 三、meta：芯片元信息

`meta` 用于描述芯片的基础信息，仅用于展示和识别，不参与任何逻辑判断。

```json
"meta": {
  "vendor": "WCH",
  "family": "CH32V003",
  "name": "CH32V003F4U6",
  "core": "RISC-V",
  "package": "QFN20",
  "datasheet": "CH32V003_DS.pdf"
}
```

字段说明：

| 字段      | 含义                 |
| --------- | -------------------- |
| vendor    | 芯片厂商             |
| family    | 芯片系列             |
| name      | 具体型号             |
| core      | 内核架构             |
| package   | 封装名称             |
| datasheet | 数据手册文件名或链接 |

------

## 四、package：封装与物理引脚

`package` 描述 **物理封装信息**，只关心：

- 引脚编号
- 引脚丝印名称

**不描述功能、不描述外设。**

```json
"package": {
  "type": "QFN20",
  "pinCount": 20,
  "pins": [
    { "number": 1, "name": "PA1" },
    { "number": 2, "name": "PA2" },
    { "number": 3, "name": "PA3" },
    { "number": 4, "name": "PA4" },
    { "number": 5, "name": "VSS" },
    { "number": 6, "name": "VDD" },
    { "number": 7, "name": "PB0" },
    { "number": 8, "name": "PB1" },
    { "number": 9, "name": "NRST" }
  ]
}
```

------

## 五、pins：引脚能力定义（核心）

`pins` 是整个芯片 JSON 中**最核心的部分**。它回答的问题是：**“这个引脚在 datasheet 里，被允许用来做什么？”**

### 基本结构

```json
"PA1": {
  "type": "gpio",
  "fixed": false,
  "functions": ["GPIO", "ADC_IN1", "TIM1_CH1"]
}
```

### 字段说明

| 字段      | 含义                                      |
| --------- | ----------------------------------------- |
| type      | 引脚类型（gpio / power / gnd / reset 等） |
| fixed     | 是否为固定功能引脚（不可复用）            |
| functions | 该引脚**所有可能功能的全集**              |

### 示例（CH32V003F4U6）

```json
"pins": {
  "VDD": {
    "type": "power",
    "fixed": true,
    "functions": ["VDD"]
  },

  "VSS": {
    "type": "gnd",
    "fixed": true,
    "functions": ["GND"]
  },

  "NRST": {
    "type": "reset",
    "fixed": true,
    "functions": ["NRST"]
  },

  "PA1": {
    "type": "gpio",
    "fixed": false,
    "functions": ["GPIO", "ADC_IN1", "TIM1_CH1"]
  },

  "PA2": {
    "type": "gpio",
    "fixed": false,
    "functions": ["GPIO", "USART_TX"]
  },

  "PA3": {
    "type": "gpio",
    "fixed": false,
    "functions": ["GPIO", "USART_RX"]
  }
}
```

> 注意：
>
> - `functions` 中只写 **datasheet 明确允许的功能**
> - 不写优先级、不写是否冲突

------

## 六、peripherals：外设定义（可选，推荐）

`peripherals` 用于描述 **“一个外设由哪些信号组成，这些信号可以映射到哪些引脚”**。

### 示例：USART

```json
"peripherals": {
  "USART1": {
    "type": "uart",
    "signals": {
      "TX": ["PA2"],
      "RX": ["PA3"]
    }
  }
}
```

字段说明：

| 字段    | 含义                                  |
| ------- | ------------------------------------- |
| type    | 外设类型（uart / spi / i2c / tim 等） |
| signals | 外设信号 → 可选引脚列表               |

> v0.1 阶段允许 peripherals 为空对象 `{}`。

------

## 七、推荐的填写流程（实操指南）

1. 打开 datasheet 的 **Pin description / Alternate function** 表
2. 填写 `meta`
3. 填写 `package.pins`
4. 按 IO 名称逐个填写 `pins`
5. （可选）整理常用外设到 `peripherals`

## 八、完整案例

参考：[WCH_CH32V003F4U6_QFN20.json](../chip-db/WCH_CH32V003F4U6_QFN20.json)

## 九、总结

该 JSON 设计遵循以下原则：

- **一个芯片，一个文件**
- **声明式、可读、可维护**
- **先解决 80% 工程痛点，再追求智能化**

这将是 PinMuxLab 后续所有功能（可视化、冲突检测、代码生成）的数据基础。