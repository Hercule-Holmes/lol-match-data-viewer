<template>
  <LcuImage
    v-if="augmentId && gds.augments[augmentId]"
    :src="gds.augments[augmentId].augmentSmallIconPath"
    :size="size"
    class="augment-icon"
    :class="rarityClass"
    :title="gds.augments[augmentId].nameTRA"
  />
  <div v-else class="augment-empty" :style="{ width: size + 'px', height: size + 'px' }"></div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useGameDataStore } from '../../stores/game-data'
import LcuImage from './LcuImage.vue'

const { augmentId, size = 22 } = defineProps<{
  augmentId?: number
  size?: number
}>()

const gds = useGameDataStore()

const rarityClass = computed(() => {
  if (!augmentId || !gds.augments[augmentId]) return ''
  const r = gds.augments[augmentId].rarity
  return {
    kPrismatic: 'rarity-prismatic',
    kGold: 'rarity-gold',
    kSilver: 'rarity-silver',
    kBronze: 'rarity-bronze',
  }[r] || ''
})
</script>

<style lang="less" scoped>
.augment-icon {
  border-radius: 2px;
  box-sizing: border-box;

  &.rarity-prismatic {
    border: 1px solid #b453cf;
    background-color: rgb(45, 37, 66);
  }
  &.rarity-gold {
    border: 1px solid rgb(255, 183, 0);
    background-color: rgb(50, 37, 5);
  }
  &.rarity-silver {
    border: 1px solid rgb(180, 180, 180);
    background-color: rgb(35, 35, 34);
  }
  &.rarity-bronze {
    border: 1px solid rgb(139, 69, 19);
    background-color: rgb(35, 35, 34);
  }
}

.augment-empty {
  background-color: rgb(34, 34, 34);
  border-radius: 2px;
}
</style>
