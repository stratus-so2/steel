/**
 * Limpeza de PII em tudo que o Sentry está a ponto de enviar.
 *
 * Um evento do Sentry é muito mais rico que uma linha de log — envelope da
 * requisição, objeto do usuário, breadcrumbs, mensagem da exceção — então
 * mascarar e-mail e token é o piso, não o teto: o evento perde cookies,
 * cabeçalhos de autorização, corpo da requisição e todo parâmetro de query
 * com cara de segredo antes de sair do processo.
 *
 * Tudo abaixo é escrito contra um subconjunto **estrutural** do `Event` do
 * Sentry, para poder ser testado sem subir o SDK.
 */

const REDACTED = '[redacted]'

/**
 * Cabeçalhos que carregam credencial. Comparados sem diferenciar maiúsculas,
 * já que o bag de headers chega grafado como o cliente mandou.
 */
const SENSITIVE_HEADERS = new Set([
  'authorization',
  'cookie',
  'proxy-authorization',
  'set-cookie',
  'www-authenticate',
  'x-api-key',
  'x-auth-token',
  'x-csrf-token',
  'x-forwarded-authorization',
  'x-hub-signature-256',
  'x-session-token',
  'x-slack-signature',
  'x-status-secret',
])

/**
 * Parâmetros de query que carregam credencial. `token` sozinho já cobre os
 * que este app realmente coloca numa URL (reset de senha, verificação de
 * e-mail, convite, aprovação de chamado do ServiceDesk, descadastro LGPD);
 * o resto são os suspeitos habituais de OAuth e webhook.
 */
const SENSITIVE_QUERY_KEYS =
  /^(access_token|api_key|apikey|auth|code|id_token|key|otp|password|pwd|refresh_token|secret|session|signature|sig|state|token)$/i

/** Mascara e-mail, credencial embutida em URL, Bearer e JWT. */
export function maskSensitiveText(text: string): string {
  return text
    .replace(/https?:\/\/hooks\.slack\.com\/\S*/g, '[webhook]')
    .replace(/([a-z][a-z0-9+.-]*:\/\/)[^\s/@]+@/gi, `$1${REDACTED}@`)
    .replace(/\bBearer\s+\S+/gi, `Bearer ${REDACTED}`)
    .replace(/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[jwt]')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email]')
}

/** Troca o valor dos parâmetros com cara de segredo numa query string. */
export function maskQueryString(query: string): string {
  if (!query) return query
  const leading = query.startsWith('?') ? '?' : ''
  return (
    leading +
    query
      .slice(leading.length)
      .split('&')
      .map((pair) => {
        const separator = pair.indexOf('=')
        if (separator === -1) return pair
        const name = pair.slice(0, separator)
        return SENSITIVE_QUERY_KEYS.test(decodeURIComponent(name))
          ? `${name}=${REDACTED}`
          : pair
      })
      .join('&')
  )
}

/** Mascara credenciais numa URL: userinfo e parâmetros secretos. */
export function maskUrl(url: string): string {
  const separator = url.indexOf('?')
  const withoutQuery = separator === -1 ? url : url.slice(0, separator)
  const query = separator === -1 ? '' : url.slice(separator)
  return maskSensitiveText(withoutQuery) + maskQueryString(query)
}

interface EventLike {
  user?: { id?: string | number; [key: string]: unknown } | null | undefined
  message?: string | { message?: string; formatted?: string }
  request?: {
    url?: string
    query_string?: string | Record<string, string> | [string, string][]
    cookies?: unknown
    data?: unknown
    headers?: Record<string, string> | null
    env?: unknown
    [key: string]: unknown
  } | null
  exception?: {
    values?: { value?: string; type?: string; [key: string]: unknown }[]
  } | null
  breadcrumbs?: {
    message?: string
    data?: Record<string, unknown> | null
    [key: string]: unknown
  }[]
  [key: string]: unknown
}

