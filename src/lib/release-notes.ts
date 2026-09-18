/**
 * Converte as notas de uma release do GitHub (markdown, geradas pelo
 * `gh release create --generate-notes` do CD ou escritas à mão) num rascunho
 * do e-mail de novidades (`ChangelogEmail`: assunto + itens título/texto em
 * texto puro com quebras de linha).
 *
 * Regras:
 * - Commits/linhas convencionais de tipo interno (ci, chore, test, build,
 *   style, refactor, docs, revert) saem; feat/fix/perf viram grupos
 *   "Novidades", "Correções" e "Melhorias de desempenho".
 * - Seções cujo título é interno (CI, Chores, Tests, Dependencies, New
 *   Contributors, Maintenance...) saem inteiras.
 * - Linhas sem tipo convencional ficam no grupo do título da seção (ou em
 *   "Outras melhorias").
 * - Sai o ruído do GitHub: "by @user in <url>", links de PR/compare,
 *   "**Full Changelog**", comentários HTML, markdown inline.
 * O admin revisa o rascunho antes de enviar — a conversão só poupa digitação.
 */

export const INTERNAL_COMMIT_TYPES = new Set([
  'ci',
  'chore',
  'test',
  'tests',
  'build',
  'style',
  'refactor',
  'docs',
  'revert',
])

const TYPE_GROUP: Record<string, string> = {
  feat: 'Novidades',
  fix: 'Correções',
  perf: 'Melhorias de desempenho',
}

const FALLBACK_GROUP = 'Outras melhorias'

const INTERNAL_HEADING =
  /^(ci|chores?|tests?|testing|build|builds|refactor(ing)?|style|docs|documentation|dependencies|deps|dependency updates|maintenance|internal|infra(structure)?|new contributors|full changelog|other changes|reverts?)\b/i

/** Títulos genéricos do GitHub que não viram grupo próprio. */
const GENERIC_HEADING = /^(what'?s changed|changes|changelog|release notes)$/i

/** Nomes amigáveis dos escopos mais comuns; o resto vira Capitalizado. */
const SCOPE_LABEL: Record<string, string> = {
  crm: 'CRM',
  whatsapp: 'WhatsApp',
  zap: 'WhatsApp',
  admin: 'Admin',
  ai: 'IA',
  auth: 'Login',
  status: 'Status',
  servicedesk: 'ServiceDesk',
}

const CONVENTIONAL = /^(\w+)(?:\(([^)]*)\))?!?:\s*(.+)$/

export interface ReleaseDraftItem {
  title: string
  body: string
}

export interface ReleaseDraft {
  subject: string
  items: ReleaseDraftItem[]
  /** Linhas descartadas por serem internas (para o admin conferir). */
  skipped: number
}

const MAX_BODY = 5000

function stripInlineMarkdown(text: string): string {
  return text
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/(\*\*|__)(.+?)\1/g, '$2')
    .replace(/(^|[\s(])[*_](\S(?:.*?\S)?)[*_](?=[\s).,!?:;]|$)/g, '$1$2')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Tira o rodapé que o GitHub põe em cada item gerado automaticamente. */
