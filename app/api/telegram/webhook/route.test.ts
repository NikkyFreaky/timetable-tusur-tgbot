import { beforeEach, describe, expect, it, vi } from 'vitest'

const store = vi.hoisted(() => ({
  claim: vi.fn(), complete: vi.fn(), release: vi.fn(), send: vi.fn(),
}))
vi.mock('@/lib/telegram-update-store', () => ({
  claimTelegramUpdate: store.claim,
  completeTelegramUpdate: store.complete,
  releaseTelegramUpdate: store.release,
}))
vi.mock('@/lib/telegram-bot', () => ({
  buildWebAppKeyboard: vi.fn(), buildUrlKeyboard: vi.fn(), sendTelegramMessage: store.send,
}))
vi.mock('@/lib/telegram-api', () => ({}))
vi.mock('@/lib/chat-store', () => ({}))
vi.mock('@/lib/user-store', () => ({}))
vi.mock('@/lib/bot-message-templates', () => ({ getBotMessageTemplate: vi.fn().mockResolvedValue('test') }))
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: () => ({ allowed: true }), getClientAddress: () => 'test',
}))

import { POST } from './route'

function request(body: object) {
  return new Request('http://localhost/api/telegram/webhook', {
    method: 'POST',
    headers: { 'x-telegram-bot-api-secret-token': 'secret', 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('Telegram webhook retry handling', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.BOT_TOKEN = 'test'
    process.env.TELEGRAM_WEBHOOK_SECRET = 'secret'
    process.env.WEBAPP_URL = 'https://example.com'
    process.env.MINI_APP_URL = 'https://example.com'
    store.complete.mockResolvedValue(undefined)
    store.release.mockResolvedValue(undefined)
  })

  it('acknowledges a completed update without handling it again', async () => {
    store.claim.mockResolvedValue({ state: 'completed' })
    const response = await POST(request({ update_id: 42, message: { chat: { id: 1 }, text: '/start' } }))
    expect(response.status).toBe(200)
    expect(store.send).not.toHaveBeenCalled()
  })

  it('releases a failed update and returns a retryable error', async () => {
    store.claim.mockResolvedValue({ state: 'claimed', token: 'claim' })
    store.send.mockRejectedValue(new Error('temporary failure'))
    const response = await POST(request({
      update_id: 43, message: { chat: { id: 1, type: 'private' }, text: '/start' },
    }))
    expect(response.status).toBe(500)
    expect(store.release).toHaveBeenCalledWith(43, 'claim')
    expect(store.complete).not.toHaveBeenCalled()
  })
})
