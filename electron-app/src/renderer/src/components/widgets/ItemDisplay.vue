<template>
  <LcuImage
    v-if="itemId && gds.items[itemId]"
    :src="gds.items[itemId].iconPath"
    :size="size"
    class="item-icon"
    :class="{ trinket: isTrinket }"
    :title="gds.items[itemId].name"
  />
  <div v-else class="empty" :class="{ trinket: isTrinket }" :style="{ width: size + 'px', height: size + 'px' }"></div>
</template>

<script setup lang="ts">
/** 装备图标 —— 从 game data store 获取 iconPath
 *  对应 LeagueAkari 的 ItemDisplay.vue（简化版，无 Popover 详情） */
import { useGameDataStore } from '../../stores/game-data'
import LcuImage from './LcuImage.vue'

const { itemId, isTrinket = false, size = 22 } = defineProps<{
  itemId?: number
  isTrinket?: boolean
  size?: number
}>()

const gds = useGameDataStore()
</script>

<style lang="less" scoped>
.item-icon.trinket,
.trinket.empty {
  border-radius: 50%;
}

.item-icon,
.item-icon.empty {
  border-radius: 2px;
}

.empty {
  background-color: rgb(34, 34, 34);
}
</style>
