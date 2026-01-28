<script setup lang="ts">
import { computed, ref } from 'vue'
import type { PackageInfo, ChipMeta } from '@/types/chip'
import { calculateQuadLayout, type RenderedPin } from '@/utils/packageLayout'

const props = defineProps<{
  packageInfo: PackageInfo
  chipMeta?: ChipMeta
}>()

const emit = defineEmits<{
  (e: 'pin-click', pin: RenderedPin): void
}>()

// 缩放控制
const scale = ref(1)
const isDragging = ref(false)
const translateX = ref(0)
const translateY = ref(0)
const lastX = ref(0)
const lastY = ref(0)

function onWheel(e: WheelEvent) {
  e.preventDefault()
  const delta = e.deltaY > 0 ? 0.9 : 1.1
  scale.value = Math.min(Math.max(0.5, scale.value * delta), 5) // 限制缩放范围 0.5x ~ 5x
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

// 计算布局
const layout = computed(() => {
  if (!props.packageInfo) return null
  // 目前默认都使用 QuadFlat 布局 (QFN/LQFP)
  return calculateQuadLayout(props.packageInfo)
})

function handlePinClick(pin: RenderedPin) {
  emit('pin-click', pin)
}
</script>

<template>
  <div 
    class="chip-package-container" 
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

      <!-- 芯片信息 (居中显示) -->
      <g v-if="chipMeta" class="chip-info-group">
        <text 
          :x="layout.width / 2" 
          :y="layout.height / 2 - 8" 
          text-anchor="middle" 
          class="chip-vendor"
        >
          {{ chipMeta.vendor }}
        </text>
        <text 
          :x="layout.width / 2" 
          :y="layout.height / 2 + 8" 
          text-anchor="middle" 
          dominant-baseline="hanging"
          class="chip-name"
        >
          {{ chipMeta.name }}
        </text>
      </g>

      <!-- 引脚 -->
      <g v-for="pin in layout.pins" :key="pin.number" class="pin-group" @click="handlePinClick(pin)">
        <!-- 引脚形状 -->
        <rect
          :x="pin.x"
          :y="pin.y"
          :width="pin.width"
          :height="pin.height"
          class="pin-shape"
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
  background-color: #f0f0f0; /* 给背景加个淡色以便区分 */
  cursor: grab; /* 提示可拖拽 */
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
}

.pin-group:hover .pin-shape {
  fill: #42b883; /* Vue Green 高亮 */
}

.pin-label {
  font-size: 8px; /* 调小字体 */
  font-family: monospace;
  fill: #000; /* 改为黑色，因为背景是银色 */
  pointer-events: none; /* 让点击穿透到 rect */
  font-weight: bold;
}
</style>
