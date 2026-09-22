/**
 * Sanitização do HTML do editor rico do ServiceDesk (descrição do chamado,
 * mensagens). Allowlist de tags e atributos; o resto é removido:
 *
 * - `script`, `style`, `iframe`, `object`, `embed`, `template`, `noscript`,
 *   `svg`, `math`, `textarea`, `select`: removidos **com o conteúdo**;
 * - demais tags fora da lista: removidas, mantendo o texto de dentro;
 * - atributos: só os da lista, sem `on*`/`style`; `href`/`src` só com
 *   `http(s):`, `mailto:`, `tel:`, relativos ou `data:image/*` (em `src`);
 * - comentários, `<!DOCTYPE>` e CDATA: removidos;
 * - `<a>` ganha `rel="noopener noreferrer"` (e `target="_blank"` preservado).
 *
 * Não depende de DOM (roda no server e no worker).
 */

const ALLOWED_TAGS = new Set([
  'a',
  'b',
  'blockquote',
  'br',
  'code',
  'del',
  'div',
  'em',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'hr',
  'i',
  'img',
  'li',
  'mark',
  'ol',
  'p',
  'pre',
  's',
  'span',
  'strong',
  'sub',
  'sup',
  'table',
  'tbody',
  'td',
  'th',
  'thead',
  'tr',
  'u',
  'ul',
])

const DROP_WITH_CONTENT = new Set([
  'script',
  'style',
  'iframe',
  'object',
  'embed',
  'template',
  'noscript',
  'svg',
  'math',
  'textarea',
  'select',
])

const VOID_TAGS = new Set(['br', 'hr', 'img'])

const GLOBAL_ATTRS = new Set(['class', 'title', 'dir'])
const TAG_ATTRS: Record<string, Set<string>> = {
  a: new Set(['href', 'target']),
  img: new Set(['src', 'alt', 'width', 'height']),
  td: new Set(['colspan', 'rowspan']),
  th: new Set(['colspan', 'rowspan']),
  ol: new Set(['start']),
  code: new Set(['data-language']),
  pre: new Set(['data-language']),
  span: new Set(['data-type', 'data-id', 'data-label']),
}

const SAFE_URL = /^(https?:|mailto:|tel:|\/(?!\/)|#|\.{0,2}\/)/i
const SAFE_IMAGE_DATA =
  /^data:image\/(png|jpe?g|gif|webp);base64,[a-z0-9+/=\s]+$/i

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function decodeEntities(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);?/gi, (_, hex) =>
      String.fromCodePoint(Number.parseInt(hex, 16)),
    )
    .replace(/&#(\d+);?/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&colon;/gi, ':')
    .replace(/&tab;/gi, '\t')
    .replace(/&newline;/gi, '\n')
    .replace(/&amp;/gi, '&')
}

function isSafeUrl(attr: 'href' | 'src', raw: string): boolean {
  // Remove controles/espaços que navegadores ignoram (`java\tscript:`).
  // biome-ignore lint/suspicious/noControlCharactersInRegex: filtra controles de propósito
  const value = decodeEntities(raw).replace(/[\u0000-\u0020]/g, '')
  if (value === '') return false
  if (attr === 'src' && SAFE_IMAGE_DATA.test(value)) return true
  if (SAFE_URL.test(value)) return true
  // Sem esquema (`exemplo.com/x`): relativo, seguro.
  return !/^[a-z][a-z0-9+.-]*:/i.test(value)
}

const ATTR = /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g

function sanitizeAttributes(tag: string, raw: string): string {
  const allowed = TAG_ATTRS[tag]
  const out: string[] = []
  let hasTargetBlank = false
  for (const match of raw.matchAll(ATTR)) {
    const name = match[1].toLowerCase()
    const value = match[2] ?? match[3] ?? match[4] ?? ''
    if (!GLOBAL_ATTRS.has(name) && !allowed?.has(name)) continue
    if ((name === 'href' || name === 'src') && !isSafeUrl(name, value)) {
      continue
    }
    if (name === 'target') {
      if (value !== '_blank') continue
      hasTargetBlank = true
    }
    out.push(`${name}="${escapeAttr(decodeEntities(value))}"`)
  }
  if (tag === 'a' && hasTargetBlank) out.push('rel="noopener noreferrer"')
  return out.length > 0 ? ` ${out.join(' ')}` : ''
}

const TOKEN =
  /<!--[\s\S]*?(?:-->|$)|<!\[CDATA\[[\s\S]*?(?:\]\]>|$)|<![^>]*>?|<\?[^>]*>?|<\/?([a-zA-Z][a-zA-Z0-9-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/g

/** HTML seguro para renderizar com `dangerouslySetInnerHTML`. */
export function sanitizeSdHtml(html: string): string {
  let out = ''
  let last = 0
  let dropping: string | null = null
  let depth = 0

  for (const match of html.matchAll(TOKEN)) {
    const index = match.index
    const text = html.slice(last, index)
    last = index + match[0].length
    if (!dropping) out += text.replace(/</g, '&lt;').replace(/>/g, '&gt;')

    const rawName = match[1]
    if (!rawName) continue // comentário, doctype, CDATA, PI
    const tag = rawName.toLowerCase()
    const closing = match[0].startsWith('</')

    if (dropping) {
      if (tag === dropping) {
        depth += closing ? -1 : 1
        if (depth === 0) dropping = null
      }
      continue
    }
    if (DROP_WITH_CONTENT.has(tag)) {
      if (!closing && !match[0].endsWith('/>')) {
        dropping = tag
        depth = 1
      }
      continue
    }
    if (!ALLOWED_TAGS.has(tag)) continue
    if (closing) {
      if (!VOID_TAGS.has(tag)) out += `</${tag}>`
      continue
    }
    out += `<${tag}${sanitizeAttributes(tag, match[2])}>`
  }
  if (!dropping) {
    out += html.slice(last).replace(/</g, '&lt;').replace(/>/g, '&gt;')
  }
  return out
}

/** Texto puro do HTML (busca, e-mails, notificações). */
export function sdHtmlToText(html: string): string {
  return decodeEntities(
    sanitizeSdHtml(html)
      .replace(/<(br|\/p|\/div|\/li|\/h[1-6])[^>]*>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"'),
  )
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
