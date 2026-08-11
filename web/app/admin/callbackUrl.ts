export interface CallbackUrlSelectionInput {
  expectedOrigin: string
  expectedPath: string
  currentHref: unknown
  navigationEntryNames: readonly unknown[]
}

function validCallbackUrl(value: unknown, expectedOrigin: string, expectedPath: string): value is string {
  if (typeof value !== 'string' || !value) return false
  let url: URL
  try { url = new URL(value) } catch { return false }
  if (url.origin !== expectedOrigin || url.pathname !== expectedPath || url.hash || url.username || url.password) return false
  const counts = { state: 0, code: 0, error: 0 }
  const nonEmpty = { state: true, code: true, error: true }
  for (const pair of url.search.slice(1).split('&')) {
    const separator = pair.indexOf('='); const key = separator < 0 ? pair : pair.slice(0, separator)
    if (!(key in counts)) continue
    const name = key as keyof typeof counts; counts[name] += 1
    if (separator < 0 || pair.slice(separator + 1).length === 0) nonEmpty[name] = false
  }
  if (counts.state !== 1 || !nonEmpty.state) return false
  if (counts.code + counts.error !== 1 || (counts.code > 0 && !nonEmpty.code) || (counts.error > 0 && !nonEmpty.error)) return false
  return true
}

export function selectCallbackUrl({ expectedOrigin, expectedPath, currentHref, navigationEntryNames }: CallbackUrlSelectionInput): string | undefined {
  if (typeof expectedOrigin !== 'string' || typeof expectedPath !== 'string' || !Array.isArray(navigationEntryNames)) return undefined
  if (validCallbackUrl(currentHref, expectedOrigin, expectedPath)) return currentHref
  const validEntries = navigationEntryNames.filter((entry): entry is string => validCallbackUrl(entry, expectedOrigin, expectedPath))
  return validEntries.length === 1 ? validEntries[0] : undefined
}

export function captureCallbackUrl(expectedOrigin: string, expectedPath: string, currentHref: string, navigationEntries: readonly PerformanceNavigationTiming[] = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[]): string | undefined {
  return selectCallbackUrl({ expectedOrigin, expectedPath, currentHref, navigationEntryNames: navigationEntries.map((entry) => entry.name) })
}
