/** 简易文件日志系统
 *  将所有 [LCU:*] 日志写入应用数据目录下的 logs 文件夹
 *  对标 LeagueAkari 的 LoggerFactory 文件日志能力 */

import fs from 'node:fs'
import path from 'node:path'
import { app } from 'electron'

const LOG_DIR = path.join(app.getPath('userData'), 'logs')

let _logFile: string | null = null
let _stream: fs.WriteStream | null = null
let _initialized = false

function timestamp(): string {
  return new Date().toISOString().replace('T', ' ').slice(0, 23)
}

function ensureDir() {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true })
  }
}

function init() {
  if (_initialized) return
  ensureDir()
  const d = new Date()
  const date = d.toISOString().slice(0, 10) // 2026-05-28
  const time = d.toISOString().slice(11, 19).replace(/:/g, '-') // 08-14-05
  _logFile = path.join(LOG_DIR, `main-${date}T${time}.log`)
  _stream = fs.createWriteStream(_logFile, { flags: 'a' })
  _initialized = true
  write('SYSTEM', `日志文件: ${_logFile}`)
}

function write(tag: string, message: string) {
  const line = `[${timestamp()}] [${tag}] ${message}\n`

  // 仍然输出到控制台
  if (tag.includes('ERROR') || tag.includes('WARN')) {
    process.stderr.write(line)
  } else {
    process.stdout.write(line)
  }

  // 写入文件
  if (_stream) {
    _stream.write(line)
  }
}

/** 提供与 console.log 兼容的接口 */
export const logger = {
  init,

  info(tag: string, message: string) {
    if (!_initialized) init()
    write(tag, message)
  },

  warn(tag: string, message: string) {
    if (!_initialized) init()
    write(`${tag}:WARN`, message)
  },

  error(tag: string, message: string) {
    if (!_initialized) init()
    write(`${tag}:ERROR`, message)
  },

  /** 渲染进程发来的日志 */
  renderer(level: string, tag: string, message: string) {
    if (!_initialized) init()
    write(`${tag}`, message)
  },

  get logDir() {
    return LOG_DIR
  },

  get logFile() {
    return _logFile
  },

  close() {
    if (_stream) {
      _stream.end()
      _stream = null
    }
  },
}
