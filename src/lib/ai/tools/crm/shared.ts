import { z } from 'zod'
import {
  type AppError,
  appError,
  validationError,
} from '@/src/errors/app-error'
import { err, ok, type Result } from '@/src/lib/result'
import { CrmCompanyService } from '@/src/services/crm-company.service'
import { CrmMemberService } from '@/src/services/crm-member.service'
import { CrmPersonService } from '@/src/services/crm-person.service'
import {
  CrmPipelineService,
  CrmPipelineStageService,
} from '@/src/services/crm-pipeline.service'
import { WorkspaceService } from '@/src/services/workspace.service'
import type { CrmCompanyDTO } from '@/types/crm-company'
import type { CrmLeadStageDTO } from '@/types/crm-lead'
import type { CrmMemberDTO } from '@/types/crm-member'
import type { CrmPersonDTO } from '@/types/crm-person'
import type { CrmPipelineDTO, CrmPipelineStageDTO } from '@/types/crm-pipeline'
import type { AiToolPreviewDTO } from '@/types/steel-ai'
import type { AiToolContext } from '../types'

/** Shared building blocks of the CRM Steel AI tools. */

export const DEFAULT_LIMIT = 20
export const MAX_LIMIT = 50

/** Turns a Zod schema into a tool `parse` (VALIDATION_ERROR with issues). */
export function zodParser<S extends z.ZodType>(schema: S) {
  return (args: Record<string, unknown>): Result<z.output<S>> => {
    const parsed = schema.safeParse(args ?? {})
    if (parsed.success) return ok(parsed.data)
    return err(
      validationError(
        `Argumentos inválidos: ${parsed.error.issues
          .map(
            (i) => (i.path.length ? `${i.path.join('.')}: ` : '') + i.message,
          )
          .join('; ')}`,
        parsed.error.issues,
      ),
    )
  }
}

/* ------------------------------- pagination ------------------------------- */

/** `limit` above the cap is clamped (not rejected) — the model often asks for "all". */
export const pageSchema = {
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .default(DEFAULT_LIMIT)
    .transform((n) => Math.min(n, MAX_LIMIT)),
  offset: z.coerce.number().int().min(0).default(0),
}

export const pageParameters = {
  limit: {
    type: 'integer',
    minimum: 1,
    maximum: MAX_LIMIT,
    description: `Quantidade máxima de itens (padrão ${DEFAULT_LIMIT}, máximo ${MAX_LIMIT}).`,
  },
  offset: {
    type: 'integer',
    minimum: 0,
    description: 'Quantos itens pular, para paginar (padrão 0).',
  },
}

export interface Page<T> {
  total: number
  offset: number
  limit: number
  hasMore: boolean
  items: T[]
}

export function paginate<T, U>(
  items: readonly T[],
  page: { limit: number; offset: number },
  map: (item: T) => U,
): Page<U> {
  const slice = items.slice(page.offset, page.offset + page.limit)
  return {
    total: items.length,
    offset: page.offset,
    limit: page.limit,
    hasMore: page.offset + slice.length < items.length,
    items: slice.map(map),
  }
}

/* -------------------------------- matching -------------------------------- */

export function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()
}

/** Case/accent-insensitive "contains" over any of the given values. */
export function matchesQuery(
  query: string | undefined,
  values: ReadonlyArray<string | null | undefined>,
): boolean {
  if (!query) return true
  const needle = normalize(query)
  return values.some(
    (v) => typeof v === 'string' && normalize(v).includes(needle),
  )
}

interface ResolveOptions<T> {
  /** pt-BR noun used in messages, e.g. "etapa", "empresa". */
  label: string
  id: (item: T) => string
  name: (item: T) => string
  /** Extra exact-match keys (e-mails, CNPJ…). */
  keys?: (item: T) => ReadonlyArray<string | null | undefined>
  /** How a candidate is shown in an ambiguity message (default: name). */
  describe?: (item: T) => string
}

const MAX_CANDIDATES = 10

function candidates<T>(items: readonly T[], opts: ResolveOptions<T>) {
  return items.slice(0, MAX_CANDIDATES).map((item) => ({
    id: opts.id(item),
    name: (opts.describe ?? opts.name)(item),
  }))
}

function ambiguous<T>(
  input: string,
  matches: readonly T[],
  opts: ResolveOptions<T>,
): AppError {
  const list = candidates(matches, opts)
  return validationError(
    `Mais de um(a) ${opts.label} corresponde a "${input}": ${list
      .map((c) => `${c.name} (id ${c.id})`)
      .join(', ')}. Pergunte ao usuário qual é e informe o id.`,
    { ambiguous: true, candidates: list },
  )
}

/**
 * Resolves a model reference (id or name) to exactly one item. Order: exact
 * id → exact name/key → unique partial name. Never picks silently between
 * several matches: that is an error listing the candidates.
 */
