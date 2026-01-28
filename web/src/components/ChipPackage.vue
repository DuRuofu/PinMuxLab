<script setup lang="ts">
import { computed, ref } from 'vue'
import type { PackageInfo, ChipMeta, PinCapability } from '@/types/chip'
import { calculateLayout, type RenderedPin } from '@/utils/packageLayout'

const props = defineProps<{
  packageInfo: PackageInfo
  chipMeta?: ChipMeta
  pinConfigurations?: Record<string, string>
  pinCapabilities?: Record<string, PinCapability>
}>()

const emit = defineEmits<{
  (e: 'pin-click', pin: RenderedPin): void
  (e: 'pin-contextmenu', pin: RenderedPin, event: MouseEvent): void
}>()

// 判断引脚是否已配置
function isPinConfigured(pinName: string): boolean {
  return !!props.pinConfigurations?.[pinName]
}

// 判断引脚是否为固定功能 (Special Pin)
function isPinFixed(pinName: string): boolean {
  const cap = props.pinCapabilities?.[pinName]
  return !!cap?.fixed
}

// 获取引脚类型用于样式
function getPinTypeClass(pinName: string): string {
  const cap = props.pinCapabilities?.[pinName]
  if (!cap) return ''
  // 返回 pin-type-power, pin-type-gnd, pin-type-reset 等
  return `pin-type-${cap.type}`
}

// 缩放控制
const scale = ref(1)
const isDragging = ref(false)
const translateX = ref(0)
const translateY = ref(0)
const lastX = ref(0)
const lastY = ref(0)
const containerRef = ref<HTMLElement | null>(null)

function onWheel(e: WheelEvent) {
  e.preventDefault()
  
  const delta = e.deltaY > 0 ? 0.9 : 1.1
  const newScale = Math.min(Math.max(0.5, scale.value * delta), 10) // 限制缩放范围 0.5x ~ 10x

  // 直接更新缩放，不再计算鼠标偏移，实现中心缩放
  scale.value = newScale
}

function onMouseDown(e: MouseEvent) {
  isDragging.value = true
  lastX.value = e.clientX
  lastY.value = e.clientY
}

function onMouseMove(e: MouseEvent) {
  if (!isDragging.value) return
  const dx = e.clientX - lastX.value
  const dy = e.clientY - lastY.value
  translateX.value += dx
  translateY.value += dy
  lastX.value = e.clientX
  lastY.value = e.clientY
}

function onMouseUp() {
  isDragging.value = false
}

function zoomIn() {
  scale.value = Math.min(scale.value * 1.2, 10)
}

function zoomOut() {
  scale.value = Math.max(scale.value / 1.2, 0.5)
}

function resetZoom() {
  scale.value = 1
  translateX.value = 0
  translateY.value = 0
}

// 计算布局
const layout = computed(() => {
  if (!props.packageInfo) return null
  return calculateLayout(props.packageInfo)
})

function handlePinClick(pin: RenderedPin) {
  emit('pin-click', pin)
}

function handlePinRightClick(pin: RenderedPin, event: MouseEvent) {
  if (isPinFixed(pin.name)) return
  emit('pin-contextmenu', pin, event)
}
</script>

<template>
  <div 
    class="chip-package-container" 
    ref="containerRef"
    v-if="layout"
    @wheel="onWheel"
    @mousedown="onMouseDown"
    @mousemove="onMouseMove"
    @mouseup="onMouseUp"
    @mouseleave="onMouseUp"
  >
    <svg 
      :viewBox="`0 0 ${layout.width} ${layout.height}`" 
      preserveAspectRatio="xMidYMid meet"
      class="chip-svg"
      :style="{ transform: `translate(${translateX}px, ${translateY}px) scale(${scale})` }"
    >
      <!-- 芯片主体 -->
      <rect
        :x="layout.body.x"
        :y="layout.body.y"
        :width="layout.body.width"
        :height="layout.body.height"
        class="chip-body"
        rx="4"
      />

      <!-- Pin 1 标识 -->
      <circle
        v-if="layout.pin1Mark"
        :cx="layout.pin1Mark.cx"
        :cy="layout.pin1Mark.cy"
        :r="layout.pin1Mark.r"
        class="pin1-mark"
      />

      <!-- 芯片信息 (居中显示) -->
      <g v-if="chipMeta" class="chip-info-group">
        <text 
          :x="layout.width / 2" 
          :y="layout.height / 2 - 18" 
          text-anchor="middle" 
          class="chip-vendor"
        >
          {{ chipMeta.vendor }}
        </text>
        <text 
          :x="layout.width / 2" 
          :y="layout.height / 2" 
          text-anchor="middle" 
          dominant-baseline="middle"
          class="chip-name"
        >
          {{ chipMeta.name }}
        </text>
        <text 
          :x="layout.width / 2" 
          :y="layout.height / 2 + 18" 
          text-anchor="middle" 
          dominant-baseline="hanging"
          class="chip-package-name"
        >
          {{ chipMeta.package }}
        </text>
      </g>

      <!-- 引脚 -->
      <g 
        v-for="pin in layout.pins" 
        :key="pin.number" 
        class="pin-group" 
        @click.stop="handlePinClick(pin)"
        @contextmenu.prevent.stop="handlePinRightClick(pin, $event)"
        :class="{ 'is-fixed-pin': isPinFixed(pin.name) }"
      >
        <!-- 引脚形状 -->
        <rect
          :x="pin.x"
          :y="pin.y"
          :width="pin.width"
          :height="pin.height"
          class="pin-shape"
          :class="[
            { 'is-configured': isPinConfigured(pin.name) },
            getPinTypeClass(pin.name)
          ]"
        />
        
        <!-- 引脚名称 -->
        <text
          :x="pin.labelX"
          :y="pin.labelY"
          :text-anchor="pin.textAnchor"
          :dominant-baseline="pin.dominantBaseline"
          class="pin-label"
        >
          {{ pin.name }}
        </text>
      </g>
    </svg>

    <!-- 缩放控件 -->
    <div class="zoom-controls">
      <button @click.stop="zoomIn" title="放大">+</button>
      <button @click.stop="resetZoom" title="重置">⟲</button>
      <button @click.stop="zoomOut" title="缩小">-</button>
    </div>
  </div>
