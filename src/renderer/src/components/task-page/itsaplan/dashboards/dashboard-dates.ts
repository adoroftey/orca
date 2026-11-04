import { getIntlLocale } from '@/i18n/i18n'

export function date(value: unknown, timeZone?: string): string {
  const text = typeof value === 'string' ? value : ''
  const parsed = new Date(text)
  if (!/^\d{4}-\d{2}-\d{2}/.test(text) || Number.isNaN(parsed.valueOf())) {
    return text
  }
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(text)
  if (dateOnly && parsed.toISOString().slice(0, 10) !== text) {
    return text
  }
  try {
    return new Intl.DateTimeFormat(getIntlLocale(), {
      dateStyle: 'medium',
      timeZone: dateOnly ? 'UTC' : timeZone
    }).format(parsed)
  } catch {
    return new Intl.DateTimeFormat(getIntlLocale(), { dateStyle: 'medium' }).format(parsed)
  }
}
