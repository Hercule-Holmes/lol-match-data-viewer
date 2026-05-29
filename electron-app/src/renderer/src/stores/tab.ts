import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export interface PlayerTab {
  id: string
  puuid: string
  name: string
  profileIconId: number
  summonerLevel: number
}

export const useTabStore = defineStore('tab', () => {
  const tabs = ref<PlayerTab[]>([])
  const activeTabId = ref<string>('default')

  const activeTab = computed(() =>
    tabs.value.find(t => t.id === activeTabId.value) || null
  )

  /** 确保默认标签存在 */
  function ensureDefaultTab() {
    if (tabs.value.length === 0) {
      tabs.value.push({
        id: 'default',
        puuid: '',
        name: '',
        profileIconId: 0,
        summonerLevel: 0,
      })
    }
  }

  /** 更新默认标签信息（获取到当前召唤师数据后调用） */
  function updateDefaultTab(puuid: string, name: string, profileIconId: number, level: number) {
    const tab = tabs.value.find(t => t.id === 'default')
    if (tab) {
      tab.puuid = puuid
      tab.name = name
      tab.profileIconId = profileIconId
      tab.summonerLevel = level
    }
  }

  /** 打开或切换到指定玩家的标签 */
  function openTab(puuid: string, name: string, profileIconId: number, level: number) {
    if (!puuid) return
    const existing = tabs.value.find(t => t.puuid === puuid)
    if (existing) {
      existing.name = name
      existing.profileIconId = profileIconId
      existing.summonerLevel = level
      activeTabId.value = existing.id
      return
    }
    const id = `player-${puuid.slice(0, 16)}`
    tabs.value.push({ id, puuid, name, profileIconId, summonerLevel: level })
    activeTabId.value = id
  }

  /** 关闭标签 */
  function closeTab(id: string) {
    if (id === 'default') return
    const idx = tabs.value.findIndex(t => t.id === id)
    if (idx === -1) return
    tabs.value.splice(idx, 1)
    if (activeTabId.value === id) {
      activeTabId.value = tabs.value[Math.min(idx, tabs.value.length - 1)]?.id || 'default'
    }
  }

  /** 切换到指定标签 */
  function setActive(id: string) {
    if (tabs.value.some(t => t.id === id)) {
      activeTabId.value = id
    }
  }

  return {
    tabs,
    activeTabId,
    activeTab,
    ensureDefaultTab,
    updateDefaultTab,
    openTab,
    closeTab,
    setActive,
  }
})
