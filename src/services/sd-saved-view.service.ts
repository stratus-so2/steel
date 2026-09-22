import type { Prisma, SdSavedView } from '@prisma/client'
import { auditMutation } from '@/lib/axiom/audit'
import { forbidden, notFound } from '@/src/errors'
import { err, ok, type Result } from '@/src/lib/result'
import { toSdSavedViewDTO } from '@/src/mappers/sd-saved-view.mapper'
import { SdSavedViewRepository } from '@/src/repositories/sd-saved-view.repository'
import type {
  CreateSdSavedViewDTO,
  UpdateSdSavedViewDTO,
} from '@/src/schemas/sd-saved-view.schema'
import type { SdSavedViewDTO } from '@/types/sd-ticket'
import { SdAccess, type SdAccessContext } from './sd-access'

/**
 * Visões salvas do quadro/lista de chamados. Pessoais (só o dono vê) ou
 * compartilhadas (todo o workspace vê; editam o dono e os admins do módulo).
 */

function canEdit(view: SdSavedView, ctx: SdAccessContext): boolean {
  return view.userId === ctx.userId || (view.shared && ctx.isAdmin)
}

async function agent(actorId: string, workspaceId: string) {
  return SdAccess.requireAgent(actorId, workspaceId, {
    resource: 'sd-tickets',
    action: 'VIEW',
  })
}

async function editable(
  actorId: string,
  workspaceId: string,
  viewId: string,
): Promise<Result<{ ctx: SdAccessContext; view: SdSavedView }>> {
  const ctx = await agent(actorId, workspaceId)
  if (!ctx.ok) return ctx
  const view = await SdSavedViewRepository.findById(viewId, workspaceId)
  if (!view.ok) return view
  // Pessoal de outra pessoa: não revela que existe.
  if (!view.value.shared && view.value.userId !== actorId) {
    return err(notFound('Visão salva'))
  }
  if (!canEdit(view.value, ctx.value)) {
    return err(forbidden('Só o dono ou um administrador altera esta visão'))
  }
  return ok({ ctx: ctx.value, view: view.value })
}

export const SdSavedViewService = {
  async list(
    actorId: string,
    workspaceId: string,
  ): Promise<Result<SdSavedViewDTO[]>> {
    const ctx = await agent(actorId, workspaceId)
    if (!ctx.ok) return ctx
    const rows = await SdSavedViewRepository.listVisible(workspaceId, actorId)
    if (!rows.ok) return rows
    return ok(rows.value.map((v) => toSdSavedViewDTO(v, canEdit(v, ctx.value))))
  },

  async create(
    actorId: string,
    workspaceId: string,
    input: CreateSdSavedViewDTO,
  ): Promise<Result<SdSavedViewDTO>> {
    const ctx = await agent(actorId, workspaceId)
    if (!ctx.ok) return ctx
    const created = await SdSavedViewRepository.create({
      workspaceId,
      userId: actorId,
      name: input.name,
      ticketType: input.ticketType ?? null,
      mode: input.mode,
      filters: input.filters as Prisma.InputJsonObject,
      sort: input.sort,
      columns: input.columns,
      shared: input.shared,
      position: input.position,
    })
    if (!created.ok) return created
    auditMutation({
      entity: 'sd_saved_view',
      action: 'create',
      actorId,
      targetId: created.value.id,
      meta: { workspaceId, shared: created.value.shared },
    })
    return ok(toSdSavedViewDTO(created.value, true))
  },

  async update(
    actorId: string,
    workspaceId: string,
    viewId: string,
    input: UpdateSdSavedViewDTO,
  ): Promise<Result<SdSavedViewDTO>> {
    const loaded = await editable(actorId, workspaceId, viewId)
    if (!loaded.ok) return loaded
    const updated = await SdSavedViewRepository.update(viewId, {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.ticketType !== undefined
        ? { ticketType: input.ticketType }
        : {}),
      ...(input.mode !== undefined ? { mode: input.mode } : {}),
      ...(input.filters !== undefined
        ? { filters: input.filters as Prisma.InputJsonObject }
        : {}),
      ...(input.sort !== undefined ? { sort: input.sort } : {}),
      ...(input.columns !== undefined ? { columns: input.columns } : {}),
      ...(input.shared !== undefined ? { shared: input.shared } : {}),
      ...(input.position !== undefined ? { position: input.position } : {}),
    })
    if (!updated.ok) return updated
    auditMutation({
      entity: 'sd_saved_view',
      action: 'update',
      actorId,
      targetId: viewId,
      meta: { workspaceId, fields: Object.keys(input) },
    })
    return ok(
      toSdSavedViewDTO(updated.value, canEdit(updated.value, loaded.value.ctx)),
    )
  },

  async remove(
    actorId: string,
    workspaceId: string,
    viewId: string,
  ): Promise<Result<void>> {
    const loaded = await editable(actorId, workspaceId, viewId)
    if (!loaded.ok) return loaded
    const removed = await SdSavedViewRepository.delete(viewId)
    if (!removed.ok) return removed
    auditMutation({
      entity: 'sd_saved_view',
      action: 'delete',
      actorId,
      targetId: viewId,
      meta: { workspaceId },
    })
    return ok(undefined)
  },
}
