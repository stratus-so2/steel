import type { ModuleKind } from '@prisma/client'
import { logger } from '@/lib/axiom/logger'
import { ensureRedisConnected } from '../redis'

/**
 * Contagem leve de uso por módulo, sem tocar nos services: o `withAxiom`
 * (lib/axiom/server.ts) chama `recordModuleUsage` depois de cada resposta
 * de rota, e só as rotas `/api/workspaces/:id/{crm,whatsapp}/**` com status
 * < 400 contam — uma resposta de sucesso ali implica sessão válida e
 * associação ao workspace (a autorização é do service), então o id no path é
 * confiável. O contador vive num hash do Redis por dia (HINCRBY, O(1), sem
 * escrita no Postgres por requisição); o job `usage-rollup` do worker copia
 * os totais para `module_usage_daily`.
 */

export const USAGE_TIMEZONE = 'America/Sao_Paulo'
/** Hashes sobrevivem alguns dias para o rollup recuperar o worker parado. */
export const USAGE_KEY_TTL_SECONDS = 8 * 24 * 60 * 60
export const USAGE_KEY_PREFIX = 'usage:module:'

const MODULE_BY_SEGMENT: Record<string, ModuleKind> = {
  crm: 'CRM',
  whatsapp: 'COMMUNICATION',
}

const MODULE_API_PATH = /^\/api\/workspaces\/([^/]+)\/(crm|whatsapp)(?:\/|$)/

const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

export interface ModuleApiTarget {
  workspaceId: string
  module: ModuleKind
}

export function parseModuleApiPath(pathname: string): ModuleApiTarget | null {
  const match = MODULE_API_PATH.exec(pathname)
  if (!match) return null
  return { workspaceId: match[1], module: MODULE_BY_SEGMENT[match[2]] }
}

export function isMutationMethod(method: string): boolean {
  return !READ_METHODS.has(method.toUpperCase())
}

const dayFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: USAGE_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/** Data `YYYY-MM-DD` no fuso de São Paulo. */
export function usageDay(date: Date): string {
  return dayFormatter.format(date)
}

/** Os `count` dias até `now` (inclusive), do mais antigo ao mais recente. */
export function recentUsageDays(now: Date, count: number): string[] {
  return Array.from({ length: count }, (_, i) =>
    usageDay(new Date(now.getTime() - (count - 1 - i) * 86_400_000)),
  )
}

export function usageKey(day: string): string {
  return `${USAGE_KEY_PREFIX}${day}`
}

type CounterKind = 'r' | 'w'

export function usageField(target: ModuleApiTarget, kind: CounterKind): string {
  return `${target.workspaceId}|${target.module}|${kind}`
}

export interface ModuleUsageCounter {
  workspaceId: string
  module: ModuleKind
  requests: number
  mutations: number
}

/** Hash do Redis de um dia → um contador por workspace × módulo. */
export function parseUsageHash(
  hash: Record<string, string>,
): ModuleUsageCounter[] {
  const byTarget = new Map<string, ModuleUsageCounter>()
  for (const [field, raw] of Object.entries(hash)) {
    const [workspaceId, module, kind] = field.split('|')
    if (!workspaceId || (kind !== 'r' && kind !== 'w')) continue
    if (module !== 'CRM' && module !== 'COMMUNICATION') continue
    const value = Number.parseInt(raw, 10)
    if (!Number.isFinite(value)) continue

    const id = `${workspaceId}|${module}`
    const counter = byTarget.get(id) ?? {
      workspaceId,
      module,
      requests: 0,
      mutations: 0,
    }
    if (kind === 'r') counter.requests = value
    else counter.mutations = value
    byTarget.set(id, counter)
  }
  return [...byTarget.values()]
}

/** Nunca lança: contagem de uso não pode derrubar a resposta da rota. */
export async function recordModuleUsage(
  request: { pathname: string; method: string; status: number },
  now: Date = new Date(),
): Promise<void> {
  if (request.status >= 400) return
  const target = parseModuleApiPath(request.pathname)
  if (!target) return

  const key = usageKey(usageDay(now))
  try {
    const client = await ensureRedisConnected()
    const tx = client.multi().hIncrBy(key, usageField(target, 'r'), 1)
    if (isMutationMethod(request.method)) {
      tx.hIncrBy(key, usageField(target, 'w'), 1)
    }
    await tx.expire(key, USAGE_KEY_TTL_SECONDS).exec()
  } catch (cause) {
    logger.warn('usage.module.record_failed', {
      component: 'ModuleUsage',
      message: cause instanceof Error ? cause.message : String(cause),
    })
  }
}

/** Contadores gravados no Redis para um dia (vazio se o hash expirou). */
export async function readModuleUsageDay(
  day: string,
): Promise<ModuleUsageCounter[]> {
  const client = await ensureRedisConnected()
  return parseUsageHash(await client.hGetAll(usageKey(day)))
}
