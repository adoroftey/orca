import { translate } from '@/i18n/i18n'

export function itsaplanErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : translate('itsaplan.error.request', "The It's a Plan request failed.")
}

export function readItsaplanProject(hostKey: string, baseUrl: string): string | null {
  try {
    return localStorage.getItem(JSON.stringify(['itsaplan-project', hostKey, baseUrl]))
  } catch {
    return null
  }
}

export function saveItsaplanProject(hostKey: string, baseUrl: string, projectRef: string): void {
  try {
    localStorage.setItem(JSON.stringify(['itsaplan-project', hostKey, baseUrl]), projectRef)
  } catch {
    /* Storage can be disabled in browser clients. */
  }
}
