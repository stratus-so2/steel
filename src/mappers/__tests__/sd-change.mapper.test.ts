import { describe, expect, it } from 'vitest'
import {
  createFakeSdApprovalRound,
  createFakeSdCabBoard,
  createFakeSdCabMember,
  createFakeSdChangeWindow,
} from '@/src/__tests__/factories/sd-change.factory'
import { createFakeSdTicketApproval } from '@/src/__tests__/factories/sd-ticket-tabs.factory'
import {
  sdApprovalRoundOutcome,
  sdApprovalRoundTally,
  toSdApprovalRoundDTO,
} from '../sd-approval-round.mapper'
import {
  sdEffectiveQuorum,
  toSdCabBoardDTO,
  toSdCabMemberDTO,
} from '../sd-cab-board.mapper'
import {
  toSdChangeCalendarEntryDTO,
  toSdChangeOccurrenceDTO,
  toSdChangeRecurrence,
  toSdChangeWindowDTO,
  toSdChangeWindowSource,
} from '../sd-change-window.mapper'

describe('toSdChangeRecurrence', () => {
  it('reads a valid recurrence, applying the defaults', () => {
    expect(toSdChangeRecurrence({ freq: 'WEEKLY' })).toEqual({
      freq: 'WEEKLY',
      interval: 1,
      byDay: [],
      until: null,
      count: null,
    })
  })

  it('sorts byDay into week order', () => {
    expect(
      toSdChangeRecurrence({ freq: 'WEEKLY', byDay: ['sat', 'mon'] })?.byDay,
    ).toEqual(['mon', 'sat'])
  })

  it('returns null for null, undefined and junk json', () => {
    expect(toSdChangeRecurrence(null)).toBeNull()
    expect(toSdChangeRecurrence(undefined)).toBeNull()
    expect(toSdChangeRecurrence({ freq: 'HOURLY' })).toBeNull()
    expect(toSdChangeRecurrence('weekly')).toBeNull()
  })
})

describe('toSdChangeWindowDTO', () => {
  it('maps every field with ISO dates', () => {
    const dto = toSdChangeWindowDTO(
      createFakeSdChangeWindow({
        kind: 'FREEZE',
        configItemIds: ['ci_1'],
        departmentIds: ['dep_1'],
        description: 'Congelado',
        recurrence: { freq: 'DAILY', interval: 2 },
      }),
    )
    expect(dto).toMatchObject({
      name: 'Janela de manutenção · sábado',
      kind: 'FREEZE',
      startsAt: '2026-10-03T02:00:00.000Z',
      endsAt: '2026-10-03T06:00:00.000Z',
      timezone: 'America/Sao_Paulo',
      configItemIds: ['ci_1'],
      departmentIds: ['dep_1'],
      description: 'Congelado',
    })
    expect(dto.recurrence).toEqual({
      freq: 'DAILY',
      interval: 2,
      byDay: [],
      until: null,
      count: null,
    })
    expect(dto.createdBy?.id).toBe('u1')
  })

  it('drops an unreadable recurrence', () => {
    const dto = toSdChangeWindowDTO(
      createFakeSdChangeWindow({ recurrence: { nope: true } }),
    )
    expect(dto.recurrence).toBeNull()
  })
})

describe('toSdChangeWindowSource', () => {
  it('keeps only what the expansion needs', () => {
    const window = createFakeSdChangeWindow({
      recurrence: { freq: 'WEEKLY', byDay: ['sat'] },
    })
    expect(toSdChangeWindowSource(window)).toEqual({
      id: window.id,
      startsAt: window.startsAt,
      endsAt: window.endsAt,
      recurrence: {
        freq: 'WEEKLY',
        interval: 1,
        byDay: ['sat'],
        until: null,
        count: null,
      },
    })
  })
})

describe('toSdChangeOccurrenceDTO', () => {
  it('takes the dates from the occurrence and the rest from the window', () => {
    const window = createFakeSdChangeWindow({
      kind: 'FREEZE',
      configItemIds: ['ci_1'],
    })
    const dto = toSdChangeOccurrenceDTO(
      {
        windowId: window.id,
        startsAt: new Date('2026-10-10T02:00:00.000Z'),
        endsAt: new Date('2026-10-10T06:00:00.000Z'),
        recurring: true,
      },
      window,
    )
    expect(dto).toEqual({
      windowId: window.id,
      name: window.name,
      kind: 'FREEZE',
      startsAt: '2026-10-10T02:00:00.000Z',
      endsAt: '2026-10-10T06:00:00.000Z',
      timezone: 'America/Sao_Paulo',
      configItemIds: ['ci_1'],
      departmentIds: [],
      description: null,
      recurring: true,
    })
  })
})

