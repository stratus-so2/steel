import type {
  SdCabBoardWithMembers,
  SdCabMemberWithUser,
} from '@/src/repositories/sd-cab-board.repository'
import { SdConditionsSchema } from '@/src/schemas/sd-rule.schema'
import type { SdCabBoardDTO, SdCabMemberDTO } from '@/types/sd-cab'

/**
 * `SdCabBoard` → DTO. As condições salvas em JSON são relidas pelo schema
 * (JSON inválido vira lista vazia, ou seja, "serve para toda mudança") e o
 * quórum efetivo é resolvido aqui: `0` significa **todos os membros**.
 */

/** Quantos votos de fato fecham a rodada: `0` → nº de membros. */
export function sdEffectiveQuorum(quorum: number, members: number): number {
  if (quorum <= 0) return members
  return Math.min(quorum, members)
}

export function toSdCabMemberDTO(member: SdCabMemberWithUser): SdCabMemberDTO {
  return {
    id: member.id,
    userId: member.userId,
    user: member.user,
    required: member.required,
  }
}

export function toSdCabBoardDTO(board: SdCabBoardWithMembers): SdCabBoardDTO {
  const conditions = SdConditionsSchema.safeParse(board.conditions)
  return {
    id: board.id,
    name: board.name,
    description: board.description,
    quorum: board.quorum,
    effectiveQuorum: sdEffectiveQuorum(board.quorum, board.members.length),
    rejectEnds: board.rejectEnds,
    conditions: conditions.success ? conditions.data : [],
    active: board.active,
    position: board.position,
    members: board.members.map(toSdCabMemberDTO),
    createdAt: board.createdAt.toISOString(),
    updatedAt: board.updatedAt.toISOString(),
  }
}
