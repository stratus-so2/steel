import type { SdPhase, SdPhaseTransition } from '@prisma/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { actAs } from '@/src/__tests__/helpers/sd-config.helpers'
import { databaseError } from '@/src/errors'
import { err, ok } from '@/src/lib/result'

vi.mock('@/lib/axiom/audit', () => ({ auditMutation: vi.fn() }))
vi.mock('@/src/repositories/membership.repository')
vi.mock('@/src/repositories/sd-access.repository')
vi.mock('@/src/repositories/sd-config.repository')
vi.mock('@/src/repositories/sd-phase.repository')

import { auditMutation } from '@/lib/axiom/audit'
import { SdConfigRepository } from '@/src/repositories/sd-config.repository'
import { SdPhaseRepository } from '@/src/repositories/sd-phase.repository'
import { SdPhaseService } from '../sd-phase.service'

const repo = vi.mocked(SdPhaseRepository)
const WS = 'ws1'

function phase(overrides: Partial<SdPhase> = {}): SdPhase {
  const now = new Date('2026-01-01T00:00:00Z')
  return {
    id: 'ph1',
    workspaceId: WS,
    ticketType: 'INCIDENT',
    name: 'Novo',
    description: null,
    color: '#000000',
    category: 'NEW',
    completionPercent: 0,
    position: 0,
    isInitial: false,
    pausesSla: false,
    requiresApproval: false,
    requiredFields: [],
    wipLimit: 0,
    active: true,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

function transition(
  overrides: Partial<SdPhaseTransition> = {},
): SdPhaseTransition {
  return {
    id: 't1',
    workspaceId: WS,
    fromPhaseId: 'ph1',
    toPhaseId: 'ph2',
    allowedDepartmentIds: [],
    createdAt: new Date(),
    ...overrides,
  }
}

const createDto = {
  ticketType: 'INCIDENT' as const,
  name: 'Em atendimento',
  category: 'IN_PROGRESS' as const,
  completionPercent: 40,
  isInitial: false,
  pausesSla: false,
  requiresApproval: false,
  requiredFields: [],
  wipLimit: 0,
  active: true,
}

beforeEach(() => {
  actAs('owner')
  vi.mocked(SdConfigRepository.findExistingRefs).mockImplementation(
    async (_ws, wanted) => ok(wanted),
  )
})

describe('SdPhaseService.list', () => {
  it('lists phases for any member (requester included)', async () => {
    actAs('requester')
    repo.list.mockResolvedValue(ok([phase()]))
    const list = expectOk(
      await SdPhaseService.list('u1', WS, {
        ticketType: 'INCIDENT',
        includeInactive: true,
      }),
    )
    expect(list[0]).toMatchObject({ id: 'ph1', name: 'Novo' })
    expect(repo.list).toHaveBeenCalledWith(WS, {
      ticketType: 'INCIDENT',
      includeInactive: true,
    })
  })

  it('uses default filters', async () => {
    repo.list.mockResolvedValue(ok([]))
    expectOk(await SdPhaseService.list('u1', WS))
    expect(repo.list).toHaveBeenCalledWith(WS, { includeInactive: false })
  })

  it('denies strangers and disabled module', async () => {
    actAs('stranger')
    expectErr(await SdPhaseService.list('u1', WS), 'FORBIDDEN')
    actAs('disabled')
    expectErr(await SdPhaseService.list('u1', WS), 'MODULE_DISABLED')
  })

  it('propagates db errors', async () => {
    repo.list.mockResolvedValue(err(databaseError()))
    expectErr(await SdPhaseService.list('u1', WS), 'DATABASE_ERROR')
  })
})

describe('SdPhaseService.create', () => {
  it.each([
    ['requester', 'FORBIDDEN'],
    ['agent', 'FORBIDDEN'],
    ['viewer', 'FORBIDDEN'],
    ['stranger', 'FORBIDDEN'],
    ['disabled', 'MODULE_DISABLED'],
  ] as const)('denies %s', async (actor, code) => {
    actAs(actor)
    expectErr(await SdPhaseService.create('u1', WS, createDto), code)
    expect(repo.create).not.toHaveBeenCalled()
  })

  it('makes the first phase of the type initial', async () => {
    repo.countInitial.mockResolvedValue(ok(0))
    repo.create.mockResolvedValue(ok(phase({ isInitial: true })))
    const created = expectOk(await SdPhaseService.create('u1', WS, createDto))
    expect(created.isInitial).toBe(true)
    expect(repo.create).toHaveBeenCalledWith(
      WS,
      expect.objectContaining({ isInitial: true }),
    )
    expect(auditMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        entity: 'sd_phase',
        action: 'create',
        targetId: 'ph1',
      }),
    )
  })

  it('keeps isInitial false when an initial exists', async () => {
    repo.countInitial.mockResolvedValue(ok(1))
    repo.create.mockResolvedValue(ok(phase()))
    expectOk(await SdPhaseService.create('u1', WS, createDto))
    expect(repo.create).toHaveBeenCalledWith(
      WS,
      expect.objectContaining({ isInitial: false }),
    )
  })

  it('refuses an inactive initial phase', async () => {
    repo.countInitial.mockResolvedValue(ok(1))
    const e = expectErr(
      await SdPhaseService.create('u1', WS, {
        ...createDto,
        isInitial: true,
        active: false,
      }),
      'SD_CONFIG_CONFLICT',
    )
    expect(e.message).toMatch(/ativa/)
    expect(auditMutation).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: 'failure' }),
    )
  })

  it('propagates count and create errors', async () => {
    repo.countInitial.mockResolvedValue(err(databaseError()))
    expectErr(
      await SdPhaseService.create('u1', WS, createDto),
      'DATABASE_ERROR',
    )
    repo.countInitial.mockResolvedValue(ok(1))
    repo.create.mockResolvedValue(err(databaseError()))
    expectErr(
      await SdPhaseService.create('u1', WS, createDto),
      'DATABASE_ERROR',
    )
  })
})

