/**
 * Finds the API calls a developer guide makes, so a test can hold every
 * example against `public/openapi.json`: a guide that points at a route that
 * doesn't exist (or with the wrong method) fails CI instead of misleading an
 * integrator.
 *
 * A call is any `/api/...` path in the page — code blocks, inline code or
 * prose. Placeholders (`<token>`, `$TOKEN`, `${token}`) stand for one path
 * segment, and a trailing `/...` names a family of routes. The method is read
 * from the same line or the next few: `curl -X`, `method: 'POST'` (fetch),
 * `requests.post(` (Python) or an HTTP request line (`POST /api/...`); a
 * bare `curl` is a GET, or a POST when it sends data.
 */

export const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const
export type HttpMethod = (typeof HTTP_METHODS)[number]

export interface ApiCall {
  /** Path relative to `/api`, as written (`/crm/workflows/<token>/trigger`). */
  path: string
  method: HttpMethod | null
  /**
   * `true` when the path ends in `/...` (`/api/workspaces/<id>/...`): it
   * names a family of routes and only needs to be the start of one.
   */
  prefix: boolean
  /** 1-based line of the page where the path appears. */
  line: number
}

// `/api` followed by segments; `/dev/api` (the reference page) is not a call.
const API_PATH = /(?<!\/dev)\/api((?:\/[A-Za-z0-9_\-.{}<>$:]+)+)/g

const METHOD = HTTP_METHODS.join('|')
/** `POST /api/...`, `POST https://host/api/...`, `` `POST $URL/api/... ``. */
const REQUEST_LINE = new RegExp(`(?:^|[\\s\`|(])(${METHOD})\\s+[^\\s\`]*$`)
const NEARBY = [
  new RegExp(`(?:-X|--request)\\s+(${METHOD})\\b`),
  new RegExp(`method:\\s*['"](${METHOD})['"]`, 'i'),
  new RegExp(`requests\\.(${METHOD.toLowerCase()})\\(`),
]
/** How many lines after the path a fetch/curl option may sit. */
const LOOKAHEAD = 4

function methodIn(line: string, patterns: RegExp[]): HttpMethod | null {
  for (const pattern of patterns) {
    const match = pattern.exec(line)
    if (match) return match[1].toUpperCase() as HttpMethod
  }
  return null
}

function detectMethod(
  lines: string[],
  index: number,
  column: number,
): HttpMethod | null {
  // A method written right before this very path wins: a table cell can
  // hold `GET /api/a` and `POST /api/b` on the same line.
  const own = methodIn(lines[index].slice(0, column), [REQUEST_LINE])
  if (own) return own

  const window = lines.slice(Math.max(0, index - 1), index + 1 + LOOKAHEAD)
  for (const line of window) {
    const found = methodIn(line, NEARBY)
    if (found) return found
  }

  const text = window.join('\n')
  if (/\bcurl\b/.test(text)) {
    return /(?:^|\s)(?:-d|--data(?:-raw|-binary)?|--json)\s/.test(text)
      ? 'POST'
      : 'GET'
  }
  if (/\bfetch\(/.test(text)) return 'GET'
  return null
}

/** Every `/api/...` call in a guide's source, in order. */
export function extractApiCalls(source: string): ApiCall[] {
  const lines = source.split('\n')
  const calls: ApiCall[] = []
  lines.forEach((line, index) => {
    for (const match of line.matchAll(API_PATH)) {
      const raw = match[1]
      const prefix = raw.endsWith('/...')
      // Sentence punctuation right after a path is not part of it.
      const path = prefix ? raw.slice(0, -4) : raw.replace(/[.:]+$/, '')
      calls.push({
        path,
        method: detectMethod(lines, index, match.index),
        prefix,
        line: index + 1,
      })
    }
  })
  return calls
}

/** `/crm/forms/{publicToken}/submit` → a regex for concrete paths. */
export function specPathPattern(template: string): RegExp {
  const pattern = template
    .split(/(\{[^}]+\})/)
    .map((part) =>
      part.startsWith('{')
        ? '[^/]+'
        : part.replace(/[.*+?^$()|[\]\\]/g, '\\$&'),
    )
    .join('')
  return new RegExp(`^${pattern}$`)
}

type SpecPaths = Record<string, Record<string, unknown>>

export interface SpecMatch {
  /** The spec path the call resolved to. */
  template: string
  /** Methods the spec documents for it (upper case). */
  methods: HttpMethod[]
}

/**
 * The spec path a call resolves to. Literal templates win over templated
 * ones (`/crm/leads/reorder` before `/crm/leads/{leadId}`).
 */
export function matchSpecPath(
  paths: SpecPaths,
  path: string,
): SpecMatch | null {
  const template = Object.keys(paths)
    .filter((candidate) => specPathPattern(candidate).test(path))
    .sort(
      (a, b) =>
        (a.match(/\{/g)?.length ?? 0) - (b.match(/\{/g)?.length ?? 0) ||
        a.localeCompare(b),
    )[0]
  if (!template) return null
  const methods = Object.keys(paths[template])
    .map((method) => method.toUpperCase())
    .filter((method): method is HttpMethod =>
      (HTTP_METHODS as readonly string[]).includes(method),
    )
  return { template, methods }
}

const isPlaceholder = (segment: string) => /[<>${}]/.test(segment)

/**
 * For a `/...` call: the first spec path (alphabetically) that continues the
 * prefix — same literal segments, any value where either side has a
 * placeholder.
 */
export function matchSpecPrefix(
  paths: SpecPaths,
  prefix: string,
): string | null {
  const segments = prefix.split('/')
  return (
    Object.keys(paths)
      .sort()
      .find((template) => {
        const parts = template.split('/')
        if (parts.length <= segments.length) return false
        return segments.every(
          (segment, index) =>
            segment === parts[index] ||
            isPlaceholder(segment) ||
            isPlaceholder(parts[index]),
        )
      }) ?? null
  )
}
