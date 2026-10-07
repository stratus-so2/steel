'use client'

import { useSyncExternalStore } from 'react'

/** Mesmo corte do `lg:` do Tailwind (64rem). */
export const SD_DESKTOP_QUERY = '(min-width: 1024px)'

function subscribe(onChange: () => void): () => void {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {}
  const mql = window.matchMedia(SD_DESKTOP_QUERY)
  mql.addEventListener('change', onChange)
  return () => mql.removeEventListener('change', onChange)
}

function snapshot(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return true
  return window.matchMedia(SD_DESKTOP_QUERY).matches
}

/**
 * `true` a partir de `lg`: a tela do chamado mostra os detalhes na coluna
 * lateral; abaixo disso eles vão para o Sheet "Detalhes". Só um dos dois
 * fica montado (os campos têm `id` próprio). Sem `matchMedia` (servidor,
 * jsdom) vale o layout de mesa.
 */
export function useSdIsDesktop(): boolean {
  return useSyncExternalStore(subscribe, snapshot, () => true)
}