describe('SdPhaseService.update', () => {
  it('denies non-admins', async () => {
    actAs('agent')
    expectErr(
      await SdPhaseService.update('u1', WS, 'ph1', { name: 'X' }),
      'FORBIDDEN',
    )
  })

  it('updates a phase', async () => {
    repo.findById.mockResolvedValue(ok(phase()))
    repo.update.mockResolvedValue(ok(phase({ name: 'X' })))
    const updated = expectOk(
      await SdPhaseService.update('u1', WS, 'ph1', { name: 'X' }),
    )
    expect(updated.name).toBe('X')
  })

  it('refuses unsetting the initial flag', async () => {
    repo.findById.mockResolvedValue(ok(phase({ isInitial: true })))
    expectErr(
      await SdPhaseService.update('u1', WS, 'ph1', { isInitial: false }),
      'SD_CONFIG_CONFLICT',
    )
  })

  it('refuses deactivating the initial phase', async () => {
    repo.findById.mockResolvedValue(ok(phase({ isInitial: true })))
    expectErr(
      await SdPhaseService.update('u1', WS, 'ph1', { active: false }),
      'SD_CONFIG_CONFLICT',
    )
  })

  it('refuses making an inactive phase initial', async () => {
    repo.findById.mockResolvedValue(ok(phase({ active: false })))
    expectErr(
      await SdPhaseService.update('u1', WS, 'ph1', { isInitial: true }),
      'SD_CONFIG_CONFLICT',
    )
  })

  it('allows making an inactive phase initial while activating it', async () => {
    repo.findById.mockResolvedValue(ok(phase({ active: false })))
    repo.update.mockResolvedValue(ok(phase({ isInitial: true })))
    expectOk(
      await SdPhaseService.update('u1', WS, 'ph1', {
        isInitial: true,
        active: true,
      }),
    )
  })

  it('propagates not found and update errors', async () => {
    repo.findById.mockResolvedValue(err(databaseError()))
    expectErr(
      await SdPhaseService.update('u1', WS, 'ph1', { name: 'X' }),
      'DATABASE_ERROR',
    )
    repo.findById.mockResolvedValue(ok(phase()))
    repo.update.mockResolvedValue(err(databaseError()))
    expectErr(
      await SdPhaseService.update('u1', WS, 'ph1', { name: 'X' }),
      'DATABASE_ERROR',
    )
  })
})

describe('SdPhaseService.remove', () => {
  it('denies non-admins', async () => {
    actAs('requester')
    expectErr(await SdPhaseService.remove('u1', WS, 'ph1'), 'FORBIDDEN')
  })

  it('deletes a phase without tickets', async () => {
    repo.findById.mockResolvedValue(ok(phase()))
    repo.countTickets.mockResolvedValue(ok(0))
    repo.delete.mockResolvedValue(ok(undefined))
    expectOk(await SdPhaseService.remove('u1', WS, 'ph1'))
    expect(repo.delete).toHaveBeenCalledWith('ph1', WS)
  })

  it('refuses deleting the initial phase', async () => {
    repo.findById.mockResolvedValue(ok(phase({ isInitial: true })))
    expectErr(
      await SdPhaseService.remove('u1', WS, 'ph1'),
      'SD_CONFIG_CONFLICT',
    )
  })

  it('refuses deleting a phase with tickets', async () => {
    repo.findById.mockResolvedValue(ok(phase()))
    repo.countTickets.mockResolvedValue(ok(3))
    const e = expectErr(
      await SdPhaseService.remove('u1', WS, 'ph1'),
      'SD_CONFIG_CONFLICT',
    )
    expect(e.message).toMatch(/desative/)
  })

  it('propagates errors', async () => {
    repo.findById.mockResolvedValue(err(databaseError()))
    expectErr(await SdPhaseService.remove('u1', WS, 'ph1'), 'DATABASE_ERROR')
    repo.findById.mockResolvedValue(ok(phase()))
    repo.countTickets.mockResolvedValue(err(databaseError()))
    expectErr(await SdPhaseService.remove('u1', WS, 'ph1'), 'DATABASE_ERROR')
  })
})

