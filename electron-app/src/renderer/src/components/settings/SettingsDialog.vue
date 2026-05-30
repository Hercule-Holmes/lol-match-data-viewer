<template>
  <n-modal
    :show="show"
    preset="card"
    title="设置"
    style="width: 420px"
    :bordered="false"
    size="huge"
    @update:show="(v: boolean) => !v && $emit('close')"
  >
    <div class="settings-body">
      <!-- 自动更新 -->
      <div class="setting-row">
        <div class="setting-label">
          <span class="setting-title">自动更新</span>
          <span class="setting-desc">启动时自动检查并下载新版本</span>
        </div>
        <n-switch :value="autoUpdate" @update:value="onAutoUpdateToggle" />
      </div>

      <n-divider />

      <!-- 打开日志目录 -->
      <div class="setting-row">
        <div class="setting-label">
          <span class="setting-title">日志文件</span>
          <span class="setting-desc">打开应用日志所在目录</span>
        </div>
        <n-button size="small" @click="openLogs">打开</n-button>
      </div>

      <n-divider />

      <!-- 关于 -->
      <div class="about-section">
        <span class="setting-title">关于</span>
        <div class="about-info">
          <div class="about-row">
            <span class="about-key">版本</span>
            <span class="about-value">v{{ appVersion }}</span>
          </div>
          <div class="about-row">
            <span class="about-key">项目</span>
            <n-a
              href="https://github.com/aqq2567/lol-match-data-viewer"
              target="_blank"
            >
              GitHub
            </n-a>
          </div>
        </div>
      </div>
    </div>
  </n-modal>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { NModal, NSwitch, NButton, NDivider, NA, useMessage } from 'naive-ui'
import pkg from '../../../../../package.json'

defineProps<{
  show: boolean
}>()

const emit = defineEmits<{
  close: []
}>()

const message = useMessage()
const appVersion = pkg.version
const autoUpdate = ref(true)

onMounted(async () => {
  try {
    const settings = await window.lcuApi.getSettings()
    autoUpdate.value = settings.autoUpdate !== false
  } catch {
    // 使用默认值
  }
})

async function onAutoUpdateToggle(val: boolean) {
  autoUpdate.value = val
  try {
    await window.lcuApi.setSetting('autoUpdate', val)
    if (val) {
      // 重新开启时立即检查一次更新
      window.lcuApi.checkForUpdates().catch(() => {})
    }
  } catch (e: any) {
    message.error(`保存设置失败: ${e.message || e}`)
    autoUpdate.value = !val
  }
}

function openLogs() {
  window.lcuApi.openLogsDir().catch((e: any) => {
    message.error(`打开日志目录失败: ${e.message || e}`)
  })
}
</script>

<style lang="less" scoped>
.settings-body {
  .setting-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 4px 0;
  }

  .setting-label {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .setting-title {
    font-size: 14px;
    font-weight: 500;
    color: var(--text-primary);
  }

  .setting-desc {
    font-size: 12px;
    color: var(--text-tertiary);
  }

  .about-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .about-info {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .about-row {
    display: flex;
    align-items: center;
    gap: 12px;
    font-size: 13px;
  }

  .about-key {
    color: var(--text-tertiary);
    width: 36px;
  }

  .about-value {
    color: var(--text-secondary);
  }
}
</style>
