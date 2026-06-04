/**
 * DeepSeek API 客户端（chat completions）
 * Key 优先级：用户设置 > .env 环境变量 > 报错提示
 */
import axios from 'axios'
import { getSettings } from './settings'

const DEEPSEEK_BASE_URL = 'https://api.deepseek.com'

interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

/** 获取 API Key：优先用户自定义 → .env → 无 Key 报错 */
function getApiKey(): string {
  const settings = getSettings()
  return settings.deepseekApiKey || process.env.DEEPSEEK_API_KEY || ''
}

/**
 * 发送多轮对话请求到 DeepSeek
 * @param messages 完整的消息历史（含 system + user + assistant）
 * @returns AI 回复文本
 */
export async function chatWithLLM(messages: ChatMessage[]): Promise<string> {
  const apiKey = getApiKey()
  if (!apiKey) {
    throw new Error(
      'API Key 未配置。请在设置中配置 DeepSeek API Key，' +
      '或前往 https://platform.deepseek.com/api_keys 获取'
    )
  }

  const resp = await axios.post(
    `${DEEPSEEK_BASE_URL}/v1/chat/completions`,
    {
      model: 'deepseek-chat',
      messages,
      temperature: 0.7,
      max_tokens: 4096,
    },
    {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      timeout: 120000,
    }
  )

  const choice = resp.data?.choices?.[0]
  if (!choice?.message?.content) {
    throw new Error(`DeepSeek API 返回异常: ${JSON.stringify(resp.data)}`)
  }

  return choice.message.content
}
