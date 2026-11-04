import { describe, expect, it } from 'vitest'
import { date } from './dashboard-dates'

describe('dashboard date formatting', () => {
  it('preserves calendar dates regardless of the account timezone', () => {
    expect(date('2026-11-03', 'Pacific/Honolulu')).toBe(
      new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeZone: 'UTC' }).format(
        new Date('2026-11-03T00:00:00Z')
      )
    )
  })
  it('formats timestamps in the account timezone and tolerates invalid input', () => {
    expect(date('2026-11-03T23:30:00Z', 'Asia/Nicosia')).toBe(
      new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeZone: 'Asia/Nicosia' }).format(
        new Date('2026-11-03T23:30:00Z')
      )
    )
    expect(date('invalid', 'invalid/timezone')).toBe('invalid')
    expect(() => date('2026-11-03T23:30:00Z', 'invalid/timezone')).not.toThrow()
  })
})
