<template>
  <div class="sidebar-fixed">
    <!-- LCU 连接状态图标 -->
    <NPopover placement="right-end" :duration="250">
      <template #trigger>
        <div class="menu-item">
          <div class="menu-item-inner">
            <NIcon v-if="connStatus === 'connected'" class="menu-item-icon conn-ok">
              <CheckmarkCircleOutline />
            </NIcon>
            <NIcon v-else-if="connStatus === 'loading'" class="menu-item-icon conn-loading">
              <SyncOutline />
            </NIcon>
            <NBadge v-else dot :show="true">
              <NIcon class="menu-item-icon conn-err">
                <CloseCircleOutline />
              </NIcon>
            </NBadge>
          </div>
        </div>
      </template>
      <div class="conn-popover">
        <div v-if="connStatus === 'connected'" class="conn-text ok">
          已连接 ({{ connRegion }})
        </div>
        <div v-else-if="connStatus === 'loading'" class="conn-text loading">检测中...</div>
        <div v-else class="conn-text err">未连接 LCU</div>
      </div>
    </NPopover>

    <!-- 设置按钮 -->
    <NTooltip placement="right">
      <template #trigger>
        <div class="menu-item">
          <div class="menu-item-inner">
            <NIcon class="menu-item-icon"><SettingsOutline /></NIcon>
          </div>
        </div>
      </template>
      <span class="simple-popover">设置</span>
    </NTooltip>
  </div>
</template>

<script setup lang="ts">
import { NBadge, NIcon, NPopover, NTooltip } from 'naive-ui'
import {
  CheckmarkCircleOutline,
  CloseCircleOutline,
  SettingsOutline,
  SyncOutline
} from '@vicons/ionicons5'

defineProps<{
  connStatus: 'connected' | 'loading' | 'disconnected'
  connRegion: string
}>()
</script>

<style lang="less" scoped>
.sidebar-fixed {
  display: flex;
  flex-direction: column;
}

.menu-item {
  display: flex;
  position: relative;
  justify-content: center;
  align-items: center;
  height: 52px;
  width: 52px;
  padding: 2px;
  box-sizing: border-box;
  cursor: pointer;

  .menu-item-inner {
    position: relative;
    display: flex;
    justify-content: center;
    align-items: center;
    height: 72%;
    width: 72%;
    border-radius: 2px;
  }

  .menu-item-icon {
    font-size: 24px;
    transition: color 0.2s;
  }

  .conn-ok {
    color: #26dd0e;
  }

  .conn-loading {
    color: #f0a020;
    animation: spin 1.5s linear infinite;
  }

  .conn-err {
    color: rgba(255, 255, 255, 0.4);
  }
}

[data-theme='dark'] {
  .menu-item {
    &:hover .menu-item-icon {
      color: #fff;
    }
    .menu-item-icon {
      color: rgba(255, 255, 255, 0.8);
    }
  }
}

.conn-popover {
  font-size: 12px;

  .conn-text {
    font-weight: bold;
  }
  .ok {
    color: #26dd0e;
  }
  .loading {
    color: #f0a020;
  }
  .err {
    color: rgba(255, 255, 255, 0.5);
  }
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
