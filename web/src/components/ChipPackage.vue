<script setup lang="ts">
import { computed, ref } from 'vue'
import { useChipStore } from '@/stores/chipStore'
import type { PackageInfo, ChipMeta, PinCapability } from '@/types/chip'
import { calculateLayout, type RenderedPin } from '@/utils/packageLayout'

const props = defineProps<{
  packageInfo: PackageInfo
  chipMeta?: ChipMeta
  pinConfigurations?: Record<string, string>
  pinCapabilities?: Record<string, PinCapability>
}>()

const chipStore = useChipStore()

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

// 计算功能标签位置
function getFunctionLabelPos(pin: RenderedPin) {
  if (!layout.value) return { x: 0, y: 0, anchor: 'middle', baseline: 'middle' }
  
  const body = layout.value.body
  const gap = 8 // 文字距离引脚的间隙
  
  // 判定方位
  const isLeft = Math.abs((pin.x + pin.width) - body.x) < 1
  const isRight = Math.abs(pin.x - (body.x + body.width)) < 1
  const isTop = Math.abs((pin.y + pin.height) - body.y) < 1
  const isBottom = Math.abs(pin.y - (body.y + body.height)) < 1
  
  if (isLeft) {
    return {
      x: pin.x - gap,
      y: pin.y + pin.height / 2,
      anchor: 'end',
      baseline: 'middle',
      rotation: 0
    }
  } else if (isRight) {
    return {
      x: pin.x + pin.width + gap,
      y: pin.y + pin.height / 2,
      anchor: 'start',
      baseline: 'middle',
      rotation: 0
    }
  } else if (isTop) {
    return {
      x: pin.x + pin.width / 2,
      y: pin.y - gap,
      anchor: 'start', // Rotated -90: Text starts at (x,y) and goes UP
      baseline: 'middle', // Centered horizontally relative to pin width
      rotation: -90
    }
  } else if (isBottom) {
    return {
      x: pin.x + pin.width / 2,
      y: pin.y + pin.height + gap,
      anchor: 'end', // Rotated -90: Text ends at (x,y) (starts below)
      baseline: 'middle',
      rotation: -90
    }
  }
  
  return { x: pin.x, y: pin.y, anchor: 'middle', baseline: 'middle', rotation: 0 }
}

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
            { 
              'is-configured': isPinConfigured(pin.name),
              'pin-hover': chipStore.hoveredPinName === pin.name 
            },
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

        <!-- 功能名称 (选中时显示) -->
        <text
          v-if="isPinConfigured(pin.name)"
          :x="getFunctionLabelPos(pin).x"
          :y="getFunctionLabelPos(pin).y"
          :text-anchor="getFunctionLabelPos(pin).anchor"
          :dominant-baseline="getFunctionLabelPos(pin).baseline"
          :transform="`rotate(${getFunctionLabelPos(pin).rotation}, ${getFunctionLabelPos(pin).x}, ${getFunctionLabelPos(pin).y})`"
          class="pin-function-label"
        >
          {{ pinConfigurations?.[pin.name] }}
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

/* Default Pin Style */
.pin-shape {
  fill: var(--pin-default);
  stroke: #666;
  stroke-width: 1;
  transition: all 0.2s;
  cursor: pointer;
}

.pin-shape.is-configured {
  fill: var(--pin-selected);
  stroke: #2e8b57;
  stroke-width: 2;
}

.pin-shape:hover,
.pin-shape.pin-hover {
  fill: var(--pin-hover);
  stroke-width: 2;
  stroke: #555;
  filter: brightness(1.1);
}

/* Special Pin Types */
.pin-shape.pin-type-power {
  fill: var(--pin-power);
}
.pin-shape.pin-type-power:hover,
.pin-shape.pin-type-power.pin-hover {
  fill: var(--pin-power-hover);
}

.pin-shape.pin-type-gnd {
  fill: var(--pin-gnd);
}
.pin-shape.pin-type-gnd:hover,
.pin-shape.pin-type-gnd.pin-hover {
  fill: var(--pin-gnd-hover);
}

.pin-shape.pin-type-reset {
  fill: var(--pin-reset);
}
.pin-shape.pin-type-reset:hover,
.pin-shape.pin-type-reset.pin-hover {
  fill: var(--pin-reset-hover);
}

.pin-shape.pin-type-boot {
  fill: var(--pin-boot);
}
.pin-shape.pin-type-boot:hover,
.pin-shape.pin-type-boot.pin-hover {
  fill: var(--pin-boot-hover);
}

/* Hover Effects */
.pin-group:hover .pin-shape {
  fill: var(--pin-hover);
}

/* Hover states for special pins */
.pin-group:hover .pin-shape.pin-type-power {
  fill: var(--pin-power-hover);
}
.pin-group:hover .pin-shape.pin-type-gnd {
  fill: var(--pin-gnd-hover);
}
.pin-group:hover .pin-shape.pin-type-reset {
  fill: var(--pin-reset-hover);
}
.pin-group:hover .pin-shape.pin-type-boot {
  fill: var(--pin-boot-hover);
}

.chip-svg text {
  user-select: none;
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
}

.pin-label {
  font-size: 10px; /* 8px -> 10px */
  font-family: monospace;
  fill: #000; /* 改为黑色，因为背景是银色 */
  pointer-events: none; /* 让点击穿透到 rect */
  font-weight: bold;
}

.pin-function-label {
  font-size: 10px;
  font-family: monospace;
  font-weight: bold;
  fill: var(--chip-label-color);
  paint-order: stroke;
  stroke: var(--chip-viz-bg);
  stroke-width: 3px;
  stroke-linejoin: round;
  pointer-events: none;
}
</style>
