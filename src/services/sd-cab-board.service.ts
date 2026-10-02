import type { Prisma } from '@prisma/client'
import { sdCabQuorumInvalid } from '@/src/errors'
import { err, ok, type Result } from '@/src/lib/result'
import type { SdConditionFacts } from '@/src/lib/servicedesk/conditions'
import { evaluateSdConditions } from '@/src/lib/servicedesk/conditions'
import { toSdCabBoardDTO } from '@/src/mappers/sd-cab-board.mapper'
import {
  type SdCabBoardData,
  SdCabBoardRepository,
  type SdCabBoardWithMembers,
} from '@/src/repositories/sd-cab-board.repository'
import type {
  CreateSdCabBoardDTO,
  UpdateSdCabBoardDTO,
} from '@/src/schemas/sd-cab-board.schema'
import { SdConditionsSchema } from '@/src/schemas/sd-rule.schema'
import type { SdCabBoardDTO } from '@/types/sd-cab'
import { SdAccess } from './sd-access'
import { assertSdRefs, sdAdminMutation } from './sd-config-support'

/**
 * Comitês de mudança (CAB). Configuração: leitura para agentes (a tela do
 * chamado mostra quem vota), escrita só para admins.
 *
 * O quórum `0` significa **todos os membros**; um quórum maior que o número de
 * membros é recusado com `SD_CAB_QUORUM_INVALID` — melhor recusar do que abrir
 * uma rodada que nunca fecha.
 */

function assertQuorum(quorum: number, members: number): Result<true> {
  if (quorum === 0) {
    if (members === 0) {
      return err(
        sdCabQuorumInvalid(
          'Um comitê sem membros não consegue aprovar nada: adicione ao menos um',
        ),
      )
    }
    return ok(true)
  }
  if (quorum > members) {
    return err(
      sdCabQuorumInvalid(
        `Quórum de ${quorum} não cabe em ${members} membro(s) do comitê`,
      ),
    )
  }
  return ok(true)
}

function toData(
  dto: CreateSdCabBoardDTO | UpdateSdCabBoardDTO,
): SdCabBoardData {
  const data: SdCabBoardData = {}
  if (dto.name !== undefined) data.name = dto.name
  if (dto.description !== undefined) data.description = dto.description ?? null
  if (dto.quorum !== undefined) data.quorum = dto.quorum
  if (dto.rejectEnds !== undefined) data.rejectEnds = dto.rejectEnds
  if (dto.active !== undefined) data.active = dto.active
  if (dto.position !== undefined) data.position = dto.position
  if (dto.conditions !== undefined) {
    data.conditions = dto.conditions as Prisma.InputJsonValue
  }
  return data
}

/**
 * Primeiro comitê ativo (na ordem de `position`) cujas condições casam com os
 * fatos do chamado. Comitê sem condições serve a qualquer mudança, então vale
 * como padrão — deixe-o por último na ordenação.
 */
export function selectSdCabBoard(
  boards: readonly SdCabBoardWithMembers[],
  facts: SdConditionFacts,
): SdCabBoardWithMembers | null {
  for (const board of boards) {
    if (!board.active || board.members.length === 0) continue
    const parsed = SdConditionsSchema.safeParse(board.conditions)
    const conditions = parsed.success ? parsed.data : []
    if (evaluateSdConditions(conditions, facts)) return board
  }
  return null
}

export const SdCabBoardService = {
  async list(
    actorId: string,
    workspaceId: string,
    options: { includeInactive?: boolean } = {},
  ): Promise<Result<SdCabBoardDTO[]>> {
    const ctx = await SdAccess.requireAgent(actorId, workspaceId, {
      resource: 'sd-change-calendar',
      action: 'VIEW',
    })
    if (!ctx.ok) return ctx
    const rows = await SdCabBoardRepository.list(workspaceId, options)
    if (!rows.ok) return rows
    return ok(rows.value.map(toSdCabBoardDTO))
  },

  async create(
    actorId: string,
    workspaceId: string,
    dto: CreateSdCabBoardDTO,
  ): Promise<Result<SdCabBoardDTO>> {
    return sdAdminMutation({
      actorId,
      workspaceId,
      entity: 'sd_cab_board',
      action: 'create',
      targetId: (value) => value.id,
      meta: { members: dto.members.length, quorum: dto.quorum },
      run: async () => {
        const quorum = assertQuorum(dto.quorum, dto.members.length)
        if (!quorum.ok) return quorum
        const refs = await assertSdRefs(workspaceId, {
          userIds: dto.members.map((m) => m.userId),
        })
        if (!refs.ok) return refs

        const created = await SdCabBoardRepository.create(
          workspaceId,
          actorId,
          {
            ...toData(dto),
            name: dto.name,
            members: dto.members,
          },
        )
        if (!created.ok) return created
        return ok(toSdCabBoardDTO(created.value))
      },
    })
  },

  async update(
    actorId: string,
    workspaceId: string,
    boardId: string,
    dto: UpdateSdCabBoardDTO,
  ): Promise<Result<SdCabBoardDTO>> {
    return sdAdminMutation({
      actorId,
      workspaceId,
      entity: 'sd_cab_board',
      action: 'update',
      targetId: boardId,
      meta: { fields: Object.keys(dto) },
      run: async () => {
        const existing = await SdCabBoardRepository.findById(
          boardId,
          workspaceId,
        )
        if (!existing.ok) return existing

        const members = dto.members ?? existing.value.members
        const quorum = assertQuorum(
          dto.quorum ?? existing.value.quorum,
          members.length,
        )
        if (!quorum.ok) return quorum
        if (dto.members) {
          const refs = await assertSdRefs(workspaceId, {
            userIds: dto.members.map((m) => m.userId),
          })
          if (!refs.ok) return refs
        }

        const updated = await SdCabBoardRepository.update(
          boardId,
          workspaceId,
          {
            ...toData(dto),
            ...(dto.members ? { members: dto.members } : {}),
          },
        )
        if (!updated.ok) return updated
        return ok(toSdCabBoardDTO(updated.value))
      },
    })
  },

  async remove(
    actorId: string,
    workspaceId: string,
    boardId: string,
  ): Promise<Result<void>> {
    return sdAdminMutation({
      actorId,
      workspaceId,
      entity: 'sd_cab_board',
      action: 'delete',
      targetId: boardId,
      run: async () => {
        const existing = await SdCabBoardRepository.findById(
          boardId,
          workspaceId,
        )
        if (!existing.ok) return existing
        return SdCabBoardRepository.softDelete(boardId, workspaceId)
      },
    })
  },
}