const change = {
  id: 't1',
  number: 42,
  type: 'CHANGE' as const,
  title: 'Troca de disco',
  plannedStartAt: new Date('2026-10-10T02:00:00.000Z'),
  plannedEndAt: new Date('2026-10-10T06:00:00.000Z'),
  changeType: 'NORMAL' as const,
  changeRisk: 'HIGH' as const,
  configItemId: 'ci_1',
  departmentId: 'dep_1',
  phase: { id: 'p1', name: 'Planejada', category: 'IN_PROGRESS' as const },
  configItem: { id: 'ci_1', name: 'Servidor' },
  assignee: {
    id: 'u2',
    name: 'Bruno',
    email: 'bruno@example.com',
    image: null,
  },
}

describe('toSdChangeCalendarEntryDTO', () => {
  it('maps the change with its conflicts and freezes', () => {
    expect(
      toSdChangeCalendarEntryDTO(change, {
        code: 'CHG-000042',
        conflictTicketIds: ['t2'],
        frozenWindowIds: ['w1'],
      }),
    ).toEqual({
      ticketId: 't1',
      number: 42,
      code: 'CHG-000042',
      title: 'Troca de disco',
      type: 'CHANGE',
      plannedStartAt: '2026-10-10T02:00:00.000Z',
      plannedEndAt: '2026-10-10T06:00:00.000Z',
      phaseName: 'Planejada',
      phaseCategory: 'IN_PROGRESS',
      changeType: 'NORMAL',
      changeRisk: 'HIGH',
      configItemId: 'ci_1',
      configItemName: 'Servidor',
      departmentId: 'dep_1',
      assignee: change.assignee,
      conflictTicketIds: ['t2'],
      frozenWindowIds: ['w1'],
    })
  })

  it('defaults the conflict lists and tolerates no config item', () => {
    const dto = toSdChangeCalendarEntryDTO(
      { ...change, configItem: null, configItemId: null },
      { code: 'CHG-000042' },
    )
    expect(dto.configItemName).toBeNull()
    expect(dto.conflictTicketIds).toEqual([])
    expect(dto.frozenWindowIds).toEqual([])
  })
})

describe('sdEffectiveQuorum', () => {
  it('turns 0 into every member', () => {
    expect(sdEffectiveQuorum(0, 3)).toBe(3)
    expect(sdEffectiveQuorum(-1, 3)).toBe(3)
  })

  it('keeps a quorum that fits and clamps one that does not', () => {
    expect(sdEffectiveQuorum(2, 3)).toBe(2)
    expect(sdEffectiveQuorum(5, 3)).toBe(3)
  })
})

describe('toSdCabBoardDTO', () => {
  it('maps the board with members, conditions and the effective quorum', () => {
    const dto = toSdCabBoardDTO(
      createFakeSdCabBoard({
        quorum: 0,
        conditions: [
          { field: 'changeRisk', operator: 'equals', value: 'HIGH' },
        ],
        members: [
          createFakeSdCabMember({ id: 'm1', userId: 'u1', required: true }),
          createFakeSdCabMember({ id: 'm2', userId: 'u2' }),
        ],
      }),
    )
    expect(dto.quorum).toBe(0)
    expect(dto.effectiveQuorum).toBe(2)
    expect(dto.conditions).toEqual([
      { field: 'changeRisk', operator: 'equals', value: 'HIGH' },
    ])
    expect(dto.members.map((m) => m.id)).toEqual(['m1', 'm2'])
    expect(dto.members[0]?.required).toBe(true)
    expect(dto.createdAt).toBe('2026-10-01T12:00:00.000Z')
  })

  it('reads junk conditions as "serves every change"', () => {
    const dto = toSdCabBoardDTO(
      createFakeSdCabBoard({ conditions: { nope: true } }),
    )
    expect(dto.conditions).toEqual([])
  })
})

describe('toSdCabMemberDTO', () => {
  it('maps a member without a loaded user', () => {
    expect(
      toSdCabMemberDTO(createFakeSdCabMember({ id: 'm1', user: null })),
    ).toEqual({ id: 'm1', userId: 'u1', user: null, required: false })
  })
})

/** Rodada com os votos dados, e `required` em quem a lista disser. */
function round(
  votes: ('PENDING' | 'APPROVED' | 'REJECTED')[],
  options: { quorum?: number; rejectEnds?: boolean; required?: number[] } = {},
) {
  const required = new Set(options.required ?? [])
  return createFakeSdApprovalRound({
    quorum: options.quorum ?? 1,
    rejectEnds: options.rejectEnds ?? true,
    board: {
      id: 'board1',
      name: 'CAB de infraestrutura',
      members: votes.map((_, index) => ({
        userId: `u${index}`,
        required: required.has(index),
      })),
    },
    approvals: votes.map((status, index) =>
      createFakeSdTicketApproval({
        id: `a${index}`,
        status,
        approverUserId: `u${index}`,
      }),
    ),
  })
}

