import { z } from 'zod'
import { type AppError, validationError } from '@/src/errors/app-error'
import { err, ok, type Result } from '@/src/lib/result'
import { escapeSdHtmlText, sdHtmlToText } from '@/src/lib/servicedesk/html'
import { WorkspaceRepository } from '@/src/repositories/workspace.repository'
import { SdConfigService } from '@/src/services/sd-config.service'
import type {
  SdAgentDTO,
  SdCategoryDTO,
  SdCategoryTreeDTO,
  SdConfigBootstrapDTO,
  SdDepartmentDTO,
  SdPhaseDTO,
} from '@/types/sd-config'
import type { SdTicketDTO, SdTicketTypeDTO } from '@/types/sd-ticket'
import type { AiToolContext } from '../types'

/**
 * Helpers shared by the ServiceDesk Steel AI tools: argument parsing,
 * deep links, compact DTOs for the model and name → id resolution (the
 * model usually knows "Rede" or "Maria", not cuid2 ids).
 */

export const DEFAULT_LIMIT = 20
export const MAX_LIMIT = 50
export const SD_MODULE = 'SERVICE_DESK' as const

export function zodParser<T>(schema: z.ZodType<T>) {
  return (args: Record<string, unknown>): Result<T> => {
    const parsed = schema.safeParse(args ?? {})
    if (parsed.success) return ok(parsed.data)
    return err(
      validationError(
        'Argumentos inválidos para a ferramenta',
        parsed.error.issues,
      ),
    )
  }
}

export const limitSchema = z.coerce
  .number()
  .int()
  .min(1)
  .max(MAX_LIMIT)
  .default(DEFAULT_LIMIT)

export const pageSchema = z.coerce.number().int().min(1).max(1000).default(1)

export const limitParameter = {
  type: 'integer',
  minimum: 1,
  maximum: MAX_LIMIT,
  description: `Quantidade máxima de itens (padrão ${DEFAULT_LIMIT}, máximo ${MAX_LIMIT}).`,
}

export const pageParameter = {
  type: 'integer',
  minimum: 1,
  description: 'Página (começa em 1).',
}

/** Text the model writes (a name, a ref, a title). */
export const refSchema = z.string().trim().min(1).max(200)

export const ticketRefParameter = {
  type: 'string',
  description:
    'Chamado: código (INC-000123), número (123 ou #123) ou id interno.',
}

/* ------------------------------ practices ------------------------------- */

export const SD_TICKET_TYPES = [
  'INCIDENT',
  'SERVICE_REQUEST',
  'CHANGE',
  'PROBLEM',
] as const

const PRACTICE_ALIASES: Record<string, SdTicketTypeDTO> = {
  incident: 'INCIDENT',
  incidente: 'INCIDENT',
  request: 'SERVICE_REQUEST',
  service_request: 'SERVICE_REQUEST',
  requisicao: 'SERVICE_REQUEST',
  requisição: 'SERVICE_REQUEST',
  change: 'CHANGE',
  mudanca: 'CHANGE',
  mudança: 'CHANGE',
  problem: 'PROBLEM',
  problema: 'PROBLEM',
}

/** Accepts the enum or a friendly alias (incident, request, change…). */
export const practiceSchema = z.preprocess(
  (value) =>
    typeof value === 'string'
      ? (PRACTICE_ALIASES[value.trim().toLowerCase()] ??
        value.trim().toUpperCase())
      : value,
  z.enum(SD_TICKET_TYPES),
)

export const practiceParameter = {
  type: 'string',
  enum: ['incident', 'request', 'change', 'problem'],
  description:
    'Prática ITIL: incident (incidente), request (requisição de serviço), change (mudança) ou problem (problema).',
}

export const PRACTICE_LABELS: Record<SdTicketTypeDTO, string> = {
  INCIDENT: 'Incidente',
  SERVICE_REQUEST: 'Requisição',
  CHANGE: 'Mudança',
  PROBLEM: 'Problema',
}

/* ------------------------------- deep links ------------------------------ */

/** `/<slug>/servicedesk` — base of every deep link. */
export async function sdBasePath(ctx: AiToolContext): Promise<Result<string>> {
  const workspace = await WorkspaceRepository.findById(ctx.workspaceId)
  if (!workspace.ok) return workspace
  return ok(`/${workspace.value.slug}/servicedesk`)
}

export const sdHref = {
  ticket: (base: string, number: number) => `${base}/tickets/${number}`,
  article: (base: string, id: string) => `${base}/knowledge/${id}`,
  page: (
    base: string,
    page: 'customers' | 'companies' | 'contacts' | 'config-items' | 'risk',
  ) => `${base}/${page}`,
}

/* --------------------------------- text --------------------------------- */

export function clip(value: string | null | undefined, max: number) {
  if (!value) return null
  return value.length > max ? `${value.slice(0, max)}…` : value
}

/** Plain text of the sanitized description HTML, clipped. */
export function htmlText(html: string | null | undefined, max: number) {
  if (!html) return null
  return clip(sdHtmlToText(html), max)
}

/** Model text → HTML paragraphs (the ticket description is rich text). */
export function textToSdHtml(value: string): string {
  return value
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => `<p>${escapeSdHtmlText(block).replace(/\n/g, '<br>')}</p>`)
    .join('')
}

/* ------------------------------ compact DTOs ----------------------------- */

