/**
 * Funções puras do canal de e-mail do ServiceDesk: limpeza do corpo
 * (citação e assinatura), detecção de mensagem automática, casamento de
 * remetente com as listas da caixa e o código do chamado no assunto.
 *
 * Nada aqui toca rede, banco ou Prisma — é tudo texto, para dar para
 * testar linha a linha.
 */

/** Linhas que abrem a citação da resposta anterior. */
const QUOTE_HEADERS: RegExp[] = [
  // pt-BR: "Em 1 de out. de 2026 10:00, Fulano <f@x.com> escreveu:"
  /^\s*em\s.+escreveu:\s*$/i,
  // en: "On Wed, Oct 1, 2026 at 10:00, John <j@x.com> wrote:"
  /^\s*on\s.+wrote:\s*$/i,
  // es: "El 1 oct 2026, Fulano escribió:"
  /^\s*el\s.+escribió:\s*$/i,
  // Outlook (pt-BR / en / es)
  /^\s*-{2,}\s*mensagem original\s*-{2,}\s*$/i,
  /^\s*-{2,}\s*original message\s*-{2,}\s*$/i,
  /^\s*-{2,}\s*mensaje original\s*-{2,}\s*$/i,
  /^\s*-{2,}\s*encaminhada\b.*-{2,}\s*$/i,
  /^\s*_{10,}\s*$/,
]

/** Cabeçalho do Outlook: "De: ... Enviada em: ... Para: ...". */
const QUOTE_FIELD = /^\s*(de|from|enviada?\s+em|sent|para|to|assunto|subject):/i

/** Rodapé que o Steel coloca nos e-mails que envia. */
const STEEL_MARKER = /^\s*-{2,}\s*responda acima desta linha\s*-{2,}\s*$/i

/** Separador padrão de assinatura (RFC 3676): exatamente "-- ". */
const SIGNATURE_LINE = /^--\s?$/

/** Assinaturas comuns sem o separador padrão. */
const SIGNATURE_HINT =
  /^\s*(atenciosamente|att\.?|abraços?|regards|best regards|kind regards|saudações|cordialmente)\s*[,.!]?\s*$/i

/**
 * Corta a citação: tudo a partir da primeira linha de citação (`>` seguido
 * de mais citação, "Em ... escreveu:", bloco de cabeçalhos do Outlook).
 */
export function stripSdMailQuote(text: string): string {
  const lines = text.split('\n')
  const kept: string[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    if (STEEL_MARKER.test(line)) break
    if (QUOTE_HEADERS.some((pattern) => pattern.test(line))) break

    // Bloco de citação com ">": corta quando é o começo de um trecho citado
    // (duas linhas citadas seguidas, ou citada até o fim da mensagem).
    if (/^\s*>/.test(line)) {
      const next = lines[i + 1]
      if (next === undefined || /^\s*>/.test(next) || next.trim() === '') break
    }

    // Cabeçalho do Outlook colado sem separador: "De:" seguido de "Para:"/
    // "Assunto:" nas próximas linhas.
    if (QUOTE_FIELD.test(line)) {
      const window = lines.slice(i, i + 5).filter((l) => QUOTE_FIELD.test(l))
      if (window.length >= 2) break
    }

    kept.push(line)
  }

  return kept.join('\n')
}

/** Corta a assinatura a partir de `-- ` (ou de "Atenciosamente," no fim). */
export function stripSdMailSignature(text: string): string {
  const lines = text.split('\n')

  const separator = lines.findIndex((line) => SIGNATURE_LINE.test(line))
  if (separator >= 0) return lines.slice(0, separator).join('\n')

  for (let i = lines.length - 1; i >= 0 && i >= lines.length - 8; i--) {
    if (!SIGNATURE_HINT.test(lines[i])) continue
    // Só corta se o que sobra ainda tem conteúdo.
    const head = lines.slice(0, i).join('\n').trim()
    if (head) return lines.slice(0, i).join('\n')
  }

  return text
}

/** Normaliza quebras, remove espaço à direita e colapsa linhas em branco. */
export function normalizeSdMailText(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/ /g, ' ')
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** Tamanho máximo do corpo guardado como mensagem do chamado. */
export const SD_MAIL_BODY_MAX = 20_000

/**
 * Corpo pronto para virar mensagem do chamado: normaliza, corta citação e
 * assinatura e limita o tamanho. Devolve `''` quando não sobra nada.
 */
export function cleanSdMailBody(raw: string | null | undefined): string {
  if (!raw) return ''
  const normalized = normalizeSdMailText(raw)
  if (!normalized) return ''
  const withoutQuote = stripSdMailQuote(normalized)
  const withoutSignature = stripSdMailSignature(withoutQuote)
  const cleaned = normalizeSdMailText(withoutSignature)
  // Só assinatura depois da citação: ainda assim é melhor que nada.
  const text = cleaned || normalizeSdMailText(withoutQuote)
  if (!text) return ''
  return text.length > SD_MAIL_BODY_MAX
    ? `${text.slice(0, SD_MAIL_BODY_MAX - 1)}…`
    : text
}

/** Converte HTML de e-mail em texto simples (fallback sem parte `text`). */
export function sdMailHtmlToText(html: string): string {
  const text = html
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|li|h[1-6])>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
  return normalizeSdMailText(text)
}

/* ------------------------------ endereços -------------------------------- */

/** Minúsculas, sem espaços e sem o nome ("Ana <a@x.com>" → "a@x.com"). */
export function normalizeSdMailAddress(
  value: string | null | undefined,
): string {
  if (!value) return ''
  const match = value.match(/<([^>]+)>/)
  return (match ? match[1] : value).trim().toLowerCase()
}