describe('SdPhaseService.reorder', () => {
  it('reorders for admins', async () => {
    repo.reorder.mockResolvedValue(ok(undefined))
    expectOk(await SdPhaseService.reorder('u1', WS, 'CHANGE', ['a', 'b']))
    expect(repo.reorder).toHaveBeenCalledWith(WS, 'CHANGE', ['a', 'b'])
  })

  it('denies non-admins', async () => {
    actAs('viewer')
    expectErr(
      await SdPhaseService.reorder('u1', WS, 'CHANGE', ['a']),
      'FORBIDDEN',
    )
  })
})

describe('SdPhaseService transitions', () => {
  it('lists transitions for members', async () => {
    actAs('requester')
    repo.listTransitions.mockResolvedValue(ok([transition()]))
    const list = expectOk(
      await SdPhaseService.listTransitions('u1', WS, 'INCIDENT'),
    )
    expect(list).toEqual([
      {
        id: 't1',
        fromPhaseId: 'ph1',
        toPhaseId: 'ph2',
        allowedDepartmentIds: [],
      },
    ])
  })

  it('denies strangers and propagates list errors', async () => {
    actAs('stranger')
    expectErr(
      await SdPhaseService.listTransitions('u1', WS, 'INCIDENT'),
      'FORBIDDEN',
    )
    actAs('owner')
    repo.listTransitions.mockResolvedValue(err(databaseError()))
    expectErr(
      await SdPhaseService.listTransitions('u1', WS, 'INCIDENT'),
      'DATABASE_ERROR',
    )
  })

  const dto = {
    transitions: [
      { fromPhaseId: 'ph1', toPhaseId: 'ph2', allowedDepartmentIds: ['d1'] },
    ],
  }

  it('saves the full matrix', async () => {
    repo.list.mockResolvedValue(ok([phase(), phase({ id: 'ph2' })]))
    repo.saveTransitions.mockResolvedValue(
      ok([transition({ allowedDepartmentIds: ['d1'] })]),
    )
    const saved = expectOk(
      await SdPhaseService.saveTransitions('u1', WS, 'INCIDENT', dto),
    )
    expect(saved).toHaveLength(1)
    expect(repo.list).toHaveBeenCalledWith(WS, {
      ticketType: 'INCIDENT',
      includeInactive: true,
    })
    expect(repo.saveTransitions).toHaveBeenCalledWith(
      WS,
      'INCIDENT',
      dto.transitions,
    )
  })

  it('refuses phases of another type/workspace', async () => {
    repo.list.mockResolvedValue(ok([phase()]))
    expectErr(
      await SdPhaseService.saveTransitions('u1', WS, 'INCIDENT', dto),
      'SD_PHASE_NOT_FOUND',
    )
    repo.list.mockResolvedValue(ok([phase({ id: 'ph2' })]))
    expectErr(
      await SdPhaseService.saveTransitions('u1', WS, 'INCIDENT', dto),
      'SD_PHASE_NOT_FOUND',
    )
  })

  it('refuses unknown departments', async () => {
    repo.list.mockResolvedValue(ok([phase(), phase({ id: 'ph2' })]))
    vi.mocked(SdConfigRepository.findExistingRefs).mockResolvedValue(
      ok({ departmentIds: [] }),
    )
    expectErr(
      await SdPhaseService.saveTransitions('u1', WS, 'INCIDENT', dto),
      'SD_CONFIG_NOT_FOUND',
    )
  })

  it('propagates list/save errors and denies non-admins', async () => {
    repo.list.mockResolvedValue(err(databaseError()))
    expectErr(
      await SdPhaseService.saveTransitions('u1', WS, 'INCIDENT', dto),
      'DATABASE_ERROR',
    )
    repo.list.mockResolvedValue(ok([phase(), phase({ id: 'ph2' })]))
    repo.saveTransitions.mockResolvedValue(err(databaseError()))
    expectErr(
      await SdPhaseService.saveTransitions('u1', WS, 'INCIDENT', dto),
      'DATABASE_ERROR',
    )
    actAs('agent')
    expectErr(
      await SdPhaseService.saveTransitions('u1', WS, 'INCIDENT', dto),
      'FORBIDDEN',
    )
  })
})
