/**
 * 用户设置管理
 * 存储在 {userData}/settings.json，启动时读取默认值
 */
import { app } from 'electron'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'

const SETTINGS_FILE = 'settings.json'

interface UserSettings {
  autoUpdate: boolean
}

let _cache: UserSettings | null = null

function getFilePath(): string {
  const dir = app.getPath('userData')
  const path = join(dir, SETTINGS_FILE)
  // 确保目录存在
  const parentDir = join(path, '..')
  if (!existsSync(parentDir)) {
    mkdirSync(parentDir, { recursive: true })
  }
  return path
}

export function getSettings(): UserSettings {
  if (_cache) return _cache
  try {
    const filePath = getFilePath()
    if (existsSync(filePath)) {
      const raw = readFileSync(filePath, 'utf-8')
      _cache = JSON.parse(raw)
    }
  } catch (err) {
    console.warn(`[SETTINGS] 读取配置文件失败: ${err}`)
  }
  if (!_cache) {
    _cache = { autoUpdate: true }
    saveSettings()
  }
  return _cache
}

export function setSetting<K extends keyof UserSettings>(key: K, value: UserSettings[K]): void {
  const settings = getSettings()
  settings[key] = value
  saveSettings()
}

function saveSettings(): void {
  try {
    const filePath = getFilePath()
    writeFileSync(filePath, JSON.stringify(_cache, null, 2), 'utf-8')
  } catch (err) {
    console.error(`[SETTINGS] 保存配置文件失败: ${err}`)
  }
}
