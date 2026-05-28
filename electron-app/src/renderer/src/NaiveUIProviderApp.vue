<template>
  <NConfigProvider
    :theme-overrides="themeOverrides"
    :theme="darkTheme"
    :locale="zhCN"
    :date-locale="dateZhCN"
    abstract
    inline-theme-disabled
  >
    <NMessageProvider
      :container-style="{ top: 'calc(var(--title-bar-height) + 12px)' }"
      placement="top-right"
    >
      <NNotificationProvider placement="bottom-right">
        <NDialogProvider>
          <App />
        </NDialogProvider>
      </NNotificationProvider>
    </NMessageProvider>
  </NConfigProvider>
</template>

<script setup lang="ts">
import {
  NConfigProvider,
  NDialogProvider,
  NMessageProvider,
  NNotificationProvider,
  darkTheme,
  dateZhCN,
  zhCN,
  type GlobalThemeOverrides
} from 'naive-ui'

import App from './App.vue'

/** Naive UI 暗色主题微调 */
const themeOverrides: GlobalThemeOverrides = {
  Notification: {
    padding: '12px',
    color: '#313131fa'
  },
  Popover: {
    color: '#1f1f1ffa',
    fontSize: '12px'
  },
  Card: {
    colorModal: '#232329'
  },
  Message: {
    colorInfo: 'rgba(45, 45, 55, 1)',
    colorSuccess: 'rgba(45, 45, 55, 1)',
    colorWarning: 'rgba(45, 45, 55, 1)',
    colorError: 'rgba(45, 45, 55, 1)'
  },
  Menu: {
    padding: '1px'
  }
}
</script>