</template>

<style scoped>
.chip-package-container {
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  overflow: hidden; /* 防止 SVG 拖拽出边界 */
  background-color: var(--chip-viz-bg); /* 给背景加个淡色以便区分 */
  cursor: grab; /* 提示可拖拽 */
  position: relative; /* 为绝对定位的控件提供锚点 */
}

.zoom-controls {
  position: absolute;
  bottom: 20px;
  right: 20px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: var(--zoom-control-bg);
  padding: 8px;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.15);
}

.zoom-controls button {
  width: 32px;
  height: 32px;
  border: 1px solid var(--zoom-control-border);
  background: var(--zoom-control-bg);
  border-radius: 4px;
  cursor: pointer;
  font-size: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--zoom-control-text);
  transition: all 0.2s;
}

.zoom-controls button:hover {
  background: var(--zoom-control-hover);
  color: var(--text-primary);
}

.chip-package-container:active {
  cursor: grabbing;
}

.chip-svg {
  width: 100%;
  height: 100%;
  max-width: none; /* 移除最大宽度限制，由缩放控制 */
  transition: transform 0.1s ease-out; /* 让缩放更平滑 */
}

.chip-body {
  fill: #333;
  stroke: #666;
  stroke-width: 2;
}

.chip-info-group {
  pointer-events: none;
}

.chip-vendor {
  fill: #aaa;
  font-size: 10px; /* 14px -> 10px */
  font-weight: bold;
}

.chip-name {
  fill: #fff;
  font-size: 12px; /* 16px -> 12px */
  font-weight: bold;
}

.chip-package-name {
  fill: #aaa;
  font-size: 10px;
  font-weight: normal;
}

.pin1-mark {
  fill: #fff;
  opacity: 0.8;
}

.pin-group {
  cursor: pointer;
  transition: opacity 0.2s;
}

.pin-group:hover {
  opacity: 0.8;
}

.pin-shape {
  fill: #b0b0b0; /* 金属银色 */
  stroke: #666;
  stroke-width: 1;
  transition: fill 0.3s;
}

.pin-shape.is-configured {
  fill: #42b883; /* 配置后变为绿色 */
  stroke: #2c3e50;
}

/* Special Pin Types */
.pin-shape.pin-type-power {
  fill: #ff7875; /* Red */
}
.pin-shape.pin-type-gnd {
  fill: #595959; /* Dark Gray */
  stroke: #262626;
}
.pin-shape.pin-type-reset {
  fill: #faad14; /* Orange/Yellow */
}
.pin-shape.pin-type-boot {
  fill: #b37feb; /* Purple */
}

.pin-group:hover .pin-shape {
  fill: #e6f7ff;
}

/* Hover states for special pins */
.pin-group:hover .pin-shape.pin-type-power {
  fill: #ff9c6e;
}
.pin-group:hover .pin-shape.pin-type-gnd {
  fill: #8c8c8c;
}
.pin-group:hover .pin-shape.pin-type-reset {
  fill: #ffc53d;
}
.pin-group:hover .pin-shape.pin-type-boot {
  fill: #d3adf7;
}

.pin-label {
  font-size: 8px; /* 调小字体 */
  font-family: monospace;
  fill: #000; /* 改为黑色，因为背景是银色 */
  pointer-events: none; /* 让点击穿透到 rect */
  font-weight: bold;
}
</style>
