import 'server-only'
import { ImapFlow } from 'imapflow'
import { type ParsedMail, simpleParser } from 'mailparser'
import { createTransport } from 'nodemailer'

/**
 * Única porta de saída do canal de e-mail do ServiceDesk: IMAP (leitura) e
 * SMTP (resposta). Tudo o que fala com a rede mora aqui, para que os
 * services sejam testáveis com este módulo inteiramente mockado.
 *
 * O `imapflow` e o `nodemailer` ficam escondidos atrás de tipos próprios:
 * nenhuma outra camada importa essas bibliotecas.
 */

export interface SdImapConfig {
  host: string
  port: number
  secure: boolean
  user: string
  password: string
  folder: string
}

export interface SdSmtpConfig {
  host: string
  port: number
  secure: boolean
  user: string
  password: string
}

export interface SdMailAttachment {
  fileName: string
  mimeType: string
  content: Buffer
}

/** Mensagem recebida, já com o MIME resolvido. */
export interface SdFetchedMail {
  uid: number
  messageId: string
  inReplyTo: string | null
  references: string[]
  fromAddress: string
  fromName: string | null
  toAddresses: string[]
  ccAddresses: string[]
  subject: string | null
  text: string
  html: string | null
  date: Date
  headers: Record<string, string | string[] | undefined>
  attachments: SdMailAttachment[]
}

export interface SdFetchOptions {
  /** Último UID já processado: a busca começa em `sinceUid + 1`. */
  sinceUid: number | null
  /** Teto de mensagens por rodada. */
  limit: number
  /** Ignora anexos acima deste tamanho. */
  maxAttachmentBytes: number
}

export interface SdFetchResult {
  messages: SdFetchedMail[]
  /** Maior UID visto (mesmo das mensagens descartadas). */
  lastUid: number | null
}

/** Timeout de conexão: uma caixa fora do ar não pode travar o tick. */
const CONNECT_TIMEOUT_MS = 20_000

function textOf(value: unknown): string {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return value.map(textOf).join(', ')
  return ''
}

function addressList(value: ParsedMail['to']): string[] {
  if (!value) return []
  const groups = Array.isArray(value) ? value : [value]
  const out: string[] = []
  for (const group of groups) {
    for (const entry of group.value) {
      if (entry.address) out.push(entry.address.trim().toLowerCase())
    }
  }
  return out
}

function headerMap(parsed: ParsedMail): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {}
  for (const [key, raw] of parsed.headers.entries()) {
    if (typeof raw === 'string') {
      out[key] = raw
    } else if (Array.isArray(raw)) {
      out[key] = raw.map(textOf)
    } else if (raw && typeof raw === 'object' && 'value' in raw) {
      out[key] = textOf((raw as { value: unknown }).value)
    }
  }
  return out
}

function referencesOf(parsed: ParsedMail): string[] {
  const raw = parsed.references
  if (!raw) return []
  return (Array.isArray(raw) ? raw : [raw]).map((r) => r.trim()).filter(Boolean)
}

export function toSdFetchedMail(
  uid: number,
  parsed: ParsedMail,
  maxAttachmentBytes: number,
): SdFetchedMail | null {
  const messageId = parsed.messageId?.trim()
  if (!messageId) return null
  const from = parsed.from?.value?.[0]
  const fromAddress = from?.address?.trim().toLowerCase()
  if (!fromAddress) return null

  return {
    uid,
    messageId,
    inReplyTo: parsed.inReplyTo?.trim() || null,
    references: referencesOf(parsed),
    fromAddress,
    fromName: from?.name?.trim() || null,
    toAddresses: addressList(parsed.to),
    ccAddresses: addressList(parsed.cc),
    subject: parsed.subject?.trim() || null,
    text: parsed.text ?? '',
    html: typeof parsed.html === 'string' ? parsed.html : null,
    date: parsed.date ?? new Date(),
    headers: headerMap(parsed),
    attachments: parsed.attachments
      .filter(
        (a) =>
          a.content &&
          a.content.length > 0 &&
          a.content.length <= maxAttachmentBytes,
      )
      .map((a) => ({
        fileName: a.filename?.trim() || 'anexo',
        mimeType: a.contentType || 'application/octet-stream',
        content: Buffer.from(a.content),
      })),
  }
}

