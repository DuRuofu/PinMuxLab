<script setup lang="ts">
import { useUIStore } from '@/stores/uiStore'
import { storeToRefs } from 'pinia'

const uiStore = useUIStore()
const { modalVisible, modalTitle, modalContent, modalType } = storeToRefs(uiStore)

const close = () => {
  uiStore.closeModal()
}
</script>

<template>
  <Transition name="modal-fade">
    <div v-if="modalVisible" class="modal-overlay" @click.self="close">
      <div class="modal-container" :class="modalType">
        <div class="modal-header">
          <h3>{{ modalTitle }}</h3>
          <button class="close-btn" @click="close">&times;</button>
        </div>
        <div class="modal-body">
          <pre>{{ modalContent }}</pre>
        </div>
        <div class="modal-footer">
          <button class="confirm-btn" @click="close">确定</button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 9999;
}

.modal-container {
  background-color: var(--bg-secondary, #fff);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  width: 90%;
  max-width: 500px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--border-color, #eee);
  color: var(--text-primary, #333);
}

.modal-container.error {
  border-left: 5px solid #ff4d4f;
}

.modal-container.warning {
  border-left: 5px solid #faad14;
}

.modal-header {
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color, #eee);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: var(--text-secondary, #666);
}

.modal-body {
  padding: 20px;
  overflow-y: auto;
}

.modal-body pre {
  white-space: pre-wrap;
  word-wrap: break-word;
  font-family: inherit;
  margin: 0;
  font-size: 14px;
  line-height: 1.5;
}

.modal-footer {
  padding: 12px 20px;
  border-top: 1px solid var(--border-color, #eee);
  display: flex;
  justify-content: flex-end;
}

.confirm-btn {
  padding: 8px 24px;
  background-color: #1890ff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: background-color 0.2s;
}

.confirm-btn:hover {
  background-color: #40a9ff;
}

/* Dark mode support via global vars */
:root[data-theme='dark'] .modal-container {
  background-color: #1f1f1f;
  border-color: #303030;
}

.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.3s ease;
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}
</style>
