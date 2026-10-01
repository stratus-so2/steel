import type {
  SdAttachmentKind,
  WhatsAppMessageType,
  WhatsAppProvider,
} from '@prisma/client'

/**
 * Regras puras do WhatsApp no ServiceDesk (sem I/O): janela de 24 h da Meta,
 * convenção do anexo espelhado, textos de pré-visualização e o título do
 * chamado aberto pela mensagem.
 */

/** Janela de atendimento da Meta: texto livre só até 24 h após a última
 * mensagem do contato; depois, só modelo aprovado. A Z-API não tem janela. */
export const SD_WHATSAPP_WINDOW_HOURS = 24

export interface SdWhatsappWindow {
  open: boolean
  /** ISO 8601 — fim da janela (Meta), `null` sem janela aberta ou na Z-API. */
  expiresAt: string | null
  /** Fora da janela na Meta: só modelo aprovado. */
  requiresTemplate: boolean
}

export function sdWhatsappWindow(
  provider: WhatsAppProvider,
  lastInboundAt: Date | null,
  now: Date = new Date(),
): SdWhatsappWindow {
  if (provider === 'ZAPI') {
    return { open: true, expiresAt: null, requiresTemplate: false }
  }
  if (!lastInboundAt) {
    return { open: false, expiresAt: null, requiresTemplate: true }
  }
  const expires = new Date(
    lastInboundAt.getTime() + SD_WHATSAPP_WINDOW_HOURS * 60 * 60 * 1000,
  )
  const open = expires.getTime() > now.getTime()
  return {
    open,
    expiresAt: open ? expires.toISOString() : null,
    requiresTemplate: !open,
  }
}

/**
 * Anexo de chamado que aponta para a mídia de uma mensagem do WhatsApp (já
 * guardada pelo pipeline do zap no bucket `whatsapp-media`): a chave é
 * `whatsapp:<whatsAppMessageId>` e a URL vem de `WhatsAppMessage.mediaUrl`.
 */
const ATTACHMENT_PREFIX = 'whatsapp:'

export function sdWhatsappAttachmentKey(whatsappMessageId: string): string {
  return `${ATTACHMENT_PREFIX}${whatsappMessageId}`
}

/** Id da mensagem do WhatsApp de um anexo espelhado (`null` = anexo comum). */
export function parseSdWhatsappAttachmentKey(
  storageKey: string,
): string | null {
  return storageKey.startsWith(ATTACHMENT_PREFIX)
    ? storageKey.slice(ATTACHMENT_PREFIX.length) || null
    : null
}

const MEDIA: Partial<
  Record<
    WhatsAppMessageType,
    { kind: SdAttachmentKind; mime: string; name: string }
  >
> = {
  IMAGE: { kind: 'IMAGE', mime: 'image/*', name: 'imagem' },
  STICKER: { kind: 'IMAGE', mime: 'image/webp', name: 'figurinha' },
  VIDEO: { kind: 'VIDEO', mime: 'video/*', name: 'video' },
  AUDIO: { kind: 'AUDIO', mime: 'audio/*', name: 'audio' },
  DOCUMENT: {
    kind: 'DOCUMENT',
    mime: 'application/octet-stream',
    name: 'documento',
  },
}

/** Metadados do anexo espelhado de uma mensagem com mídia (`null` = sem). */
export function sdWhatsappAttachmentMeta(
  type: WhatsAppMessageType,
): { kind: SdAttachmentKind; mimeType: string; fileName: string } | null {
  const media = MEDIA[type]
  if (!media) return null
  return {
    kind: media.kind,
    mimeType: media.mime,
    fileName: `whatsapp-${media.name}`,
  }
}

const PREVIEW: Record<WhatsAppMessageType, string> = {
  TEXT: '',
  IMAGE: '[Imagem]',
  AUDIO: '[Áudio]',
  VIDEO: '[Vídeo]',
  DOCUMENT: '[Documento]',
  STICKER: '[Figurinha]',
  LOCATION: '[Localização]',
  TEMPLATE: '[Modelo]',
  BUTTON: '[Botão]',
  CONTACT: '[Contato]',
}

/** Corpo da mensagem espelhada no histórico do chamado. */
export function sdWhatsappMessageBody(
  type: WhatsAppMessageType,
  text: string | null | undefined,
): string {
  const clean = text?.trim() ?? ''
  const tag = PREVIEW[type]
  if (!tag) return clean || '[Mensagem]'
  if (type === 'TEMPLATE') return clean ? `[Modelo] ${clean}` : tag
  return clean ? `${tag} ${clean}` : tag
}

export const SD_WHATSAPP_DEFAULT_TITLE = 'Atendimento via WhatsApp'
const TITLE_MAX = 120

/** Título do chamado aberto pelo WhatsApp: a 1ª linha da mensagem. */
export function sdWhatsappTicketTitle(text: string | null | undefined): string {
  const firstLine =
    text
      ?.split('\n')
      .map((line) => line.trim())
      .find((line) => line.length > 0) ?? ''
  if (firstLine.length < 3) return SD_WHATSAPP_DEFAULT_TITLE
  return firstLine.length > TITLE_MAX
    ? `${firstLine.slice(0, TITLE_MAX - 1).trimEnd()}…`
    : firstLine
}

function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

/** Texto simples → HTML de parágrafos (descrição do chamado). */
export function sdPlainTextToHtml(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => `<p>${escapeHtml(block).replaceAll('\n', '<br>')}</p>`)
    .join('')
}

/**
 * Número do WhatsApp em dígitos com DDI: aceita formatação; 10–11 dígitos
 * (DDD + número) ganham o 55 do Brasil. `null` quando não parece telefone.
 */
export function normalizeSdWhatsappNumber(
  raw: string | null | undefined,
): string | null {
  const digits = raw?.replace(/\D/g, '') ?? ''
  if (digits.length === 10 || digits.length === 11) return `55${digits}`
  if (digits.length >= 12 && digits.length <= 15) return digits
  return null
}

/** Resposta enviada ao contato quando o chamado é aberto pelo WhatsApp. */
export function sdWhatsappTicketOpenedText(code: string): string {
  return `Recebemos sua solicitação e abrimos o chamado *${code}*. Um atendente vai responder por aqui. Guarde este número para acompanhar.`
}
