# 芯片 JSON 数据定义 (v2.0)

本文档说明 **PinMuxLab** 项目中使用的芯片数据格式。
从 v2.0 开始，我们采用 **推断式（Inferred）** 结构，简化了配置文件，不再需要手动填写冗余的 `pins` 定义。

## 一、设计理念

1.  **单一数据源**：一个芯片对应一个 JSON 文件。
2.  **以 datasheet 为准**：数据结构贴近 datasheet 的描述方式（引脚列表 + 外设功能表）。
3.  **自动推断**：核心的 `pins` 逻辑能力由 `package`（物理引脚）和 `peripherals`（外设映射）自动生成，避免数据冲突。

## 二、文件命名

推荐命名格式：`<Vendor>_<Family>_<Name>_<Package>.json`

示例：`WCH_CH32V203C8T6_LQFP48.json`

## 三、顶级结构

```json
{
  "meta": { ... },
  "package": { ... },
  "peripherals": { ... }
}
```

> 注意：旧版本中的 `pins` 对象已废弃，现在由程序根据 `package` 和 `peripherals` 自动生成。

---

## 四、meta：元信息

描述芯片的基本属性。

```json
"meta": {
  "vendor": "WCH",
  "family": "CH32V203",
  "name": "CH32V203C8T6",
  "core": "RISC-V (QingKe V4B)",
  "package": "LQFP48",
  "flash": "64K",      // 可选，Flash 大小
  "sram": "20K",       // 可选，SRAM 大小
  "datasheet": "http://..."
}
```

---

## 五、package：物理封装

描述芯片的物理引脚排列。

```json
"package": {
  "type": "LQFP48",
  "pinCount": 48,
  "pins": [
    { "number": 1, "name": "VBAT" },
    { "number": 2, "name": "PC13" },
    ...
  ]
}
```

- **number**: 物理引脚号。
- **name**: 引脚名称（如 PA0, VDD, NRST）。程序会根据名称前缀自动识别电源（VDD/VSS）、复位（NRST）和启动（BOOT）引脚。

---

## 六、peripherals：外设定义

这是配置文件的核心，描述了外设的功能及其引脚映射关系。
结构按 **功能分类 (Category)** -> **具体外设 (Instance)** -> **引脚映射 (Pinmaps)** 组织。

### 结构示例

```json
"peripherals": {
  "UART/USART": {
    "Description": "通用同步/异步收发器",
    "USART1": {
      "pinmaps": [
        { "TX": "PA9", "RX": "PA10" },  // 默认映射
        { "TX": "PB6", "RX": "PB7" }    // 重映射 1
      ]
    }
  },
  "SPI": {
    "Description": "串行外设接口",
    "SPI1": {
      "pinmaps": [
        { "NSS": "PA4", "SCK": "PA5", "MISO": "PA6", "MOSI": "PA7" },
        { "NSS": "PA15", "SCK": "PB3", "MISO": "PB4", "MOSI": "PB5" }
      ]
    }
  }
}
```

### 字段说明

1.  **Category (第一层 Key)**:
    - 如 `UART/USART`, `SPI`, `I2C`, `ADTM` (高级定时器) 等。
    - 包含一个 `Description` 字段用于UI展示。

2.  **Instance (第二层 Key)**:
    - 具体的外设实例名，如 `USART1`, `TIM2`。
    - 如果该分类下没有具体实例区分（如系统功能），Key 可以为空字符串 `""` 或 `"default"`。

3.  **pinmaps (映射列表)**:
    - 一个数组，每个元素是一个对象，代表一种引脚映射方案（默认或重映射）。
    - **Key**: 信号名称 (如 `TX`, `SCK`, `CH1`)。
    - **Value**: 对应的引脚名称 (必须在 `package` 中存在)。
    - 程序会自动将同一组映射中的信号归类。

### 特殊情况：多通道外设 (如 ADC)

对于 ADC 这种所有通道共享同一外设实例的情况，通常只有一个 pinmap 对象：

```json
"ADC": {
  "Description": "模数转换器",
  "ADC1": {
    "pinmaps": [
      {
        "IN0": "PA0",
        "IN1": "PA1",
        "IN2": "PA2",
        ...
      }
    ]
  }
}
```

---

## 七、推断逻辑说明

程序加载 JSON 时会执行以下推断：

1.  **引脚类型识别**:
    - `VDD*`, `VBAT` -> `power`
    - `VSS*`, `GND` -> `gnd`
    - `NRST` -> `reset`
    - `BOOT*` -> `boot`
    - 其他 -> `gpio`

2.  **功能生成**:
    - 遍历 `peripherals` 中的所有 `pinmaps`。
    - 如果引脚 `PA9` 在 `USART1` 的 `TX` 信号中出现，则 `PA9` 的功能列表中会自动增加 `USART1_TX`。
    - 默认添加 `GPIO` 功能（对于 GPIO 类型的引脚）。

这种方式确保了外设定义与引脚功能的一致性，修改外设映射会自动更新引脚的可选功能列表。
