import { createId } from '@paralleldrive/cuid2'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/src/lib/prisma'
import type { SdApprovalRoundWithRelations } from '@/src/repositories/sd-approval-round.repository'
import type { SdCabBoardWithMembers } from '@/src/repositories/sd-cab-board.repository'
import type { SdChangeWindowWithAuthor } from '@/src/repositories/sd-change-window.repository'

/**
 * Fábricas do calendário de mudanças e do comitê (CAB): fakes para os testes
 * unitários e seeds no banco para os de integração.
 */

const fixed = () => new Date('2026-10-01T12:00:00.000Z')

const author = () => ({
  id: 'u1',
  name: 'Ana Agente',
  email: 'ana@example.com',
  image: null,
})

/* ------------------------------ fakes (unit) ------------------------------ */

export function createFakeSdChangeWindow(
  overrides?: Partial<SdChangeWindowWithAuthor>,
): SdChangeWindowWithAuthor {
  return {
    id: createId(),
    workspaceId: 'ws1',
    name: 'Janela de manutenção · sábado',
    kind: 'MAINTENANCE',
    startsAt: new Date('2026-10-03T02:00:00.000Z'),
    endsAt: new Date('2026-10-03T06:00:00.000Z'),
    recurrence: null,
    timezone: 'America/Sao_Paulo',
    configItemIds: [],
    departmentIds: [],
    description: null,
    createdById: 'u1',
    createdAt: fixed(),
    updatedAt: fixed(),
    deletedAt: null,
    createdBy: author(),
    ...overrides,
  }
}

export function createFakeSdCabMember(
  overrides?: Partial<SdCabBoardWithMembers['members'][number]>,
): SdCabBoardWithMembers['members'][number] {
  return {
    id: createId(),
    boardId: 'board1',
    userId: 'u1',
    required: false,
    user: author(),
    ...overrides,
  }
}

export function createFakeSdCabBoard(
  overrides?: Partial<SdCabBoardWithMembers>,
): SdCabBoardWithMembers {
  return {
    id: 'board1',
    workspaceId: 'ws1',
    name: 'CAB de infraestrutura',
    description: null,
    quorum: 0,
    rejectEnds: true,
    conditions: [],
    active: true,
    position: 0,
    createdById: 'u1',
    createdAt: fixed(),
    updatedAt: fixed(),
    deletedAt: null,
    members: [createFakeSdCabMember()],
    ...overrides,
  }
}

export function createFakeSdApprovalRound(
  overrides?: Partial<SdApprovalRoundWithRelations>,
): SdApprovalRoundWithRelations {
  return {
    id: createId(),
    workspaceId: 'ws1',
    ticketId: 't1',
    boardId: 'board1',
    status: 'PENDING',
    quorum: 1,
    rejectEnds: true,
    requestedById: 'u1',
    decidedAt: null,
    createdAt: fixed(),
    updatedAt: fixed(),
    board: {
      id: 'board1',
      name: 'CAB de infraestrutura',
      members: [{ userId: 'u1', required: false }],
    },
    requestedBy: author(),
    approvals: [],
    ...overrides,
  }
}

/* --------------------------- seeds (integration) -------------------------- */

export async function seedSdChangeWindow(
  workspaceId: string,
  createdById: string,
  overrides?: Partial<Prisma.SdChangeWindowUncheckedCreateInput>,
) {
  return prisma.sdChangeWindow.create({
    data: {
      workspaceId,
      createdById,
      name: 'Janela de manutenção',
      startsAt: new Date('2026-10-03T02:00:00.000Z'),
      endsAt: new Date('2026-10-03T06:00:00.000Z'),
      ...overrides,
    },
  })
}

export async function seedSdCabBoard(
  workspaceId: string,
  createdById: string,
  overrides?: Partial<Prisma.SdCabBoardUncheckedCreateInput>,
) {
  return prisma.sdCabBoard.create({
    data: {
      workspaceId,
      createdById,
      name: 'CAB de infraestrutura',
      ...overrides,
    },
  })
}

export async function seedSdCabMember(
  boardId: string,
  userId: string,
  required = false,
) {
  return prisma.sdCabMember.create({ data: { boardId, userId, required } })
}

export async function seedSdApprovalRound(
  workspaceId: string,
  ticketId: string,
  requestedById: string,
  overrides?: Partial<Prisma.SdApprovalRoundUncheckedCreateInput>,
) {
  return prisma.sdApprovalRound.create({
    data: { workspaceId, ticketId, requestedById, quorum: 1, ...overrides },
  })
}

/** Pedido de aprovação dentro de uma rodada. */
export async function seedSdRoundApproval(
  workspaceId: string,
  ticketId: string,
  roundId: string,
  requestedById: string,
  overrides?: Partial<Prisma.SdTicketApprovalUncheckedCreateInput>,
) {
  return prisma.sdTicketApproval.create({
    data: {
      workspaceId,
      ticketId,
      roundId,
      requestedById,
      approverEmail: `aprovador-${createId()}@example.com`,
      tokenHash: createId(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      ...overrides,
    },
  })
}
