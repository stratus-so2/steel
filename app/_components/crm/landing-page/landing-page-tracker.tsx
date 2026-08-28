'use client'

import * as React from 'react'

/** id de sessão estável por visita (mesma aba ⇒ mesmo upsert no servidor). */
function getViewId(token: string): string {
  const key = `crm-landing-page-view:${token}`
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
 * Coleta métricas da página pública e envia ao endpoint
 * `/api/crm/landing-pages/<token>/view` via `sendBeacon`. Mede tempo ativo
 * (só com a aba visível) e cliques em CTA (`[data-cta]`, links e botões).
 */
export function LandingPageTracker({ token }: { token: string }) {
  React.useEffect(() => {
    const viewId = getViewId(token)
    const url = `/api/crm/landing-pages/${token}/view`

    let activeMs = 0
    let lastTick = Date.now()
    let ctaClicks = 0

    const isVisible = () => document.visibilityState === 'visible'

    const accrue = () => {
      const now = Date.now()
      if (isVisible()) activeMs += now - lastTick
      lastTick = now
    }

    const send = () => {
      accrue()
      const body = JSON.stringify({
        viewId,
        durationMs: Math.round(activeMs),
        ctaClicks,
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

    send() // registra a visita já na abertura (durationMs 0)

    const tick = setInterval(accrue, 1000)
    const beacon = setInterval(send, 15000)

    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null
      const el = target?.closest?.('[data-cta], a[href], button')
      if (el) {
        ctaClicks++
        send()
      }
    }
    const onVisibility = () => {
      accrue()
      if (!isVisible()) send()
    }
    const onPageHide = () => send()

    document.addEventListener('click', onClick, true)
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pagehide', onPageHide)

    return () => {
      send()
      clearInterval(tick)
      clearInterval(beacon)
      document.removeEventListener('click', onClick, true)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pagehide', onPageHide)
    }
  }, [token])

  return null
}
