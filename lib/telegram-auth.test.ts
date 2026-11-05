import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { limitTelegramMutation } from './telegram-auth'

describe('Telegram mutation rate limit', () => {
  it('cannot be bypassed by changing forwarded IP headers', () => {
    const userId = 985431
    for (let i = 0; i < 30; i++) {
      const request = new Request('https://example.com', { headers: { 'x-real-ip': `192.0.2.${i}` } })
      expect(limitTelegramMutation(request, userId)).toBeNull()
    }
    const request = new Request('https://example.com', { headers: { 'x-real-ip': '192.0.2.31' } })
    expect(limitTelegramMutation(request, userId)?.status).toBe(429)
  })
})
