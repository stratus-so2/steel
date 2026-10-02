'use client'

import type { PostHog, PostHogConfig } from 'posthog-js'
import { COOKIE_NAME, parseCookieConsent } from '@/lib/cookie-consent/types'
import { NEXT_PUBLIC_POSTHOG_HOST, NEXT_PUBLIC_POSTHOG_KEY } from '@/lib/env/env'
import { POSTHOG_PROXY_PATH } from './constants'

/**
 * Analytics de produto, carregado sob demanda e só atrás do consentimento.
 *
 * Dois portões têm de abrir antes de um único byte sair do navegador:
 *
 * 1. `NEXT_PUBLIC_POSTHOG_KEY` tem de estar definida. Sem ela,
 *    `loadPostHog()` resolve `null` e o chunk do `posthog-js` — que é um
 *    chunk lazy, listado em nenhum manifest de build — nunca é nem buscado.
 *    Dev, CI e as suítes de teste, portanto, não precisam de credencial do
 *    PostHog.
 * 2. O visitante tem de ter aceitado cookies de análise. Esse portão mora em
 *    `app/_components/user/cookie-consent/consented-trackers.tsx`, que é o
 *    único lugar que monta o `<PostHogTracker />`.
 *
 * O que ele pode coletar é deliberadamente estreito: page views, page leaves
 * e eventos que o código pede pelo nome. Sem autocapture, sem heatmap, sem
 * dead click, sem session recording, sem survey, sem captura de exceção
 * (quem cuida de erro é o Sentry) e sem web vitals (quem cuida é o Axiom). O
 * único identificador que chega lá é o id do usuário — o mesmo valor que o
 * `auditMutation` grava como `actorId`, e pela mesma razão: é o único campo
 * que permite responder a uma pergunta sem guardar nome nem e-mail.
 */

export const POSTHOG_OPTIONS: Partial<PostHogConfig> = {
  // Mesma origem: o next.config.ts reescreve /ingest/* para o host
  // configurado, então a CSP do proxy.ts não ganha origem nova (ADR 0011).
  api_host: POSTHOG_PROXY_PATH,
  // Só usado para montar links de volta para o app do PostHog (toolbar,
  // debug); nunca requisitado pelo navegador.
  ui_host: NEXT_PUBLIC_POSTHOG_HOST,
  defaults: '2026-08-30',

  // --- o que capturamos ----------------------------------------------------
  capture_pageview: 'history_change',
  capture_pageleave: true,
  autocapture: false,
  rageclick: false,
  capture_heatmaps: false,
  capture_dead_clicks: false,
  capture_performance: false,
  // O Sentry é o rastreador de erro; duas cópias de cada exceção em duas
  // ferramentas são duas ferramentas em que ninguém confia.
  capture_exceptions: false,

  // --- o que recusamos coletar ---------------------------------------------
  disable_session_recording: true,
  disable_surveys: true,
  disable_web_experiments: true,
  // A CSP do Steel não tem `'strict-dynamic'` e `script-src` é
  // `'self' 'nonce-…'`: o PostHog não pode injetar `<script>` remoto, e com
  // recording/survey/experiment desligados ele não tem motivo para isso.
  disable_external_dependency_loading: true,
  // Reforço para os caminhos de captura que leem o DOM.
  mask_all_text: true,
  mask_all_element_attributes: true,
  mask_personal_data_properties: true,
  // Sem perfil para quem nunca entrou.
  person_profiles: 'identified_only',
  // Desligado de propósito. `respect_dnt` faz o posthog-js recusar coleta
  // quando o navegador manda `doNotTrack` ou `globalPrivacyControl` — e o
  // Firefox liga GPC por padrão no modo "Restrito" e em janela privativa,
  // assim como o Brave. Com ele ligado, esses visitantes clicaram "Aceitar"
  // no nosso banner e seriam ignorados em silêncio: sem evento, sem log, sem
  // erro. GPC é construção da CCPA sobre *venda ou compartilhamento* de dado
  // pessoal, o que este produto não faz, e nenhuma lei brasileira exige
  // honrá-lo. O portão que vale continua sendo o opt-in explícito e
  // revogável do banner de cookies: sem consentimento, sem SDK.
  respect_dnt: false,
  // Não usamos feature flags do PostHog; pular o round trip de /flags/ mantém
  // o proxy reverso restrito à ingestão de eventos.
  advanced_disable_flags: true,
  property_denylist: ['$ip', '$initial_referrer', '$initial_referring_domain'],

  persistence: 'localStorage+cookie',
  secure_cookie: true,
}

let pending: Promise<PostHog | null> | null = null

/**
 * Resolve o client inicializado, importando `posthog-js` na primeira chamada.
 * Chamadas repetidas compartilham uma promise, então o SDK é buscado e
 * inicializado no máximo uma vez por carregamento de página. Um import que
 * falha resolve `null` em vez de rejeitar: analytics nunca pode quebrar o
 * app.
 */
export function loadPostHog(): Promise<PostHog | null> {
  const key = NEXT_PUBLIC_POSTHOG_KEY
  if (!key) return Promise.resolve(null)
  pending ??= import('posthog-js')
    .then(({ posthog }) => {
      posthog.init(key, POSTHOG_OPTIONS)
      return posthog
    })
    .catch(() => null)
  return pending
}

/**
 * Dispara um evento de produto, se analytics tiver permissão de rodar.
 *
 * O consentimento é relido do cookie aqui em vez de ser confiado ao chamador:
 * diferente do `<PostHogTracker />`, que só monta atrás do portão de consent,
 * estes são handlers de clique espalhados pelo site; um deles disparando numa
 * página em que o visitante nunca aceitou analytics inicializaria o SDK e
 * mandaria um beacon. Nada é aguardado — um botão não espera analytics, e uma
 * carga que falha é no-op por design.
 */
export function captureEvent(
  event: string,
  properties?: Record<string, string | number | boolean | null>,
): void {
  if (!hasAnalyticsConsent()) return
  void loadPostHog().then((posthog) => {
    posthog?.capture(event, properties)
  })
}

function hasAnalyticsConsent(): boolean {
  if (typeof document === 'undefined') return false
  const value = document.cookie
    .split('; ')
    .find((entry) => entry.startsWith(`${COOKIE_NAME}=`))
    ?.slice(COOKIE_NAME.length + 1)
  return parseCookieConsent(value) === 'accepted'
}

/** Costura de teste: descarta o client memoizado para cada caso começar do zero. */
export function resetPostHogForTests(): void {
  pending = null
}
