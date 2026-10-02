'use client'

import { useEffect } from 'react'
import { loadPostHog } from '@/lib/posthog/client'

interface PostHogTrackerProps {
  /**
   * O id do usuário logado, ou `null` para visitante anônimo. É o único
   * identificador que chega ao PostHog: sem e-mail, sem nome, sem username —
   * a mesma regra que o `auditMutation` segue com `actorId`.
   */
  userId: string | null
}

/**
 * Carrega o PostHog e mantém a identidade dele em sincronia com a sessão.
 *
 * Não renderiza nada e é montado apenas pelo `<ConsentedTrackers />`, isto é,
 * só depois de o visitante aceitar cookies de análise. Sem
 * `NEXT_PUBLIC_POSTHOG_KEY` configurada, `loadPostHog()` resolve `null` e o
 * chunk do SDK nunca é buscado.
 */
export function PostHogTracker({ userId }: PostHogTrackerProps) {
  useEffect(() => {
    let cancelled = false

    void loadPostHog().then((posthog) => {
      if (cancelled || !posthog) return
      if (userId) {
        // Sem bag de propriedades: `identify(id)` sozinho liga os eventos à
        // conta sem copiar nenhum campo de perfil para o PostHog.
        if (posthog.get_distinct_id() !== userId) posthog.identify(userId)
        return
      }
      // Sair da conta tem de descartar o distinct id identificado, senão a
      // próxima pessoa neste navegador herda o perfil do usuário anterior.
      if (posthog._isIdentified()) posthog.reset()
    })

    return () => {
      cancelled = true
    }
  }, [userId])

  return null
}