function imapClient(config: SdImapConfig): ImapFlow {
  return new ImapFlow({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: { user: config.user, pass: config.password },
    logger: false,
    greetingTimeout: CONNECT_TIMEOUT_MS,
    socketTimeout: CONNECT_TIMEOUT_MS * 3,
    connectionTimeout: CONNECT_TIMEOUT_MS,
  })
}

/** Conecta, confere a pasta monitorada e devolve quantas mensagens há. */
export async function verifySdImap(config: SdImapConfig): Promise<number> {
  const client = imapClient(config)
  await client.connect()
  try {
    const mailbox = await client.mailboxOpen(config.folder, { readOnly: true })
    return typeof mailbox.exists === 'number' ? mailbox.exists : 0
  } finally {
    await client.logout().catch(() => undefined)
  }
}

/** Confere as credenciais de SMTP sem enviar nada. */
export async function verifySdSmtp(config: SdSmtpConfig): Promise<boolean> {
  const transport = createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: { user: config.user, pass: config.password },
    connectionTimeout: CONNECT_TIMEOUT_MS,
    greetingTimeout: CONNECT_TIMEOUT_MS,
  })
  try {
    return await transport.verify()
  } finally {
    transport.close()
  }
}

/**
 * Lê as mensagens novas da pasta (UID maior que `sinceUid`) e, quando a
 * caixa tem pasta de processados, move o que foi lido para lá.
 */
export async function fetchSdMailbox(
  config: SdImapConfig,
  options: SdFetchOptions & { processedFolder?: string | null },
): Promise<SdFetchResult> {
  const client = imapClient(config)
  await client.connect()

  const messages: SdFetchedMail[] = []
  let lastUid: number | null = null
  const movedUids: number[] = []

  try {
    const lock = await client.getMailboxLock(config.folder)
    try {
      const start = (options.sinceUid ?? 0) + 1
      const range = `${start}:*`
      for await (const message of client.fetch(
        range,
        { uid: true, source: true },
        { uid: true },
      )) {
        const uid = message.uid
        // `start:*` sempre devolve ao menos a última mensagem, mesmo quando
        // ela já foi processada: descarta o que não é novo.
        if (options.sinceUid !== null && uid <= options.sinceUid) continue
        if (lastUid === null || uid > lastUid) lastUid = uid
        if (messages.length >= options.limit) continue

        if (!message.source) continue
        const parsed = await simpleParser(message.source)
        const mail = toSdFetchedMail(uid, parsed, options.maxAttachmentBytes)
        if (mail) {
          messages.push(mail)
          movedUids.push(uid)
        }
      }

      if (options.processedFolder && movedUids.length > 0) {
        await client
          .messageMove(movedUids.join(','), options.processedFolder, {
            uid: true,
          })
          .catch(() => undefined)
      }
    } finally {
      lock.release()
    }
  } finally {
    await client.logout().catch(() => undefined)
  }

  return { messages, lastUid }
}

export interface SdOutboundMail {
  from: { name: string; address: string }
  to: string
  subject: string
  text: string
  html?: string
  inReplyTo?: string | null
  references?: string[]
  attachments?: SdMailAttachment[]
}

/** Envia pelo SMTP da caixa; devolve o `Message-ID` gerado. */
export async function sendSdSmtp(
  config: SdSmtpConfig,
  mail: SdOutboundMail,
): Promise<string> {
  const transport = createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: { user: config.user, pass: config.password },
    connectionTimeout: CONNECT_TIMEOUT_MS,
    greetingTimeout: CONNECT_TIMEOUT_MS,
  })
  try {
    const sent = await transport.sendMail({
      from: { name: mail.from.name, address: mail.from.address },
      to: mail.to,
      subject: mail.subject,
      text: mail.text,
      ...(mail.html ? { html: mail.html } : {}),
      ...(mail.inReplyTo ? { inReplyTo: mail.inReplyTo } : {}),
      ...(mail.references?.length ? { references: mail.references } : {}),
      ...(mail.attachments?.length
        ? {
            attachments: mail.attachments.map((a) => ({
              filename: a.fileName,
              contentType: a.mimeType,
              content: a.content,
            })),
          }
        : {}),
    })
    return sent.messageId
  } finally {
    transport.close()
  }
}
