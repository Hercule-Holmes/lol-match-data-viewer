<template>
  <LcuImage
    v-if="perkId && gds.perks[perkId]"
    :src="gds.perks[perkId].iconPath"
    :size="size"
    class="perk"
    :title="gds.perks[perkId].name"
  />
  <div v-else class="empty" :style="{ width: size + 'px', height: size + 'px' }"></div>
</template>

<script setup lang="ts">
/** 符文图标 —— 从 game data store 获取 iconPath
 *  对应 LeagueAkari 的 PerkDisplay.vue（简化版，无 Popover） */
import { useGameDataStore } from '../../stores/game-data'
import LcuImage from './LcuImage.vue'

const { perkId, size = 22 } = defineProps<{
  perkId?: number
  size?: number
}>()

const gds = useGameDataStore()
</script>

<style lang="less" scoped>
.perk,
.empty {
  border-radius: 2px;
}

.empty {
  background-color: rgb(34, 34, 34);
}
</style>
