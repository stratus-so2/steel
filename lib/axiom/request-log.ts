import { EVENT, type Logger } from '@axiomhq/logging'
import type { GeoLocation } from '@/src/lib/analytics/geoip'
import type { RequestContext } from '@/src/lib/analytics/request-context'
import {
  normalizeRoute,
  workspaceIdFromApiPath,
  workspaceSlugFromPath,
} from '@/src/lib/analytics/route'
import { scrubMessage } from '@/src/lib/analytics/scrub'
import { parseUserAgent } from '@/src/lib/analytics/user-agent'

/**
 * Evento de log de uma requisição (Axiom), no lugar do transform padrão do
 * `@axiomhq/nextjs`. Mantém os campos que o painel Analytics consulta
 * (`request.path`, `request.method`, `request.statusCode`,
 * `request.startTime`/`endTime`) e acrescenta:
 *
 * - `request.route` — path normalizado (`/api/workspaces/[id]/crm/leads`);
 * - `request.userId`/`workspaceId`/`workspaceSlug` — usuários e workspaces
 *   únicos (ids internos, sem e-mail/nome);
 * - `request.errorCode`/`errorMessage` — erro de domínio da resposta, com a
 *   mensagem limpa (sem e-mail/IP/documentos) e truncada;
 * - `request.country`/`countryCode`/`city` (GeoLite2) e
 *   `request.browser`/`os`/`device` (família do User-Agent).
 *
 * LGPD: o IP e o User-Agent cru **não** vão para o log (o transform padrão
 * gravava os dois). O IP só é lido em memória para o país/cidade.
 */

export interface RequestLogInput {
  method: string
  url: string
  headers: Headers
  statusCode?: number
  startTime?: number
  endTime?: number
  context?: RequestContext
  geo?: GeoLocation | null
  error?: unknown
}

type RequestLogLevel = 'info' | 'warn' | 'error'

export function levelForStatus(status: number | undefined): RequestLogLevel {
  if (status === undefined || status < 400) return 'info'
  return status < 500 ? 'warn' : 'error'
}

function refererHost(headers: Headers): string | undefined {
  const referer = headers.get('referer')
  if (!referer) return undefined
  try {
    return new URL(referer).host || undefined
  } catch {
    return undefined
  }
}

/** Remove chaves `undefined` para não poluir o dataset com colunas vazias. */
function compact<T extends Record<string, unknown>>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, v]) => v !== undefined && v !== null),
  ) as Partial<T>
}

export function buildRequestLog(
  input: RequestLogInput,
  source: 'lambda' | 'middleware',
): [message: string, report: Record<string | symbol, unknown>] {
  const url = new URL(input.url)
  const path = url.pathname
  const client = parseUserAgent(input.headers.get('user-agent'))
  const context = input.context ?? {}
  const thrown =
    input.error instanceof Error
      ? {
          errorCode: context.errorCode ?? input.error.name ?? 'Error',
          errorMessage: scrubMessage(
            context.errorMessage ?? input.error.message,
          ),
        }
      : {}

  const duration =
    input.startTime !== undefined && input.endTime !== undefined
      ? input.endTime - input.startTime
      : undefined

  const request = compact({
    startTime: input.startTime,
    endTime: input.endTime,
    durationMs: duration,
    path,
    route: normalizeRoute(path),
    method: input.method,
    host: url.host,
    scheme: url.protocol.replace(':', ''),
    statusCode: input.statusCode,
    refererHost: refererHost(input.headers),
    userId: context.userId,
    workspaceId: context.workspaceId ?? workspaceIdFromApiPath(path),
    workspaceSlug: workspaceSlugFromPath(path),
    errorCode: context.errorCode,
    errorMessage: scrubMessage(context.errorMessage),
    ...thrown,
    country: input.geo?.country,
    countryCode: input.geo?.countryCode,
    city: input.geo?.city,
    browser: client.browser,
    os: client.os,
    device: client.device,
  })

  const message =
    source === 'middleware'
      ? `${input.method} ${path}`
      : `${input.method} ${path} ${input.statusCode} in ${duration ?? 0}ms`

  return [message, { [EVENT]: { request, source } }]
}

/** Grava o evento com o nível pelo status (4xx = warn, 5xx = error). */
export function logRequest(
  logger: Pick<Logger, 'log'>,
  input: RequestLogInput,
  source: 'lambda' | 'middleware',
): void {
  const [message, report] = buildRequestLog(input, source)
  logger.log(levelForStatus(input.statusCode) as never, message, report)
}
