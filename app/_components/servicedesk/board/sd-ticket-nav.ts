/**
 * The ticket list on screen, remembered so J/K inside a ticket walk the
 * same list the agent came from (and U goes back to it). Per tab
 * (`sessionStorage`); without storage the shortcuts just do nothing.
 */
const KEY = 'steel:sd-ticket-nav'

export type SdTicketNav = { from: string; hrefs: string[] }

export function sdRememberTicketList(container: HTMLElement | null) {
  if (!container) return
  const hrefs = [
    ...container.querySelectorAll<HTMLElement>('[data-shortcut-href]'),
  ]
    .map((row) => row.dataset.shortcutHref ?? '')
    .filter(Boolean)
  if (hrefs.length === 0) return
  const nav: SdTicketNav = {
    from: `${window.location.pathname}${window.location.search}`,
    hrefs: [...new Set(hrefs)],
  }
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(nav))
  } catch {
    // Blocked storage: J/K in the ticket just do nothing.
  }
}

export function sdReadTicketNav(): SdTicketNav | null {
  try {
    const parsed: unknown = JSON.parse(
      window.sessionStorage.getItem(KEY) ?? 'null',
    )
    if (
      parsed &&
      typeof parsed === 'object' &&
      typeof (parsed as SdTicketNav).from === 'string' &&
      Array.isArray((parsed as SdTicketNav).hrefs)
    ) {
      return parsed as SdTicketNav
    }
  } catch {
    // Corrupt or blocked storage.
  }
  return null
}

/** The neighbour of `current` in the remembered list, if any. */
export function sdNeighbourTicket(
  nav: SdTicketNav | null,
  current: string,
  delta: 1 | -1,
): string | null {
  if (!nav) return null
  const index = nav.hrefs.indexOf(current)
  if (index < 0) return null
  return nav.hrefs[index + delta] ?? null
}
