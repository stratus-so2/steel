import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { NEXT_PUBLIC_URL, NODE_ENV } from '@/lib/env/env'

/**
 * Portal do contato externo (`/suporte`): token do link mágico e token da
 * sessão própria. Nada aqui toca banco nem `cookies()` — é tudo função
 * pura, para o service e as rotas usarem e os testes cobrirem sem DOM.
 *
 * Os dois tokens são aleatórios de 32 bytes (base64url) e **só o SHA-256
 * vai para o banco** (`SdPortalAccess.tokenHash` / `.sessionHash`), como
 * nos links de aprovação. O link vale 7 dias e é de uso único; a sessão
 * que ele abre vale 12 horas.
 */

/** Cookie da sessão do portal externo — nome próprio, nunca o do Better Auth. */
export const SD_PORTAL_COOKIE = 'sd.portal_session'

/** Validade do link mágico: 7 dias. */
export const SD_PORTAL_LINK_TTL_MS = 7 * 24 * 60 * 60 * 1000

/** Validade da sessão aberta pelo link: 12 horas. */
export const SD_PORTAL_SESSION_TTL_MS = 12 * 60 * 60 * 1000

const TOKEN_BYTES = 32
/** 32 bytes em base64url = 43 caracteres. */
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/

export interface SdPortalToken {
  /** Só vai para o e-mail / cookie; nunca para o banco nem para log. */
  token: string
  hash: string
}

export function hashSdPortalToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export function newSdPortalToken(): SdPortalToken {
  const token = randomBytes(TOKEN_BYTES).toString('base64url')
  return { token, hash: hashSdPortalToken(token) }
}

/** Formato do token (barra qualquer coisa antes de ir ao banco). */
export function isSdPortalToken(value: unknown): value is string {
  return typeof value === 'string' && TOKEN_PATTERN.test(value)
}

/** Comparação de hashes em tempo constante. */
export function sdPortalHashEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  return timingSafeEqual(Buffer.from(a), Buffer.from(b))
}

/**
 * Base pública do app. Em teste a validação de env é desligada, então a
 * variável pode não existir — cai num caminho relativo em vez de estourar.
 */
function baseUrl(): string {
  return NEXT_PUBLIC_URL ?? ''
}

/** `https://…/suporte/entrar/<token>` — o endereço que vai no e-mail. */
export function sdPortalLinkUrl(token: string): string {
  return `${baseUrl()}/suporte/entrar/${token}`
}

/** `https://…/suporte` — onde o contato pede um link novo. */
export function sdPortalHomeUrl(): string {
  return `${baseUrl()}/suporte`
}

export interface SdPortalCookieOptions {
  httpOnly: true
  secure: boolean
  sameSite: 'lax'
  path: string
  expires: Date
  maxAge?: number
}

/**
 * Opções do cookie da sessão: `httpOnly`, `sameSite=lax` (o contato chega
 * pelo link do e-mail) e `secure` em produção — em desenvolvimento o app
 * roda em HTTP e o navegador descartaria o cookie.
 */
export function sdPortalCookieOptions(expiresAt: Date): SdPortalCookieOptions {
  return {
    httpOnly: true,
    secure: NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  }
}

/** Opções para apagar o cookie (sair do portal). */
export function sdPortalClearCookieOptions(): SdPortalCookieOptions {
  return { ...sdPortalCookieOptions(new Date(0)), maxAge: 0 }
}

/** Quando um link criado agora expira (7 dias). */
export function sdPortalLinkExpiry(now: Date = new Date()): Date {
  return new Date(now.getTime() + SD_PORTAL_LINK_TTL_MS)
}

/** Quando uma sessão aberta agora expira (12 horas). */
export function sdPortalSessionExpiry(now: Date = new Date()): Date {
  return new Date(now.getTime() + SD_PORTAL_SESSION_TTL_MS)
}
