import { auditMutation } from '@/lib/axiom/audit'
import type { WikiLabelDTO } from '@/types/wiki-label'
import { wikiLabelNotFound } from '../errors'
import { err, ok, type Result } from '../lib/result'
import { toWikiLabelDTO } from '../mappers/wiki-label.mapper'
import { WikiLabelRepository } from '../repositories/wiki-label.repository'
import type {
  CreateWikiLabelDTO,
  UpdateWikiLabelDTO,
} from '../schemas/wiki-label.schema'
import { assertMember, assertPrivileged } from './authz'

/** Loads a label and hides one from another workspace behind a 404. */
async function findInWorkspace(labelId: string, workspaceId: string) {
  const label = await WikiLabelRepository.findById(labelId)
  if (!label.ok) return label
  if (label.value.workspaceId !== workspaceId) return err(wikiLabelNotFound())
  return label
}

export const WikiLabelService = {
  /** Any member reads the labels: the page header shows and applies them. */
  async list(
    actorId: string,
    workspaceId: string,
  ): Promise<Result<WikiLabelDTO[]>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const result = await WikiLabelRepository.listByWorkspace(workspaceId)
    if (!result.ok) return result

    return ok(result.value.map(toWikiLabelDTO))
  },

  async create(
    actorId: string,
    workspaceId: string,
    dto: CreateWikiLabelDTO,
  ): Promise<Result<WikiLabelDTO>> {
    const membership = await assertPrivileged(actorId, workspaceId)
    if (!membership.ok) return membership

    const result = await WikiLabelRepository.create({
      workspaceId,
      name: dto.name,
      color: dto.color,
    })

    auditMutation({
      entity: 'wiki_label',
      action: 'create',
      actorId,
      targetId: result.ok ? result.value.id : null,
      ...(result.ok
        ? {}
        : { outcome: 'failure' as const, reason: result.error.code }),
    })
    if (!result.ok) return result

    return ok(toWikiLabelDTO(result.value))
  },

  async update(
    actorId: string,
    workspaceId: string,
    labelId: string,
    dto: UpdateWikiLabelDTO,
  ): Promise<Result<WikiLabelDTO>> {
    const membership = await assertPrivileged(actorId, workspaceId)
    if (!membership.ok) return membership

    const existing = await findInWorkspace(labelId, workspaceId)
    if (!existing.ok) return existing

    const result = await WikiLabelRepository.update(labelId, dto)

    auditMutation({
      entity: 'wiki_label',
      action: 'update',
      actorId,
      targetId: labelId,
      ...(result.ok
        ? {}
        : { outcome: 'failure' as const, reason: result.error.code }),
      meta: { fields: Object.keys(dto) },
    })
    if (!result.ok) return result

    return ok(toWikiLabelDTO(result.value))
  },

  /** Deleting a label also removes it from every page (cascade). */
  async delete(
    actorId: string,
    workspaceId: string,
    labelId: string,
  ): Promise<Result<void>> {
    const membership = await assertPrivileged(actorId, workspaceId)
    if (!membership.ok) return membership

    const existing = await findInWorkspace(labelId, workspaceId)
    if (!existing.ok) return existing

    const result = await WikiLabelRepository.delete(labelId)

    auditMutation({
      entity: 'wiki_label',
      action: 'delete',
      actorId,
      targetId: labelId,
      ...(result.ok
        ? {}
        : { outcome: 'failure' as const, reason: result.error.code }),
    })
    return result
  },
}
