import {
  type AuditAction,
  type AuditEntity,
  auditMutation,
} from '@/lib/axiom/audit'
import { sdConfigNotFound } from '@/src/errors'
import { err, ok, type Result } from '@/src/lib/result'
import { SdConfigRepository } from '@/src/repositories/sd-config.repository'
import { SdAccess, type SdAccessContext } from './sd-access'

/**
 * Apoio comum aos services de configuração do ServiceDesk: mutação de admin
 * (autorização + auditoria) e validação de ids referenciados.
 */

interface AdminMutationOptions<T> {
  actorId: string
  workspaceId: string
  entity: AuditEntity
  action: AuditAction
  /** Alvo da auditoria: id fixo ou derivado do valor (`value.id`). */
  targetId?: string | ((value: T) => string | null)
  meta?: Record<string, unknown>
  run: (ctx: SdAccessContext) => Promise<Result<T>>
}

/**
 * `SdAccess.requireAdmin` → `run` → `auditMutation` (sucesso ou falha, com o
 * código do erro). Recusas de autorização não são auditadas como mutação.
 */
export async function sdAdminMutation<T>(
  options: AdminMutationOptions<T>,
): Promise<Result<T>> {
  const ctx = await SdAccess.requireAdmin(options.actorId, options.workspaceId)
  if (!ctx.ok) return ctx

  const result = await options.run(ctx.value)
  const target =
    typeof options.targetId === 'function'
      ? result.ok
        ? options.targetId(result.value)
        : null
      : (options.targetId ?? null)

  auditMutation({
    entity: options.entity,
    action: options.action,
    actorId: options.actorId,
    targetId: target,
    meta: { workspaceId: options.workspaceId, ...options.meta },
    ...(result.ok
      ? {}
      : { outcome: 'failure' as const, reason: result.error.code }),
  })
  return result
}

export interface SdConfigRefs {
  departmentIds?: (string | null | undefined)[]
  userIds?: (string | null | undefined)[]
  templateIds?: (string | null | undefined)[]
  categoryIds?: (string | null | undefined)[]
  priorityIds?: (string | null | undefined)[]
  calendarIds?: (string | null | undefined)[]
  slaPolicyIds?: (string | null | undefined)[]
  classificationIds?: (string | null | undefined)[]
  impactIds?: (string | null | undefined)[]
  urgencyIds?: (string | null | undefined)[]
  severityIds?: (string | null | undefined)[]
  phaseIds?: (string | null | undefined)[]
}

const REF_LABELS: Record<keyof SdConfigRefs, string> = {
  departmentIds: 'Departamento',
  userIds: 'Usuário',
  templateIds: 'Modelo de chamado',
  categoryIds: 'Categoria',
  priorityIds: 'Prioridade',
  calendarIds: 'Calendário',
  slaPolicyIds: 'Política de SLA',
  classificationIds: 'Classificação',
  impactIds: 'Impacto',
  urgencyIds: 'Urgência',
  severityIds: 'Severidade',
  phaseIds: 'Fase',
}

function compact(ids: (string | null | undefined)[] | undefined): string[] {
  return [...new Set((ids ?? []).filter((id): id is string => !!id))]
}

/**
 * Confere que cada id referenciado pertence à workspace (usuários: membros;
 * departamentos: não excluídos). Qualquer ausência vira `SD_CONFIG_NOT_FOUND`
 * com `details.missing = [{ kind, id }]`.
 */
export async function assertSdRefs(
  workspaceId: string,
  refs: SdConfigRefs,
): Promise<Result<true>> {
  const wanted = Object.fromEntries(
    (Object.keys(refs) as (keyof SdConfigRefs)[]).map((key) => [
      key,
      compact(refs[key]),
    ]),
  ) as Record<keyof SdConfigRefs, string[]>
  const total = Object.values(wanted).reduce((n, ids) => n + ids.length, 0)
  if (total === 0) return ok(true)

  const found = await SdConfigRepository.findExistingRefs(workspaceId, wanted)
  if (!found.ok) return found

  const missing: { kind: keyof SdConfigRefs; id: string }[] = []
  for (const key of Object.keys(wanted) as (keyof SdConfigRefs)[]) {
    const existing = new Set(found.value[key] ?? [])
    for (const id of wanted[key]) {
      if (!existing.has(id)) missing.push({ kind: key, id })
    }
  }
  if (missing.length === 0) return ok(true)

  const first = missing[0]
  const base = sdConfigNotFound()
  return err({
    ...base,
    message: `${REF_LABELS[first.kind]} não encontrado(a) nesta workspace`,
    details: { missing },
  })
}