function maskHeaders(headers: Record<string, string>): Record<string, string> {
  const safe: Record<string, string> = {}
  for (const [name, value] of Object.entries(headers)) {
    safe[name] = SENSITIVE_HEADERS.has(name.toLowerCase())
      ? REDACTED
      : maskSensitiveText(String(value))
  }
  return safe
}

function maskQuery(query: NonNullable<EventLike['request']>['query_string']) {
  if (typeof query === 'string') return maskQueryString(query)
  if (Array.isArray(query)) {
    return query.map(([name, value]) =>
      SENSITIVE_QUERY_KEYS.test(name)
        ? ([name, REDACTED] as [string, string])
        : ([name, maskSensitiveText(value)] as [string, string]),
    )
  }
  if (query && typeof query === 'object') {
    return Object.fromEntries(
      Object.entries(query).map(([name, value]) => [
        name,
        SENSITIVE_QUERY_KEYS.test(name)
          ? REDACTED
          : maskSensitiveText(String(value)),
      ]),
    )
  }
  return query
}

/**
 * Reduz o evento ao que estamos dispostos a armazenar.
 *
 * Muta e devolve o evento, que é o contrato do `beforeSend`. Nunca devolve
 * `null`: descartar evento em silêncio faria o Sentry mentir sobre a saúde da
 * produção. O parâmetro fica genérico e é estreitado por dentro, então a
 * função entra direto no `beforeSend` sem repetir o tipo `Event` do SDK.
 */
export function scrubEvent<T>(value: T): T {
  const event = value as EventLike

  // Identidade: o id do usuário e nada mais — o mesmo campo que o
  // `auditMutation` grava como `actorId`. `sendDefaultPii: false` já mantém o
  // IP fora, mas uma integração pode ter posto nome ou e-mail no escopo.
  if (event.user) {
    const id = event.user.id
    event.user = id === undefined || id === null ? null : { id }
  }

  const request = event.request
  if (request) {
    // Corpo é onde moram as credenciais: payload de login, reset de senha, o
    // código do segundo fator. Não existe versão do corpo que a gente queira
    // no Sentry.
    request.data = undefined
    request.cookies = undefined
    request.env = undefined
    if (request.headers) request.headers = maskHeaders(request.headers)
    if (typeof request.url === 'string') request.url = maskUrl(request.url)
    if (request.query_string !== undefined) {
      request.query_string = maskQuery(request.query_string)
    }
  }

  if (typeof event.message === 'string') {
    event.message = maskSensitiveText(event.message)
  } else if (event.message && typeof event.message === 'object') {
    if (event.message.message) {
      event.message.message = maskSensitiveText(event.message.message)
    }
    if (event.message.formatted) {
      event.message.formatted = maskSensitiveText(event.message.formatted)
    }
  }

  for (const exception of event.exception?.values ?? []) {
    if (typeof exception.value === 'string') {
      exception.value = maskSensitiveText(exception.value)
    }
  }

  for (const breadcrumb of event.breadcrumbs ?? []) {
    if (typeof breadcrumb.message === 'string') {
      breadcrumb.message = maskSensitiveText(breadcrumb.message)
    }
    const url = breadcrumb.data?.url
    if (typeof url === 'string' && breadcrumb.data) {
      breadcrumb.data.url = maskUrl(url)
    }
  }

  return value
}

interface BreadcrumbLike {
  category?: string
  message?: string
  data?: Record<string, unknown> | null
}

/**
 * `beforeBreadcrumb`: mascara o que o breadcrumb carrega antes de ele ser
 * anexado a um evento. Os crumbs de fetch/XHR são os mais propensos a levar
 * um segredo, e levam na url.
 */
export function scrubBreadcrumb<T>(value: T): T | null {
  const breadcrumb = value as BreadcrumbLike
  const url = breadcrumb.data?.url
  if (typeof url === 'string' && breadcrumb.data) {
    breadcrumb.data.url = maskUrl(url)
  }
  if (typeof breadcrumb.message === 'string') {
    breadcrumb.message = maskSensitiveText(breadcrumb.message)
  }
  return value
}
