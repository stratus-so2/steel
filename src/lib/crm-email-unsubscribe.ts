import 'server-only'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { BETTER_AUTH_SECRET } from '@/lib/env/server'
import { err, ok, type Result } from '@/src/lib/result'

/**
 * Descadastro LGPD de campanhas de e-mail do CRM.
 *
 * O token identifica a linha de destinatário (`CrmEmailCampaignRecipient`),
 * que já carrega workspace (via campanha), e-mail e pessoa. Stateless e sem
 * expiração — o titular pode sair a qualquer momento, inclusive por e-mails
 * antigos. Assinado por HMAC-SHA256 com separação de domínio, para não ser
 * intercambiável com outros tokens assinados pelo mesmo segredo.
 *
 * Formato: `<recipientIdBase64url>.<assinaturaBase64url>`.
 */

const DOMAIN = 'crm-email-unsubscribe:v1'

function sign(payloadB64: string): string {
  return createHmac('sha256', BETTER_AUTH_SECRET)
    .update(`${DOMAIN}:${payloadB64}`)
    .digest('base64url')
}

export function createCrmUnsubscribeToken(recipientId: string): string {
  const payloadB64 = Buffer.from(recipientId).toString('base64url')
  return `${payloadB64}.${sign(payloadB64)}`
}

/** Devolve o id do destinatário se a assinatura confere. */
export function verifyCrmUnsubscribeToken(
  token: string,
): Result<string, 'invalid'> {
  const parts = token.split('.')
  if (parts.length !== 2) return err('invalid')
  const [payloadB64, signature] = parts
  if (!payloadB64 || !signature) return err('invalid')

  const a = Buffer.from(signature)
  const b = Buffer.from(sign(payloadB64))
  if (a.length !== b.length || !timingSafeEqual(a, b)) return err('invalid')

  const recipientId = Buffer.from(payloadB64, 'base64url').toString('utf8')
  if (!recipientId) return err('invalid')
  return ok(recipientId)
}

export type CrmUnsubscribeUrls = {
  /** Alvo do POST one-click (RFC 8058) — rota de API, sem sessão. */
  oneClickUrl: string
  /** Página pública de confirmação, linkada no rodapé. */
  pageUrl: string
}

export function buildCrmUnsubscribeUrls(
  baseUrl: string,
  token: string,
): CrmUnsubscribeUrls {
  const base = baseUrl.replace(/\/$/, '')
  return {
    oneClickUrl: `${base}/api/crm/unsubscribe/${token}`,
    pageUrl: `${base}/unsubscribe/${token}`,
  }
}

/** Cabeçalhos RFC 2369 + RFC 8058 (one-click) para provedores como Gmail. */
export function buildCrmUnsubscribeHeaders(
  urls: CrmUnsubscribeUrls,
): Record<string, string> {
  return {
    'List-Unsubscribe': `<${urls.oneClickUrl}>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  }
}

function escapeAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;')
}

/** Anexa o rodapé de descadastro ao HTML da campanha (dentro do `<body>`
 * quando houver, senão no fim do fragmento). */
export function withCrmUnsubscribeFooter(
  html: string,
  pageUrl: string,
): string {
  const footer =
    '<div style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e7eb;font-family:Arial,sans-serif;font-size:12px;line-height:18px;color:#6b7280;text-align:center">' +
    'Você recebeu este e-mail porque está na base de contatos do remetente. ' +
    `Não quer mais receber? <a href="${escapeAttr(pageUrl)}" style="color:#6b7280;text-decoration:underline">Clique aqui para se descadastrar</a>.` +
    '</div>'

  const closeBody = html.search(/<\/body>/i)
  if (closeBody === -1) return `${html}${footer}`
  return `${html.slice(0, closeBody)}${footer}${html.slice(closeBody)}`
}
