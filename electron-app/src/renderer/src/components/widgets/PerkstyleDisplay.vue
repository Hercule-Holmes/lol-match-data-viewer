<template>
  <LcuImage
    v-if="perkstyleId && gds.perkstyles.styles[perkstyleId]"
    :src="gds.perkstyles.styles[perkstyleId].iconPath"
    :size="size"
    class="perkstyle"
    :title="gds.perkstyles.styles[perkstyleId].name"
  />
  <div v-else class="empty" :style="{ width: size + 'px', height: size + 'px' }"></div>
</template>

<script setup lang="ts">
/** 符文系风格图标 —— 从 game data store 获取 iconPath
 *  对应 LeagueAkari 的 PerkstyleDisplay.vue（简化版，无 Popover） */
import { useGameDataStore } from '../../stores/game-data'
import LcuImage from './LcuImage.vue'

const { perkstyleId, size = 22 } = defineProps<{
  perkstyleId?: number
  size?: number
}>()

const gds = useGameDataStore()
</script>

<style lang="less" scoped>
.perkstyle,
.empty {
  border-radius: 2px;
}

.empty {
  background-color: rgb(34, 34, 34);
}
</style>
