export function updateQuery(params: Record<string, string | null | undefined>): string {
  const search = new URLSearchParams(window.location.search)
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined || value === '') search.delete(key)
    else search.set(key, value)
  }
  const query = search.toString()
  return `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`
}
