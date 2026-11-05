import { describe, expect, it } from 'vitest'
import { getRoleFromStatus } from './telegram-api'

describe('Telegram chat membership', () => {
  it('accepts a restricted user only when Telegram confirms membership', () => {
    expect(getRoleFromStatus('restricted', true)).toBe('member')
    expect(getRoleFromStatus('restricted', false)).toBe('left')
    expect(getRoleFromStatus('restricted')).toBe('left')
  })

  it('rejects unknown statuses and preserves known roles', () => {
    expect(getRoleFromStatus('unexpected')).toBe('left')
    expect(getRoleFromStatus('administrator')).toBe('administrator')
    expect(getRoleFromStatus('member')).toBe('member')
  })
})
