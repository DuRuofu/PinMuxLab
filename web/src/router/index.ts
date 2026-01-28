import { createRouter, createWebHistory } from 'vue-router'
import PinMuxEditor from '@/view/PinMuxEditor.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: PinMuxEditor
    }
  ],
})

export default router
