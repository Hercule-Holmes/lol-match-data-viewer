<template>
  <img
    v-if="url"
    :src="url"
    class="lcu-image"
    :style="{ width: size + 'px', height: size + 'px' }"
    @dragstart.prevent
    @error="handleError"
  />
  <div v-else class="lcu-image-placeholder" :style="{ width: size + 'px', height: size + 'px' }"></div>
</template>

<script lang="ts" setup>
/** 图片加载组件 —— 对标 LeagueAkari 的 LcuImage.vue
 *  使用 new URL() 解析相对路径，通过 lcu-asset:// 协议代理 LCU CDN */
import { useGameDataStore } from '../../stores/game-data'
import { ref, watchEffect } from 'vue'

const { src, size = 22 } = defineProps<{
  src?: string
  size?: number
}>()

const url = ref<string | null>(null)
const gds = useGameDataStore()

watchEffect(() => {
  if (typeof src !== 'undefined' && src) {
    const resolvedUrl = new URL(src, 'lcu-asset://lcu').href

    if (resolvedUrl.startsWith('lcu-asset://')) {
      if (gds.connected) {
        url.value = resolvedUrl
      } else {
        url.value = null
      }
    } else {
      url.value = src
    }
  } else {
    url.value = null
  }
})

const handleError = (e: Event) => {
  const img = e.target as HTMLImageElement
  console.warn(`[LCU:RENDERER] LcuImage 加载失败: ${img?.src?.slice(0, 100) || '未知来源'}`)
  url.value = null
}
</script>

<style lang="less" scoped>
.lcu-image {
  display: block;
}

.lcu-image-placeholder {
  border: 1px solid #fff2;
  background-color: #0006;
  border-radius: 4px;
  box-sizing: border-box;
}
</style>
