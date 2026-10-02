'use client'

import { GoogleAnalytics } from '@next/third-parties/google'
import { WebVitals } from '@/lib/axiom/client'
import { NEXT_PUBLIC_GA_ID } from '@/lib/env/env'
import { PostHogTracker } from './posthog-tracker'
import { useCookieConsent } from './provider'

// Monta as integrações de analytics (web vitals do Axiom, PostHog, Google
// Analytics) somente quando o usuário aceitou explicitamente. Recusado ou
// indeciso mantém o DOM limpo — nenhuma delas carrega script, e o chunk do
// SDK do PostHog não é nem buscado.
//
// `@vercel/analytics` e `@vercel/speed-insights` saíram daqui: os beacons dos
// dois postam em `/_vercel/insights/*` e `/_vercel/speed-insights/*`, caminhos
// que só existem num deploy na Vercel — aqui respondiam 307 para `/sign-in`,
// ou seja, nunca coletaram nada. Web vitals continuam no Axiom.
//
// Rastreamento de erro não está aqui de propósito: o Sentry não carrega
// identidade de analytics e é gated por `NEXT_PUBLIC_SENTRY_DSN`, não por
// consentimento (ver `instrumentation-client.ts`).

export function ConsentedTrackers() {
  const { consent, userId } = useCookieConsent()
  if (consent !== 'accepted') return null
  return (
    <>
      <WebVitals />
      <PostHogTracker userId={userId} />
      {NEXT_PUBLIC_GA_ID && <GoogleAnalytics gaId={NEXT_PUBLIC_GA_ID} />}
    </>
  )
}