describe('sdApprovalRoundTally', () => {
  it('counts the votes and what is missing for the quorum', () => {
    expect(
      sdApprovalRoundTally(
        round(['APPROVED', 'REJECTED', 'PENDING'], { quorum: 2 }),
      ),
    ).toEqual({
      total: 3,
      approved: 1,
      rejected: 1,
      pending: 1,
      requiredPending: 0,
      remaining: 1,
    })
  })

  it('counts the pending mandatory votes', () => {
    expect(
      sdApprovalRoundTally(
        round(['APPROVED', 'PENDING'], { quorum: 1, required: [1] }),
      ),
    ).toMatchObject({ requiredPending: 1, remaining: 0 })
  })

  it('never reports a negative remainder', () => {
    expect(
      sdApprovalRoundTally(round(['APPROVED', 'APPROVED'], { quorum: 1 }))
        .remaining,
    ).toBe(0)
  })

  it('ignores a pending approval from outside the board', () => {
    const pending = round(['PENDING'], { quorum: 1, required: [0] })
    pending.approvals[0] = createFakeSdTicketApproval({
      status: 'PENDING',
      approverUserId: null,
    })
    expect(sdApprovalRoundTally(pending).requiredPending).toBe(0)
  })

  it('works on a round without a board', () => {
    const loose = createFakeSdApprovalRound({
      board: null,
      quorum: 1,
      approvals: [createFakeSdTicketApproval({ status: 'APPROVED' })],
    })
    expect(sdApprovalRoundTally(loose)).toMatchObject({
      approved: 1,
      requiredPending: 0,
      remaining: 0,
    })
  })

  it('counts canceled and expired votes only in the total', () => {
    const closed = round(['PENDING'], { quorum: 1 })
    closed.approvals = [
      createFakeSdTicketApproval({ status: 'CANCELED' }),
      createFakeSdTicketApproval({ status: 'EXPIRED' }),
    ]
    expect(sdApprovalRoundTally(closed)).toMatchObject({
      total: 2,
      approved: 0,
      rejected: 0,
      pending: 0,
    })
  })
})

describe('sdApprovalRoundOutcome', () => {
  it('rejects on the first rejection when rejectEnds', () => {
    expect(
      sdApprovalRoundOutcome(
        round(['REJECTED', 'PENDING'], { quorum: 2, rejectEnds: true }),
      ),
    ).toBe('REJECTED')
  })

  it('stays open on a rejection when rejectEnds is off', () => {
    expect(
      sdApprovalRoundOutcome(
        round(['REJECTED', 'PENDING'], { quorum: 1, rejectEnds: false }),
      ),
    ).toBeNull()
  })

  it('approves when the quorum is reached', () => {
    expect(
      sdApprovalRoundOutcome(
        round(['APPROVED', 'APPROVED', 'PENDING'], { quorum: 2 }),
      ),
    ).toBe('APPROVED')
  })

  it('waits for a mandatory vote even with the quorum reached', () => {
    expect(
      sdApprovalRoundOutcome(
        round(['APPROVED', 'APPROVED', 'PENDING'], {
          quorum: 2,
          required: [2],
        }),
      ),
    ).toBeNull()
  })

  it('stays open while the quorum is short', () => {
    expect(
      sdApprovalRoundOutcome(round(['APPROVED', 'PENDING'], { quorum: 2 })),
    ).toBeNull()
  })

  it('closes as rejected when nobody is left and the quorum failed', () => {
    expect(
      sdApprovalRoundOutcome(
        round(['APPROVED', 'REJECTED'], { quorum: 2, rejectEnds: false }),
      ),
    ).toBe('REJECTED')
  })

  it('closes as approved when nobody is left and nobody rejected', () => {
    const expired = round(['APPROVED'], { quorum: 2, rejectEnds: false })
    expired.approvals.push(
      createFakeSdTicketApproval({ status: 'EXPIRED', approverUserId: 'u9' }),
    )
    expect(sdApprovalRoundOutcome(expired)).toBe('APPROVED')
  })
})

describe('toSdApprovalRoundDTO', () => {
  it('maps the round with the approvals and the tally', () => {
    const dto = toSdApprovalRoundDTO(
      round(['APPROVED', 'PENDING'], { quorum: 2 }),
    )
    expect(dto).toMatchObject({
      ticketId: 't1',
      boardId: 'board1',
      boardName: 'CAB de infraestrutura',
      status: 'PENDING',
      quorum: 2,
      rejectEnds: true,
      decidedAt: null,
      createdAt: '2026-10-01T12:00:00.000Z',
    })
    expect(dto.requestedBy?.id).toBe('u1')
    expect(dto.approvals.map((a) => a.id)).toEqual(['a0', 'a1'])
    expect(dto.tally).toMatchObject({ approved: 1, remaining: 1 })
  })

  it('maps a decided round without a board', () => {
    const dto = toSdApprovalRoundDTO(
      createFakeSdApprovalRound({
        board: null,
        boardId: null,
        status: 'APPROVED',
        decidedAt: new Date('2026-10-02T10:00:00.000Z'),
      }),
    )
    expect(dto.boardName).toBeNull()
    expect(dto.boardId).toBeNull()
    expect(dto.decidedAt).toBe('2026-10-02T10:00:00.000Z')
  })
})
