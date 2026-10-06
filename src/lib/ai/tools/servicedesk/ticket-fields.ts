import { sdTicketClosed, validationError } from '@/src/errors/app-error'
import { err, ok, type Result } from '@/src/lib/result'
import { SdTicketService } from '@/src/services/sd-ticket.service'
import type { SdConfigBootstrapDTO } from '@/types/sd-config'
import type { SdTicketDTO, SdTicketTypeDTO } from '@/types/sd-ticket'
import type { AiToolPreviewDTO } from '@/types/steel-ai'
import type { AiToolContext } from '../types'
import {
  flattenCatalog,
  normalizeName,
  resolveNamed,
  type SdCatalogEntry,
  sdBasePath,
  sdHref,
  show,
} from './shared'

/**
 * Ticket helpers for the write tools: loading the ticket the model named,
 * resolving classification names (impact, urgency, priority, catalog…) to
 * ids, and building the preview lines the human confirms.
 */

export type PreviewField = NonNullable<AiToolPreviewDTO['fields']>[number]

export interface LoadedTicket {
  ticket: SdTicketDTO
  href: string
}

export async function loadTicket(
  ctx: AiToolContext,
  ref: string,
): Promise<Result<LoadedTicket>> {
  const ticket = await SdTicketService.get(ctx.actorId, ctx.workspaceId, ref)
  if (!ticket.ok) return ticket
  const base = await sdBasePath(ctx)
  if (!base.ok) return base
  return ok({
    ticket: ticket.value,
    href: sdHref.ticket(base.value, ticket.value.number),
  })
}

export function ticketTarget({ ticket, href }: LoadedTicket) {
  return { type: 'sd_ticket', id: ticket.id, label: ticket.code, href }
}

/* ----------------------------- classification ---------------------------- */

export interface ClassificationArgs {
  impact?: string
  urgency?: string
  priority?: string
  severity?: string
  category?: string
  subcategory?: string
  service?: string
}

export interface ResolvedClassification {
  ids: Partial<
    Record<
      | 'impactId'
      | 'urgencyId'
      | 'priorityId'
      | 'severityId'
      | 'categoryId'
      | 'subcategoryId'
      | 'serviceId',
      string | null
    >
  >
  /** Display values for the preview, by field. */
  labels: Partial<Record<string, string | null>>
}

const CATALOG_LEVELS = [
  { key: 'service', level: 'SERVICE', label: 'o serviço' },
  { key: 'subcategory', level: 'SUBCATEGORY', label: 'a subcategoria' },
  { key: 'category', level: 'CATEGORY', label: 'a categoria' },
] as const

/** Deepest catalog level given wins; shallower names narrow the match. */
function resolveCatalog(
  config: SdConfigBootstrapDTO,
  type: SdTicketTypeDTO,
  args: ClassificationArgs,
): Result<SdCatalogEntry | null> {
  const deepest = CATALOG_LEVELS.find((l) => args[l.key])
  if (!deepest) return ok(null)
  const input = args[deepest.key] as string
  const narrowing = CATALOG_LEVELS.filter(
    (l) => l.key !== deepest.key && args[l.key],
  ).map((l) => normalizeName(args[l.key] as string))

  const entries = flattenCatalog(config)
    .filter((e) => e.level === deepest.level && e.active)
    .filter((e) => e.ticketTypes.length === 0 || e.ticketTypes.includes(type))
    .filter((e) => narrowing.every((n) => normalizeName(e.path).includes(n)))
    .map((e) => ({ ...e, aliases: [e.path] }))
  const found = resolveNamed(entries, input, deepest.label)
  if (!found.ok) return found
  return ok(found.value)
}

/**
 * Resolves the classification names for a ticket of `type`. `current`
 * (update) supplies impact/urgency when only one of them changes, so the
 * preview can show the priority the matrix will pick.
 */
export function resolveClassification(
  config: SdConfigBootstrapDTO,
  type: SdTicketTypeDTO,
  args: ClassificationArgs,
  current?: SdTicketDTO,
): Result<ResolvedClassification> {
  const out: ResolvedClassification = { ids: {}, labels: {} }
  const scales = [
    ['impact', 'impactId', config.impacts, 'o impacto'],
    ['urgency', 'urgencyId', config.urgencies, 'a urgência'],
    ['priority', 'priorityId', config.priorities, 'a prioridade'],
    ['severity', 'severityId', config.severities, 'a severidade'],
  ] as const
  for (const [key, idKey, items, label] of scales) {
    const input = args[key]
    if (!input) continue
    const found = resolveNamed(items, input, label)
    if (!found.ok) return found
    out.ids[idKey] = found.value.id
    out.labels[key] = found.value.name
  }

  // Impact × urgency → priority (the engine applies the same matrix).
  if (!args.priority && (out.ids.impactId || out.ids.urgencyId)) {
    const impactId = out.ids.impactId ?? current?.impact?.id
    const urgencyId = out.ids.urgencyId ?? current?.urgency?.id
    const cell = config.priorityMatrix.find(
      (c) => c.impactId === impactId && c.urgencyId === urgencyId,
    )
    const priority = cell
      ? config.priorities.find((p) => p.id === cell.priorityId)
      : undefined
    if (priority) {
      out.labels.priority = `${priority.name} (matriz impacto × urgência)`
    }
  }

  const catalog = resolveCatalog(config, type, args)
  if (!catalog.ok) return catalog
  if (catalog.value) {
    const entry = catalog.value
    out.ids.categoryId = entry.categoryId
    out.ids.subcategoryId = entry.subcategoryId
    out.ids.serviceId = entry.serviceId
    out.labels.catalog = entry.path
  }
  return ok(out)
}

/** Preview lines of custom fields, labelled by the field definitions. */
export function customFieldLines(
  config: SdConfigBootstrapDTO,
  values: Record<string, unknown> | undefined,
  current?: Record<string, unknown>,
): Result<PreviewField[]> {
  if (!values) return ok([])
  const lines: PreviewField[] = []
  for (const [key, value] of Object.entries(values)) {
    const def = config.customFields.find(
      (f) => f.key === key && f.entity === 'TICKET',
    )
    if (!def) {
      return err(validationError(`Campo customizado "${key}" não existe`))
    }
    lines.push({
      label: def.label,
      before: current ? stringify(current[key]) : undefined,
      after: stringify(value),
    })
  }
  return ok(lines)
}

function stringify(value: unknown): string | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'string') return value
  return JSON.stringify(value)
}

/** Closed/canceled tickets refuse messages, tasks and approvals. */
export function assertOpen(ticket: SdTicketDTO): Result<void> {
  const { category } = ticket.phase
  if (category === 'CLOSED' || category === 'CANCELED') {
    return err(sdTicketClosed())
  }
  return ok(undefined)
}

export async function loadOpenTicket(
  ctx: AiToolContext,
  ref: string,
): Promise<Result<LoadedTicket>> {
  const loaded = await loadTicket(ctx, ref)
  if (!loaded.ok) return loaded
  const open = assertOpen(loaded.value.ticket)
  if (!open.ok) return open
  return loaded
}

/** `before → after` line, omitted when nothing changes. */
export function changeLine(
  label: string,
  before: string | null | undefined,
  after: string | null | undefined,
): PreviewField[] {
  if ((before ?? null) === (after ?? null)) return []
  return [{ label, before: show(before), after: show(after) }]
}
