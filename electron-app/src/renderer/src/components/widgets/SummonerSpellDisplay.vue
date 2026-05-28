<template>
  <LcuImage
    v-if="spellId && gds.summonerSpells[spellId]"
    :src="gds.summonerSpells[spellId].iconPath"
    :size="size"
    class="spell"
    :title="gds.summonerSpells[spellId].name"
  />
  <div v-else class="empty" :style="{ width: size + 'px', height: size + 'px' }"></div>
</template>

<script setup lang="ts">
/** 召唤师技能图标 —— 从 game data store 获取 iconPath
 *  对应 LeagueAkari 的 SummonerSpellDisplay.vue（简化版，无 Popover） */
import { useGameDataStore } from '../../stores/game-data'
import LcuImage from './LcuImage.vue'

const { spellId, size = 22 } = defineProps<{
  spellId?: number
  size?: number
}>()

const gds = useGameDataStore()
</script>

<style lang="less" scoped>
.spell {
  border-radius: 2px;
}

.empty {
  border-radius: 2px;
  background-color: rgb(34, 34, 34);
}
</style>
