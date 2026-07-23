'use client'

import * as React from 'react'

/** id de sessão estável por visita (mesma aba ⇒ mesmo upsert no servidor). */
function getViewId(token: string): string {
  const key = `crm-proposal-view:${token}`
  try {
    const existing = sessionStorage.getItem(key)
    if (existing) return existing
    const id = crypto.randomUUID()
    sessionStorage.setItem(key, id)
    return id
  } catch {
    return crypto.randomUUID()
  }
}

/**
 * Coleta métricas de leitura da página pública e envia ao endpoint
 * `/api/crm/proposals/<token>/view` via `sendBeacon`. Mede tempo ativo (só
 * com a aba visível), profundidade de scroll e se o visitante chegou ao fim
 * (o próprio elemento serve de sentinela do fim do documento).
 */
export function ProposalTracker({ token }: { token: string }) {
  const sentinelRef = React.useRef<HTMLDivElement | null>(null)

  React.useEffect(() => {
    const viewId = getViewId(token)
    const url = `/api/crm/proposals/${token}/view`

    let activeMs = 0
    let lastTick = Date.now()
    let reachedEnd = false
    let maxScroll = 0

    const isVisible = () => document.visibilityState === 'visible'

    const accrue = () => {
      const now = Date.now()
      if (isVisible()) activeMs += now - lastTick
      lastTick = now
    }

    const computeScroll = () => {
      const scrollable =
        document.documentElement.scrollHeight - window.innerHeight
      const pct =
        scrollable <= 0 ? 100 : Math.round((window.scrollY / scrollable) * 100)
      maxScroll = Math.min(100, Math.max(maxScroll, pct))
    }

    const send = () => {
      accrue()
      const body = JSON.stringify({
        viewId,
        durationMs: Math.round(activeMs),
        reachedEnd,
        scrolledPct: maxScroll,
      })
      try {
        if (navigator.sendBeacon) {
          navigator.sendBeacon(
            url,
            new Blob([body], { type: 'application/json' }),
          )
          return
        }
      } catch {
        // cai no fetch keepalive abaixo
      }
      void fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true,
      }).catch(() => {})
    }

    computeScroll()
    send() // registra a visita já na abertura (durationMs 0)

    const tick = setInterval(accrue, 1000)
    const beacon = setInterval(send, 15000)

    const onScroll = () => computeScroll()
    const onVisibility = () => {
      accrue()
      if (!isVisible()) send()
    }
    const onPageHide = () => send()

    window.addEventListener('scroll', onScroll, { passive: true })
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pagehide', onPageHide)

    let observer: IntersectionObserver | null = null
    if (sentinelRef.current) {
      observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              reachedEnd = true
              maxScroll = 100
            }
          }
        },
        { threshold: 0.5 },
      )
      observer.observe(sentinelRef.current)
    }

    return () => {
      send()
      clearInterval(tick)
      clearInterval(beacon)
      window.removeEventListener('scroll', onScroll)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pagehide', onPageHide)
      observer?.disconnect()
    }
  }, [token])

  return <div ref={sentinelRef} aria-hidden className='h-px w-full' />
}
