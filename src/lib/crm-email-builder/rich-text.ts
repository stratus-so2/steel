import { isEmailBuilderLink } from '@/src/schemas/crm-email-builder.schema'
import { escapeHtml } from './variables'

/**
 * Rich text of the builder paragraphs (TipTap in the bottom panel). Only a
 * small inline subset survives — e-mail clients render little else and the
 * layout must stay locked: paragraphs, line breaks, bold/italic/underline/
 * strike, links and lists. Everything runs without a DOM (server + worker).
 */

const ALLOWED = new Set([
  'p',
  'br',
  'strong',
  'b',
  'em',
  'i',
  'u',
  's',
  'a',
  'ul',
  'ol',
  'li',
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
  'title',
  'head',
])

const VOID = new Set(['br'])

const TAG = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>/g

function readHref(attrs: string): string | null {
  const match = attrs.match(/\bhref\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i)
  if (!match) return null
  const value = (match[2] ?? match[3] ?? match[4] ?? '').trim()
  // Attribute values arrive entity-encoded; validate the decoded URL.
  const decoded = value.replace(/&amp;/g, '&')
  return decoded && isEmailBuilderLink(decoded) ? decoded : null
}

/** Strips everything outside the allowlist; returns clean HTML. */
export function sanitizeRichText(input: string): string {
  let html = input
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, '')
    .replace(/<![^>]*>/g, '')

  for (const tag of DROP_WITH_CONTENT) {
    html = html.replace(
      new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}\\s*>`, 'gi'),
      '',
    )
    html = html.replace(new RegExp(`<\\/?${tag}\\b[^>]*>`, 'gi'), '')
  }

  return html.replace(TAG, (_match, close: string, rawName: string, attrs) => {
    const name = rawName.toLowerCase()
    if (!ALLOWED.has(name)) return ''
    if (close) return VOID.has(name) ? '' : `</${name}>`
    if (VOID.has(name)) return `<${name}>`
    if (name === 'a') {
      const href = readHref(attrs)
      return href ? `<a href="${escapeHtml(href)}">` : '<a>'
    }
    return `<${name}>`
  })
}

/** Plain text typed without markup becomes paragraphs (blank line) and
 * line breaks; markup is sanitized as is. */
export function normalizeRichText(input: string): string {
  const trimmed = input.trim()
  if (!trimmed) return ''
  if (/<[a-zA-Z/!]/.test(trimmed)) return sanitizeRichText(trimmed)
  return trimmed
    .split(/\n{2,}/)
    .map((block) => `<p>${escapeHtml(block).replace(/\n/g, '<br>')}</p>`)
    .join('')
}

export type RichTextTheme = {
  color: string
  linkColor: string
  fontSize: number
  lineHeight: number
  align?: 'left' | 'center'
}

/** Clean rich text → e-mail HTML with inline styles (clients drop <style>). */
export function styleRichText(clean: string, theme: RichTextTheme): string {
  const align = theme.align ?? 'left'
  const text = `font-size:${theme.fontSize}px;line-height:${theme.lineHeight}px;color:${theme.color};text-align:${align}`
  return normalizeRichText(clean)
    .replace(/<p>/g, `<p style="margin:0 0 16px;${text}">`)
    .replace(
      /<(ul|ol)>/g,
      `<$1 style="margin:0 0 16px;padding-left:24px;${text}">`,
    )
    .replace(/<li>/g, '<li style="margin:0 0 4px">')
    .replace(
      /<a( href="[^"]*")?>/g,
      `<a$1 style="color:${theme.linkColor};text-decoration:underline">`,
    )
}

/** Text content of rich text (gallery cards, plain-text fallbacks). */
export function richTextToPlain(clean: string): string {
  return normalizeRichText(clean)
    .replace(/<br>/g, '\n')
    .replace(/<\/(p|li)>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