export function compactTicket(t: SdTicketDTO, base: string) {
  return {
    id: t.id,
    code: t.code,
    type: t.type,
    title: t.title,
    phase: t.phase.name,
    phaseCategory: t.phase.category,
    priority: t.priority?.name ?? null,
    assignee: t.assignee?.name ?? null,
    department: t.department?.name ?? null,
    requester: t.requester?.name ?? t.contact?.name ?? null,
    customer: t.customer?.name ?? t.company?.name ?? null,
    sla: {
      firstResponse: t.sla.firstResponse.state,
      resolution: t.sla.resolution.state,
      resolutionDueAt: t.resolutionDueAt,
    },
    risk: t.risk ? { level: t.risk.level, score: t.risk.score } : null,
    createdAt: t.createdAt,
    href: sdHref.ticket(base, t.number),
  }
}

/* ---------------------------- name resolution ---------------------------- */

export interface Named {
  id: string
  name: string
  /** Extra exact matches (e-mail, code…). */
  aliases?: (string | null | undefined)[]
}

export function normalizeName(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase()
}

function ambiguous(label: string, input: string, matches: Named[]): AppError {
  const options = matches
    .slice(0, 5)
    .map((m) => `${m.name} (id ${m.id})`)
    .join('; ')
  return validationError(
    `"${input}" é ambíguo para ${label}: ${options}. Informe o id.`,
    {
      candidates: matches.slice(0, 10).map((m) => ({ id: m.id, name: m.name })),
    },
  )
}

/**
 * All the items a text points to: exact id, then exact name/alias
 * (accent/case-insensitive), then substring. Empty = nothing found.
 */
export function matchNamed<T extends Named>(items: T[], input: string): T[] {
  const byId = items.filter((i) => i.id === input)
  if (byId.length > 0) return byId
  const needle = normalizeName(input)
  const exact = items.filter(
    (i) =>
      normalizeName(i.name) === needle ||
      (i.aliases ?? []).some((a) => a && normalizeName(a) === needle),
  )
  if (exact.length > 0) return exact
  return items.filter((i) => normalizeName(i.name).includes(needle))
}

/** One item or a pt-BR error (not found / ambiguous with candidates). */
export function resolveNamed<T extends Named>(
  items: T[],
  input: string,
  label: string,
): Result<T> {
  const matches = matchNamed(items, input)
  if (matches.length === 1) return ok(matches[0])
  if (matches.length === 0) {
    return err(validationError(`Não encontrei ${label} "${input}"`))
  }
  return err(ambiguous(label, input, matches))
}

/* ------------------------------ configuration ---------------------------- */

/** Everything the ticket UI uses (scales, phases, catalog, departments). */
export function loadSdConfig(
  ctx: AiToolContext,
): Promise<Result<SdConfigBootstrapDTO>> {
  return SdConfigService.bootstrap(ctx.actorId, ctx.workspaceId)
}

export function flattenDepartments(
  config: SdConfigBootstrapDTO,
): SdDepartmentDTO[] {
  return config.departments.flatMap(({ children, ...root }) => [
    root,
    ...children,
  ])
}

export interface SdCatalogEntry extends SdCategoryDTO {
  /** "Rede > Wi-Fi > Configurar acesso". */
  path: string
  categoryId: string
  subcategoryId: string | null
  serviceId: string | null
}

/** Catalog tree flattened with the path and the ids of each level. */
export function flattenCatalog(config: SdConfigBootstrapDTO): SdCatalogEntry[] {
  const out: SdCatalogEntry[] = []
  const walk = (
    nodes: SdCategoryTreeDTO[],
    trail: SdCategoryTreeDTO[],
  ): void => {
    for (const { children, ...node } of nodes) {
      const chain = [...trail, { ...node, children }]
      out.push({
        ...node,
        path: chain.map((c) => c.name).join(' > '),
        categoryId: chain[0].id,
        subcategoryId: chain.length > 1 ? chain[1].id : null,
        serviceId: chain.length > 2 ? chain[2].id : null,
      })
      walk(children, chain)
    }
  }
  walk(config.categories, [])
  return out
}

export function phasesOf(
  config: SdConfigBootstrapDTO,
  type: SdTicketTypeDTO,
): SdPhaseDTO[] {
  return config.phases.find((f) => f.ticketType === type)?.phases ?? []
}

/** Agents (or every member) as nameable items; `me` resolves to the actor. */
export function agentItems(agents: SdAgentDTO[]): (SdAgentDTO & Named)[] {
  return agents.map((a) => ({ ...a, aliases: [a.email] }))
}

export function resolveUser(
  ctx: AiToolContext,
  agents: SdAgentDTO[],
  input: string,
  label: string,
): Result<SdAgentDTO> {
  if (normalizeName(input) === 'me' || normalizeName(input) === 'eu') {
    const me = agents.find((a) => a.id === ctx.actorId)
    if (me) return ok(me)
    return err(validationError(`Você não está na lista de ${label}`))
  }
  return resolveNamed(agentItems(agents), input, label)
}

/** cuid2-looking text: used as an id without a lookup by name. */
export function looksLikeId(value: string): boolean {
  return /^[a-z0-9]{20,40}$/.test(value)
}

/** Text of a preview field (`null` stays empty). */
export function show(value: string | number | boolean | null | undefined) {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não'
  return String(value)
}
