<template>
  <div class="match-list-page">
    <TabBar />
    <div class="tab-content">
      <KeepAlive :max="10">
        <PlayerGamesList
          v-for="tab in tabs"
          v-show="tab.id === activeTabId"
          :key="tab.id"
          :puuid="tab.puuid"
          :name="tab.name"
          :profile-icon-id="tab.profileIconId"
          :summoner-level="tab.summonerLevel"
        />
      </KeepAlive>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useTabStore } from '@/stores/tab'
import { useGameDataStore } from '@/stores/game-data'
import { summonerDisplayName } from '@shared/types'
import TabBar from '@/components/sidebar/TabBar.vue'
import PlayerGamesList from './PlayerGamesList.vue'

const tabStore = useTabStore()
const gds = useGameDataStore()
const { tabs, activeTabId } = storeToRefs(tabStore)

onMounted(async () => {
  tabStore.ensureDefaultTab()

  if (typeof window.lcuApi === 'undefined') return
  try {
    const conn = await window.lcuApi.checkConnection()
    if (conn) {
      // 获取当前召唤师信息并更新默认标签
      try {
        const s = await window.lcuApi.getCurrentSummoner()
        tabStore.updateDefaultTab(s.puuid, summonerDisplayName(s), s.profileIconId, s.summonerLevel)
      } catch { /* 获取失败则在 PlayerGamesList 中展示等待连接状态 */ }
      if (!gds.isLoaded) {
        await gds.fetchGameData()
      }
    }
  } catch { /* lcuApi 不可用 */ }
})
</script>

<style lang="less" scoped>
.match-list-page {
  height: 100%;
  display: flex;
  flex-direction: column;
  background-color: var(--bg-primary);
}

.tab-content {
  flex: 1;
  min-height: 0;
}
</style>
