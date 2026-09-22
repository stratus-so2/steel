import { type AuditAction, auditMutation } from '@/lib/axiom/audit'
import { forbidden } from '@/src/errors'
import { err, ok, type Result } from '@/src/lib/result'
import { toSdCannedResponseDTO } from '@/src/mappers/sd-canned-response.mapper'
import {
  SdCannedResponseRepository,
  type SdCannedResponseWithAuthor,
} from '@/src/repositories/sd-canned-response.repository'
import type {
  CreateSdCannedResponseDTO,
  ListSdCannedResponsesDTO,
  UpdateSdCannedResponseDTO,
} from '@/src/schemas/sd-canned-response.schema'
import type { SdCannedResponseDTO } from '@/types/sd-config'
import { SdAccess, type SdAccessContext } from './sd-access'
import { assertSdRefs } from './sd-config-support'

function audit(
  action: AuditAction,
  actorId: string,
  workspaceId: string,
  targetId: string | null,
  result: Result<unknown>,
) {
  auditMutation({
    entity: 'sd_canned_response',
    action,
    actorId,
    targetId,
    meta: { workspaceId },
    ...(result.ok
      ? {}
      : { outcome: 'failure' as const, reason: result.error.code }),
  })
}

/** Agente edita as próprias; admin edita todas. */
async function loadOwned(
  ctx: SdAccessContext,
  workspaceId: string,
  responseId: string,
): Promise<Result<SdCannedResponseWithAuthor>> {
  const existing = await SdCannedResponseRepository.findById(
    responseId,
    workspaceId,
  )
  if (!existing.ok) return existing
  if (!ctx.isAdmin && existing.value.createdById !== ctx.userId) {
    return err(
      forbidden('Só o autor ou um administrador pode alterar esta resposta'),
    )
  }
  return existing
}

/** Respostas prontas do histórico/WhatsApp — só agentes. */
export const SdCannedResponseService = {
  async list(
    actorId: string,
    workspaceId: string,
    filters: ListSdCannedResponsesDTO = {},
  ): Promise<Result<SdCannedResponseDTO[]>> {
    const ctx = await SdAccess.requireAgent(actorId, workspaceId)
    if (!ctx.ok) return ctx
    const rows = await SdCannedResponseRepository.list(workspaceId, filters)
    if (!rows.ok) return rows
    return ok(rows.value.map(toSdCannedResponseDTO))
  },

  async create(
    actorId: string,
    workspaceId: string,
    dto: CreateSdCannedResponseDTO,
  ): Promise<Result<SdCannedResponseDTO>> {
    const ctx = await SdAccess.requireAgent(actorId, workspaceId)
    if (!ctx.ok) return ctx

    const refs = await assertSdRefs(workspaceId, {
      departmentIds: [dto.departmentId],
    })
    if (!refs.ok) return refs

    const created = await SdCannedResponseRepository.create(
      workspaceId,
      actorId,
      dto,
    )
    audit(
      'create',
      actorId,
      workspaceId,
      created.ok ? created.value.id : null,
      created,
    )
    if (!created.ok) return created
    return ok(toSdCannedResponseDTO(created.value))
  },

  async update(
    actorId: string,
    workspaceId: string,
    responseId: string,
    dto: UpdateSdCannedResponseDTO,
  ): Promise<Result<SdCannedResponseDTO>> {
    const ctx = await SdAccess.requireAgent(actorId, workspaceId)
    if (!ctx.ok) return ctx
    const existing = await loadOwned(ctx.value, workspaceId, responseId)
    if (!existing.ok) return existing

    const refs = await assertSdRefs(workspaceId, {
      departmentIds: [dto.departmentId],
    })
    if (!refs.ok) return refs

    const updated = await SdCannedResponseRepository.update(
      responseId,
      workspaceId,
      dto,
    )
    audit('update', actorId, workspaceId, responseId, updated)
    if (!updated.ok) return updated
    return ok(toSdCannedResponseDTO(updated.value))
  },

  async remove(
    actorId: string,
    workspaceId: string,
    responseId: string,
  ): Promise<Result<void>> {
    const ctx = await SdAccess.requireAgent(actorId, workspaceId)
    if (!ctx.ok) return ctx
    const existing = await loadOwned(ctx.value, workspaceId, responseId)
    if (!existing.ok) return existing

    const removed = await SdCannedResponseRepository.delete(
      responseId,
      workspaceId,
    )
    audit('delete', actorId, workspaceId, responseId, removed)
    return removed
  },
}