function stripGithubNoise(text: string): string {
  return text
    .replace(/\s+by\s+@[\w-]+(\s+in\s+\S+)?\s*$/i, '')
    .replace(/\s+in\s+https?:\/\/\S+\s*$/i, '')
    .replace(/\s*\(#\d+\)\s*$/, '')
    .replace(/\s*\(\[?#\d+\]?(\([^)]*\))?\)\s*$/, '')
    .replace(/\s+https?:\/\/github\.com\/\S+\s*$/i, '')
    .replace(/\s+[0-9a-f]{7,40}\s*$/i, '')
    .trim()
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

function scopeLabel(scope: string): string {
  const key = scope.toLowerCase()
  return SCOPE_LABEL[key] ?? capitalize(key)
}

function headingText(line: string): { level: number; text: string } | null {
  const match = /^(#{1,6})\s+(.*)$/.exec(line)
  if (!match) return null
  return {
    level: match[1].length,
    text: stripInlineMarkdown(match[2])
      .replace(/[^\p{L}\p{N}\s'&/-]/gu, '')
      .trim(),
  }
}

type Classified =
  | { kind: 'internal' }
  | { kind: 'entry'; group: string | null; text: string }

function classify(raw: string): Classified {
  const text = stripInlineMarkdown(stripGithubNoise(raw))
  if (!text) return { kind: 'internal' }
  const match = CONVENTIONAL.exec(text)
  if (!match) return { kind: 'entry', group: null, text: capitalize(text) }

  const type = match[1].toLowerCase()
  if (INTERNAL_COMMIT_TYPES.has(type)) return { kind: 'internal' }
  const description = capitalize(match[3].trim())
  const withScope = match[2]
    ? `${scopeLabel(match[2].split(',')[0].trim())}: ${description}`
    : description
  return { kind: 'entry', group: TYPE_GROUP[type] ?? null, text: withScope }
}

function truncate(body: string): string {
  if (body.length <= MAX_BODY) return body
  return `${body.slice(0, MAX_BODY - 1).trimEnd()}…`
}

export function releaseNotesToDraft(
  markdown: string,
  release: { tag?: string | null; name?: string | null } = {},
): ReleaseDraft {
  const groups = new Map<string, string[]>()
  let skipped = 0
  let sectionGroup: string | null = null
  let skipLevel: number | null = null
  let inComment = false

  const add = (group: string, line: string) => {
    const lines = groups.get(group) ?? []
    lines.push(line)
    groups.set(group, lines)
  }

  for (const rawLine of markdown.replace(/\r\n?/g, '\n').split('\n')) {
    let line = rawLine.trim()

    if (inComment) {
      if (line.includes('-->')) inComment = false
      continue
    }
    if (line.startsWith('<!--')) {
      if (!line.includes('-->')) inComment = true
      continue
    }
    if (!line || /^[-*_]{3,}$/.test(line)) continue
    if (/full changelog/i.test(line)) continue

    const heading = headingText(line)
    if (heading) {
      if (skipLevel !== null && heading.level > skipLevel) continue
      skipLevel = null
      if (INTERNAL_HEADING.test(heading.text)) {
        skipLevel = heading.level
        sectionGroup = null
        continue
      }
      sectionGroup = GENERIC_HEADING.test(heading.text)
        ? null
        : capitalize(heading.text)
      continue
    }
    if (skipLevel !== null) {
      skipped += /^([-*+]|\d+\.)\s+/.test(line) ? 1 : 0
      continue
    }

    const bullet = /^([-*+]|\d+\.)\s+(.*)$/.exec(line)
    if (bullet) line = bullet[2]

    const classified = classify(line)
    if (classified.kind === 'internal') {
      skipped += 1
      continue
    }
    const group = classified.group ?? sectionGroup ?? FALLBACK_GROUP
    add(group, bullet ? `• ${classified.text}` : classified.text)
  }

  const order = [...Object.values(TYPE_GROUP)]
  const items = [...groups.entries()]
    .sort(([a], [b]) => {
      const ia = order.indexOf(a)
      const ib = order.indexOf(b)
      return (ia === -1 ? order.length : ia) - (ib === -1 ? order.length : ib)
    })
    .map(([title, lines]) => ({ title, body: truncate(lines.join('\n')) }))

  const label = release.name?.trim() || release.tag?.trim()
  return {
    subject: label ? `Novidades no Steel — ${label}` : 'Novidades no Steel',
    items,
    skipped,
  }
}

/** Primeira linha de cada mensagem de commit como lista markdown. */
export function commitMessagesToMarkdown(messages: readonly string[]): string {
  return messages
    .map((message) => message.split('\n')[0].trim())
    .filter(Boolean)
    .map((header) => `- ${header}`)
    .join('\n')
}

/** `base...head` do link "Full Changelog" das notas geradas pelo GitHub. */
export function parseCompareRange(
  markdown: string,
): { base: string; head: string } | null {
  const match = /\/compare\/([^\s)]+)/.exec(markdown)
  if (!match) return null
  const [base, head] = match[1].split('...')
  if (!base || !head) return null
  return { base, head }
}
