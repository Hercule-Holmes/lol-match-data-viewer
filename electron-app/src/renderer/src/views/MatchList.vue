<template>
  <div class="match-list-page">
    <TabBar />
    <div class="tab-content">
      <KeepAlive :max="10">
        <PlayerGamesList
          v-for="tab in tabs"
          v-show="tab.id === activeTabId"
          :key="tab.id"
          :tab-id="tab.id"
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
import { computed, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useTabStore } from '@/stores/tab'
import { useGameDataStore } from '@/stores/game-data'
import { summonerDisplayName } from '@shared/types'
import { initializeSession } from '@application/connection-service'
import { createSessionRepository } from '@application/ports'
import TabBar from '@/components/sidebar/TabBar.vue'
import PlayerGamesList from './PlayerGamesList.vue'
const tabStore = useTabStore()
const gds = useGameDataStore()
const { tabs, activeTabId } = storeToRefs(tabStore)
const activeTab = computed(() => tabs.value.find(t => t.id === activeTabId.value))

onMounted(async () => {
  tabStore.ensureDefaultTab()

  if (typeof window.lcuApi === 'undefined') return
  const conn = await window.lcuApi.checkConnection()
  const { connected, summoner } = await initializeSession(createSessionRepository(window.lcuApi))
  if (connected && summoner) {
    tabStore.updateDefaultTab(summoner.puuid, summonerDisplayName(summoner), summoner.profileIconId, summoner.summonerLevel)
    // Init SGP first — must be ready before match history loads (otherwise
    // the first fetch races ahead and falls through to LCU).
    // Token fetch is a single local LCU call, <100ms typical.
    const platform = conn?.rsoPlatformId || ''
    if (platform) {
      await window.lcuApi.sgpInit(platform).then(ok => {
        console.log(ok ? '[APP] SGP ready' : '[APP] SGP unavailable, using LCU')
      }).catch((err: unknown) => console.warn('[APP] SGP init failed:', err))
    }
    if (!gds.isLoaded) {
      await gds.fetchGameData()
    }
  }
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