export function resolveByName<T>(
  items: readonly T[],
  input: string,
  opts: ResolveOptions<T>,
): Result<T> {
  const byId = items.find((item) => opts.id(item) === input)
  if (byId) return ok(byId)

  const needle = normalize(input)
  const exact = items.filter(
    (item) =>
      normalize(opts.name(item)) === needle ||
      (opts.keys?.(item) ?? []).some(
        (k) => typeof k === 'string' && normalize(k) === needle,
      ),
  )
  if (exact.length === 1) return ok(exact[0])
  if (exact.length > 1) return err(ambiguous(input, exact, opts))

  const partial = items.filter((item) =>
    normalize(opts.name(item)).includes(needle),
  )
  if (partial.length === 1) return ok(partial[0])
  if (partial.length > 1) return err(ambiguous(input, partial, opts))

  const available = candidates(items, opts)
  return err(
    appError(
      'RESOURCE_NOT_FOUND',
      available.length
        ? `Nenhum(a) ${opts.label} corresponde a "${input}". Opções: ${available
            .map((c) => c.name)
            .join(', ')}${items.length > MAX_CANDIDATES ? '…' : ''}.`
        : `Nenhum(a) ${opts.label} corresponde a "${input}".`,
      { candidates: available },
    ),
  )
}

/* -------------------------------- members --------------------------------- */

const ME = new Set(['me', 'eu', 'mim'])

export const ownerParameter = {
  type: 'string',
  description:
    'Responsável: "me" (o próprio usuário), nome, e-mail ou id de um membro do workspace.',
}

export async function listMembers(
  ctx: AiToolContext,
): Promise<Result<CrmMemberDTO[]>> {
  return CrmMemberService.list(ctx.actorId, ctx.workspaceId)
}

/** id → display name; empty map when members can't be listed. */
export async function memberNames(
  ctx: AiToolContext,
): Promise<Map<string, string>> {
  const members = await listMembers(ctx)
  if (!members.ok) return new Map()
  return new Map(members.value.map((m) => [m.id, m.name || m.email]))
}

export async function resolveMember(
  ctx: AiToolContext,
  input: string,
): Promise<Result<CrmMemberDTO>> {
  const members = await listMembers(ctx)
  if (!members.ok) return members
  if (ME.has(normalize(input))) {
    const me = members.value.find((m) => m.id === ctx.actorId)
    if (me) return ok(me)
  }
  return resolveByName(members.value, input, {
    label: 'membro',
    id: (m) => m.id,
    name: (m) => m.name || m.email,
    keys: (m) => [m.email],
    describe: (m) => `${m.name || m.email} <${m.email}>`,
  })
}

/* -------------------------------- pipelines ------------------------------- */

export interface PipelineWithStages extends CrmPipelineDTO {
  stages: CrmPipelineStageDTO[]
}

export async function loadPipelines(
  ctx: AiToolContext,
): Promise<Result<PipelineWithStages[]>> {
  const pipelines = await CrmPipelineService.list(ctx.actorId, ctx.workspaceId)
  if (!pipelines.ok) return pipelines

  const withStages: PipelineWithStages[] = []
  for (const pipeline of pipelines.value) {
    const stages = await CrmPipelineStageService.list(
      ctx.actorId,
      ctx.workspaceId,
      pipeline.id,
    )
    if (!stages.ok) return stages
    withStages.push({
      ...pipeline,
      stages: [...stages.value].sort((a, b) => a.position - b.position),
    })
  }
  return ok(withStages)
}

export interface StageRef {
  pipeline: PipelineWithStages
  stage: CrmPipelineStageDTO
}

export function indexStages(
  pipelines: readonly PipelineWithStages[],
): Map<string, StageRef> {
  const index = new Map<string, StageRef>()
  for (const pipeline of pipelines) {
    for (const stage of pipeline.stages)
      index.set(stage.id, { pipeline, stage })
  }
  return index
}

export function resolvePipeline(
  pipelines: readonly PipelineWithStages[],
  input: string,
): Result<PipelineWithStages> {
  return resolveByName(pipelines, input, {
    label: 'pipeline',
    id: (p) => p.id,
    name: (p) => p.name,
  })
}

/**
 * Stage by id or name. With `pipeline`, only that pipeline's stages are
 * searched; otherwise all of them (a name repeated across pipelines is an
 * ambiguity error naming each pipeline).
 */
export function resolveStage(
  pipelines: readonly PipelineWithStages[],
  input: { stage: string; pipeline?: string },
): Result<StageRef> {
  let scope = pipelines
  if (input.pipeline) {
    const pipeline = resolvePipeline(pipelines, input.pipeline)
    if (!pipeline.ok) return pipeline
    scope = [pipeline.value]
  }
  const refs = [...indexStages(scope).values()]
  return resolveByName(refs, input.stage, {
    label: 'etapa',
    id: (r) => r.stage.id,
    name: (r) => r.stage.name,
    describe: (r) => `${r.stage.name} — pipeline ${r.pipeline.name}`,
  })
}

/* ------------------------------ people/companies -------------------------- */

export async function resolveCompany(
  ctx: AiToolContext,
  input: string,
): Promise<Result<CrmCompanyDTO>> {
  const companies = await CrmCompanyService.list(ctx.actorId, ctx.workspaceId, {
    icp: undefined,
  })
  if (!companies.ok) return companies
  return resolveByName(companies.value, input, {
    label: 'empresa',
    id: (c) => c.id,
    name: (c) => c.name,
    keys: (c) => [c.domain, c.cnpj],
  })
}

