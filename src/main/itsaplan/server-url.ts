export function normalizeItsaplanServerUrl(value: string): string {
  let url: URL
  try {
    url = new URL(value.trim())
  } catch {
    throw new Error('Enter a valid Itsaplan server URL.')
  }
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    !url.hostname ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new Error(
      'Itsaplan server URLs must use HTTP or HTTPS without credentials, query or fragment.'
    )
  }
  return url.href.replace(/\/+$/, '')
}
