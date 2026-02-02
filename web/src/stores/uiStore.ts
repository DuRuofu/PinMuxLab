import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useUIStore = defineStore('ui', () => {
  const modalVisible = ref(false)
  const modalTitle = ref('')
  const modalContent = ref('')
  const modalType = ref<'info' | 'warning' | 'error'>('info')

  function showModal(title: string, content: string, type: 'info' | 'warning' | 'error' = 'info') {
    modalTitle.value = title
    modalContent.value = content
    modalType.value = type
    modalVisible.value = true
  }

  function closeModal() {
    modalVisible.value = false
  }

  return {
    modalVisible,
    modalTitle,
    modalContent,
    modalType,
    showModal,
    closeModal
  }
})
