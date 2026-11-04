export function normalizeItsaplanBaseUrl(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) {
    return null
  }
  try {
    const url = new URL(value.trim())
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    ) {
      return null
    }
    return url.href.replace(/\/+$/, '')
  } catch {
    return null
  }
}