export async function resolvePerson(
  ctx: AiToolContext,
  input: string,
): Promise<Result<CrmPersonDTO>> {
  const people = await CrmPersonService.list(ctx.actorId, ctx.workspaceId, {})
  if (!people.ok) return people
  return resolveByName(people.value, input, {
    label: 'pessoa',
    id: (p) => p.id,
    name: (p) => p.name,
    keys: (p) => p.emails,
    describe: (p) => (p.emails[0] ? `${p.name} <${p.emails[0]}>` : p.name),
  })
}

/** Display name of a linked company (id when it can't be read). */
export async function companyName(
  ctx: AiToolContext,
  id: string | null,
): Promise<string | null> {
  if (!id) return null
  const company = await CrmCompanyService.getById(
    ctx.actorId,
    ctx.workspaceId,
    id,
  )
  return company.ok ? company.value.name : id
}

/** Display name of a linked person (id when it can't be read). */
export async function personName(
  ctx: AiToolContext,
  id: string | null,
): Promise<string | null> {
  if (!id) return null
  const person = await CrmPersonService.getById(
    ctx.actorId,
    ctx.workspaceId,
    id,
  )
  return person.ok ? person.value.name : id
}

/* --------------------------------- links ---------------------------------- */

export type CrmRecordKind =
  | 'lead'
  | 'opportunity'
  | 'person'
  | 'company'
  | 'task'
  | 'note'
  | 'proposal'

const LIST_PATH: Record<CrmRecordKind, string> = {
  lead: 'leads',
  opportunity: 'opportunities',
  person: 'people',
  company: 'companies',
  task: 'tasks',
  note: 'notes',
  proposal: 'proposals',
}

/** `/<slug>/crm` of the workspace, or null when it can't be read. */
export async function crmBase(ctx: AiToolContext): Promise<string | null> {
  const workspace = await WorkspaceService.getById(ctx.actorId, ctx.workspaceId)
  return workspace.ok ? `/${workspace.value.slug}/crm` : null
}

/** Href of a CRM page under the workspace, e.g. `crmPath(base, 'forecast')`. */
export function crmPath(base: string | null, path: string): string | undefined {
  return base ? `${base}/${path}` : undefined
}

/**
 * Deep link to one record. Grids open the record panel from `?record=`;
 * proposals have their own page.
 */
export function recordHref(
  base: string | null,
  kind: CrmRecordKind,
  id: string,
): string | undefined {
  if (!base) return undefined
  if (kind === 'proposal') return `${base}/proposals/${id}`
  return `${base}/${LIST_PATH[kind]}?record=${id}`
}

/* -------------------------------- formatting ------------------------------ */

export const LEAD_STAGE_LABELS: Record<CrmLeadStageDTO, string> = {
  RECEIVED: 'Lead recebido',
  IN_CONTACT: 'Em contato',
  QUALIFIED: 'Lead qualificado',
  OPPORTUNITY: 'Interesse/Oportunidade',
  PROPOSAL: 'Proposta',
  CLOSED: 'Fechado/Encerrado',
}

const money = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

export function formatMoney(value: number | null | undefined): string | null {
  return value === null || value === undefined ? null : money.format(value)
}

/**
 * Dates come from the model as calendar days (`2026-10-31` → UTC midnight),
 * so they are shown by their UTC day — never shifted by a runtime timezone.
 */
export function formatDate(
  value: Date | string | null | undefined,
): string | null {
  if (value === null || value === undefined) return null
  const iso = (
    typeof value === 'string' ? new Date(value) : value
  ).toISOString()
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}

export function formatValue(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null
  if (value instanceof Date) return formatDate(value)
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não'
  if (Array.isArray(value)) return value.length ? value.join(', ') : null
  return String(value)
}

export type PreviewField = NonNullable<AiToolPreviewDTO['fields']>[number]

/** Field rows of a create preview (empty values are left out). */
export function afterFields(
  rows: ReadonlyArray<[label: string, after: unknown]>,
): PreviewField[] {
  return rows
    .map(([label, after]) => ({ label, after: formatValue(after) }))
    .filter((row) => row.after !== null)
}

/**
 * Field rows of an update preview: only the fields the call really changes
 * (`after` given and different from the current value), with both values.
 */
export function changeFields(
  rows: ReadonlyArray<[label: string, before: unknown, after: unknown]>,
): PreviewField[] {
  return rows
    .filter(([, , after]) => after !== undefined)
    .map(([label, before, after]) => ({
      label,
      before: formatValue(before),
      after: formatValue(after),
    }))
    .filter((row) => row.before !== row.after)
}

/** Error for an update call that changes nothing. */
export function nothingToChange(): AppError {
  return validationError('Informe ao menos um campo para alterar')
}

/** Trims a long text for previews and list payloads. */
export function excerpt(
  text: string | null | undefined,
  max = 200,
): string | null {
  if (!text) return null
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}
