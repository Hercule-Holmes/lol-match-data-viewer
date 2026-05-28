import { createPinia } from 'pinia'
import { createApp } from 'vue'

import NaiveUIProviderApp from './NaiveUIProviderApp.vue'
import './assets/css/styles.less'
import './assets/css/transition.less'
import { router } from './routes'

console.log('[LCU:APP] Vue 应用启动中...')
console.log(`[LCU:APP] 启动时间: ${new Date().toISOString().replace('T', ' ').slice(0, 19)}`)

// 全局错误捕获 → 写入日志文件
window.addEventListener('error', (e) => {
  console.error(`[LCU:APP] 全局错误: ${e.message} at ${e.filename}:${e.lineno}`)
  if (window.lcuApi?.log) {
    window.lcuApi.log('error', `[LCU:APP] 全局错误: ${e.message} at ${e.filename}:${e.lineno}`)
  }
})

window.addEventListener('unhandledrejection', (e) => {
  console.error(`[LCU:APP] 未处理的 Promise 拒绝: ${e.reason}`)
  if (window.lcuApi?.log) {
    window.lcuApi.log('error', `[LCU:APP] 未处理的 Promise 拒绝: ${e.reason}`)
  }
})

try {
  const app = createApp(NaiveUIProviderApp).use(router).use(createPinia())

  app.mount('#app')
  console.log('[LCU:APP] Vue 应用挂载成功')
} catch (error) {
  console.error('[LCU:APP] LOL Match Data 无法正确加载：', error)
  if (window.lcuApi?.log) {
    window.lcuApi.log('error', `[LCU:APP] 应用加载失败: ${error}`)
  }
}