/** Entrada da lista bate com o endereço? (`@dominio.com` cobre o domínio). */
export function sdMailAddressMatches(address: string, entry: string): boolean {
  const target = normalizeSdMailAddress(address)
  const rule = entry.trim().toLowerCase()
  if (!target || !rule) return false
  if (rule.startsWith('@')) return target.endsWith(rule)
  return target === rule
}

/** O remetente passa pelas listas da caixa? (permitidos vazio = qualquer um). */
export function sdMailSenderAllowed(
  address: string,
  lists: { allowedSenders: string[]; blockedSenders: string[] },
): boolean {
  const target = normalizeSdMailAddress(address)
  if (!target) return false
  if (lists.blockedSenders.some((e) => sdMailAddressMatches(target, e))) {
    return false
  }
  if (lists.allowedSenders.length === 0) return true
  return lists.allowedSenders.some((e) => sdMailAddressMatches(target, e))
}

/* ------------------------- mensagens automáticas -------------------------- */

export type SdMailHeaders = Record<string, string | string[] | undefined>

function header(headers: SdMailHeaders, name: string): string {
  const value = headers[name.toLowerCase()] ?? headers[name]
  if (Array.isArray(value)) return value.join(' ').toLowerCase()
  return (value ?? '').toString().trim().toLowerCase()
}

/** Assuntos típicos de resposta automática / devolução. */
const AUTO_SUBJECT =
  /(^|\b)(out of office|automatic reply|auto ?reply|resposta autom[áa]tica|aus[êe]ncia tempor[áa]ria|f[ée]rias|undeliverable|delivery status notification|mail delivery (failed|subsystem)|returned mail)\b/i

/**
 * Mensagem automática (férias, bounce, lista): não abre nem reabre chamado,
 * só fica registrada em `SdMailMessage` com `automatic: true`.
 */
export function isSdMailAutomatic(input: {
  headers?: SdMailHeaders
  subject?: string | null
  fromAddress?: string | null
}): boolean {
  const headers = input.headers ?? {}

  const autoSubmitted = header(headers, 'auto-submitted')
  if (autoSubmitted && autoSubmitted !== 'no') return true
  if (header(headers, 'x-autoreply')) return true
  if (header(headers, 'x-autorespond')) return true
  if (header(headers, 'x-auto-response-suppress')) return true
  if (header(headers, 'list-id') || header(headers, 'list-unsubscribe')) {
    return true
  }

  const precedence = header(headers, 'precedence')
  if (['bulk', 'list', 'junk', 'auto_reply'].includes(precedence)) return true

  // Return-Path vazio (`<>`) é a marca de bounce/notificação de entrega.
  if ('return-path' in headers || 'Return-Path' in headers) {
    const returnPath = header(headers, 'return-path')
    if (returnPath === '' || returnPath === '<>') return true
  }

  const from = normalizeSdMailAddress(input.fromAddress)
  if (
    from.startsWith('mailer-daemon@') ||
    from.startsWith('postmaster@') ||
    from.startsWith('no-reply@') ||
    from.startsWith('noreply@')
  ) {
    return true
  }

  return AUTO_SUBJECT.test((input.subject ?? '').trim())
}

/* ------------------------------ assunto ---------------------------------- */

/** Prefixos de resposta/encaminhamento removidos do título do chamado. */
const REPLY_PREFIX =
  /^\s*((re|res|enc|encaminhada|fw|fwd)\s*(\[\d+\])?\s*:\s*)+/i

/** Código do chamado no assunto: `[INC-000123]` ou `INC-000123`. */
const TICKET_CODE = /\[?\s*([A-Z]{2,6})-(\d{1,12})\s*\]?/

/**
 * Código do chamado presente no assunto (`"Re: [INC-000123] Impressora"` →
 * `{ prefix: 'INC', number: 123 }`), ou `null`.
 */
export function sdMailTicketCodeFromSubject(
  subject: string | null | undefined,
): { prefix: string; number: number; code: string } | null {
  if (!subject) return null
  const match = subject.toUpperCase().match(TICKET_CODE)
  if (!match) return null
  const number = Number.parseInt(match[2], 10)
  if (!Number.isSafeInteger(number) || number <= 0) return null
  return { prefix: match[1], number, code: `${match[1]}-${match[2]}` }
}

/** Título do chamado a partir do assunto (sem `Re:`, sem o código). */
export function sdMailTicketTitle(
  subject: string | null | undefined,
  fallback = 'Chamado aberto por e-mail',
): string {
  const cleaned = (subject ?? '')
    .replace(/\r?\n/g, ' ')
    .replace(REPLY_PREFIX, '')
    .replace(TICKET_CODE, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
  return cleaned ? cleaned.slice(0, 200) : fallback
}

/** Assunto da resposta: `Re: [INC-000123] <assunto>`. */
export function sdMailReplySubject(code: string, subject: string): string {
  const clean = subject
    .replace(REPLY_PREFIX, '')
    .replace(TICKET_CODE, '')
    .trim()
  return `Re: [${code}] ${clean || 'Chamado'}`.slice(0, 250)
}

/**
 * `References` do e-mail de saída: o que já existia mais o id respondido,
 * sem repetição e limitado aos 20 últimos (RFC 5322 recomenda podar).
 */
export function sdMailReferences(
  previous: string[],
  inReplyTo: string | null,
): string[] {
  const all = [...previous, ...(inReplyTo ? [inReplyTo] : [])]
    .map((id) => id.trim())
    .filter(Boolean)
  return [...new Set(all)].slice(-20)
}

/** Corpo do e-mail de saída, com a linha que separa a citação. */
export function sdMailOutboundBody(body: string, footer: string): string {
  return `${body.trim()}\n\n-- Responda acima desta linha --\n${footer}`
}
