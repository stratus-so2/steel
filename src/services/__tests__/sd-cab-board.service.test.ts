import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createFakeSdCabBoard,
  createFakeSdCabMember,
} from '@/src/__tests__/factories/sd-change.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { actAs } from '@/src/__tests__/helpers/sd-config.helpers'
import { databaseError, sdCabBoardNotFound } from '@/src/errors'
import { err, ok } from '@/src/lib/result'
import { CreateSdCabBoardSchema } from '@/src/schemas/sd-cab-board.schema'

vi.mock('@/lib/axiom/audit', () => ({ auditMutation: vi.fn() }))
vi.mock('@/src/repositories/membership.repository')
vi.mock('@/src/repositories/sd-access.repository')
vi.mock('@/src/repositories/sd-cab-board.repository')
vi.mock('@/src/repositories/sd-config.repository')

import { auditMutation } from '@/lib/axiom/audit'
import { SdCabBoardRepository } from '@/src/repositories/sd-cab-board.repository'
import { SdConfigRepository } from '@/src/repositories/sd-config.repository'
import { SdCabBoardService, selectSdCabBoard } from '../sd-cab-board.service'

const repo = vi.mocked(SdCabBoardRepository)
const configRepo = vi.mocked(SdConfigRepository)

const input = CreateSdCabBoardSchema.parse({
  name: 'CAB de infraestrutura',
  members: [{ userId: 'u2' }],
})

beforeEach(() => {
  actAs('admin')
  repo.list.mockResolvedValue(ok([createFakeSdCabBoard()]))
  repo.findById.mockResolvedValue(ok(createFakeSdCabBoard()))
  repo.create.mockResolvedValue(ok(createFakeSdCabBoard()))
  repo.update.mockResolvedValue(ok(createFakeSdCabBoard({ name: 'Novo' })))
  repo.softDelete.mockResolvedValue(ok(undefined))
  configRepo.findExistingRefs.mockResolvedValue(ok({ userIds: ['u1', 'u2'] }))
})

describe('selectSdCabBoard', () => {
  const infra = createFakeSdCabBoard({
    id: 'infra',
    conditions: [{ field: 'changeRisk', operator: 'equals', value: 'HIGH' }],
  })
  const fallback = createFakeSdCabBoard({ id: 'fallback', conditions: [] })

  it('picks the first board whose conditions match', () => {
    expect(
      selectSdCabBoard([infra, fallback], { changeRisk: 'HIGH' })?.id,
    ).toBe('infra')
  })

  it('falls through to a board with no conditions', () => {
    expect(selectSdCabBoard([infra, fallback], { changeRisk: 'LOW' })?.id).toBe(
      'fallback',
    )
  })

  it('skips inactive boards and boards with no members', () => {
    expect(
      selectSdCabBoard(
        [
          createFakeSdCabBoard({ id: 'off', active: false, conditions: [] }),
          createFakeSdCabBoard({ id: 'empty', members: [], conditions: [] }),
          fallback,
        ],
        {},
      )?.id,
    ).toBe('fallback')
  })

  it('reads junk conditions as "serves every change"', () => {
    expect(
      selectSdCabBoard(
        [createFakeSdCabBoard({ id: 'junk', conditions: { nope: 1 } })],
        {},
      )?.id,
    ).toBe('junk')
  })

  it('returns null when nothing matches', () => {
    expect(selectSdCabBoard([infra], { changeRisk: 'LOW' })).toBeNull()
    expect(selectSdCabBoard([], {})).toBeNull()
  })
})

describe('SdCabBoardService.list', () => {
  it('lets any agent read the committees', async () => {
    actAs('agent')
    const list = expectOk(await SdCabBoardService.list('u1', 'ws1'))
    expect(list[0].effectiveQuorum).toBe(1)
  })

  it('refuses a requester and a stranger', async () => {
    actAs('requester')
    expectErr(await SdCabBoardService.list('u1', 'ws1'), 'SD_NOT_AGENT')
    actAs('stranger')
    expectErr(await SdCabBoardService.list('u1', 'ws1'), 'FORBIDDEN')
  })

  it('forwards includeInactive and propagates db errors', async () => {
    expectOk(
      await SdCabBoardService.list('u1', 'ws1', { includeInactive: true }),
    )
    expect(repo.list).toHaveBeenCalledWith('ws1', { includeInactive: true })
    repo.list.mockResolvedValue(err(databaseError()))
    expectErr(await SdCabBoardService.list('u1', 'ws1'), 'DATABASE_ERROR')
  })
})

describe('SdCabBoardService.create', () => {
  it('creates and audits', async () => {
    expectOk(await SdCabBoardService.create('u1', 'ws1', input))
    expect(repo.create).toHaveBeenCalledWith(
      'ws1',
      'u1',
      expect.objectContaining({
        name: 'CAB de infraestrutura',
        members: [{ userId: 'u2', required: false }],
      }),
    )
    expect(auditMutation).toHaveBeenCalledWith(
      expect.objectContaining({ entity: 'sd_cab_board', action: 'create' }),
    )
  })

  it('maps the full dto', async () => {
    expectOk(
      await SdCabBoardService.create('u1', 'ws1', {
        ...input,
        description: 'Comitê de infra',
        quorum: 1,
        rejectEnds: false,
        active: false,
        position: 3,
        conditions: [
          { field: 'changeType', operator: 'equals', value: 'NORMAL' },
        ],
      }),
    )
    expect(repo.create).toHaveBeenCalledWith(
      'ws1',
      'u1',
      expect.objectContaining({
        description: 'Comitê de infra',
        quorum: 1,
        rejectEnds: false,
        active: false,
        position: 3,
        conditions: [
          { field: 'changeType', operator: 'equals', value: 'NORMAL' },
        ],
      }),
    )
  })

  it('only admins create', async () => {
    actAs('agent')
    expectErr(await SdCabBoardService.create('u1', 'ws1', input), 'FORBIDDEN')
  })

  it('refuses a committee with no members', async () => {
    const e = expectErr(
      await SdCabBoardService.create('u1', 'ws1', { ...input, members: [] }),
      'SD_CAB_QUORUM_INVALID',
    )
    expect(e.message).toContain('sem membros')
  })

  it('refuses a quorum bigger than the committee', async () => {
    const e = expectErr(
      await SdCabBoardService.create('u1', 'ws1', { ...input, quorum: 3 }),
      'SD_CAB_QUORUM_INVALID',
    )
    expect(e.message).toContain('não cabe em 1 membro')
  })

  it('refuses a member from outside the workspace', async () => {
    configRepo.findExistingRefs.mockResolvedValue(ok({ userIds: [] }))
    expectErr(
      await SdCabBoardService.create('u1', 'ws1', input),
      'SD_CONFIG_NOT_FOUND',
    )
  })

  it('propagates a db error from the repository', async () => {
    repo.create.mockResolvedValue(err(databaseError()))
    expectErr(
      await SdCabBoardService.create('u1', 'ws1', input),
      'DATABASE_ERROR',
    )
  })
})

describe('SdCabBoardService.update', () => {
  it('updates and audits the touched fields', async () => {
    const updated = expectOk(
      await SdCabBoardService.update('u1', 'ws1', 'board1', { name: 'Novo' }),
    )
    expect(updated.name).toBe('Novo')
    expect(repo.update).toHaveBeenCalledWith('board1', 'ws1', { name: 'Novo' })
    expect(auditMutation).toHaveBeenCalledWith(
      expect.objectContaining({ entity: 'sd_cab_board', action: 'update' }),
    )
  })

  it('replaces the member list and validates it', async () => {
    expectOk(
      await SdCabBoardService.update('u1', 'ws1', 'board1', {
        members: [{ userId: 'u2', required: true }],
      }),
    )
    expect(repo.update).toHaveBeenCalledWith('board1', 'ws1', {
      members: [{ userId: 'u2', required: true }],
    })
  })

  it('clears the description and maps the rest', async () => {
    expectOk(
      await SdCabBoardService.update('u1', 'ws1', 'board1', {
        description: null,
        rejectEnds: false,
        active: true,
        position: 2,
        conditions: [],
      }),
    )
    expect(repo.update).toHaveBeenCalledWith('board1', 'ws1', {
      description: null,
      rejectEnds: false,
      active: true,
      position: 2,
      conditions: [],
    })
  })

  it('checks the new quorum against the stored members', async () => {
    repo.findById.mockResolvedValue(
      ok(createFakeSdCabBoard({ members: [createFakeSdCabMember()] })),
    )
    expectErr(
      await SdCabBoardService.update('u1', 'ws1', 'board1', { quorum: 4 }),
      'SD_CAB_QUORUM_INVALID',
    )
    expectOk(
      await SdCabBoardService.update('u1', 'ws1', 'board1', { quorum: 1 }),
    )
  })

  it('checks the new quorum against the new member list', async () => {
    expectOk(
      await SdCabBoardService.update('u1', 'ws1', 'board1', {
        quorum: 2,
        members: [
          { userId: 'u1', required: false },
          { userId: 'u2', required: true },
        ],
      }),
    )
    expectErr(
      await SdCabBoardService.update('u1', 'ws1', 'board1', {
        quorum: 2,
        members: [{ userId: 'u1', required: false }],
      }),
      'SD_CAB_QUORUM_INVALID',
    )
  })

  it('refuses emptying a committee whose quorum is 0', async () => {
    expectErr(
      await SdCabBoardService.update('u1', 'ws1', 'board1', { members: [] }),
      'SD_CAB_QUORUM_INVALID',
    )
  })

  it('refuses a member from outside the workspace', async () => {
    configRepo.findExistingRefs.mockResolvedValue(ok({ userIds: [] }))
    expectErr(
      await SdCabBoardService.update('u1', 'ws1', 'board1', {
        members: [{ userId: 'u9', required: false }],
      }),
      'SD_CONFIG_NOT_FOUND',
    )
  })

  it('refuses an unknown committee and non-admins', async () => {
    repo.findById.mockResolvedValue(err(sdCabBoardNotFound()))
    expectErr(
      await SdCabBoardService.update('u1', 'ws1', 'nope', { name: 'X' }),
      'SD_CAB_BOARD_NOT_FOUND',
    )
    actAs('agent')
    expectErr(
      await SdCabBoardService.update('u1', 'ws1', 'board1', { name: 'X' }),
      'FORBIDDEN',
    )
  })

  it('propagates a db error from the update', async () => {
    repo.update.mockResolvedValue(err(databaseError()))
    expectErr(
      await SdCabBoardService.update('u1', 'ws1', 'board1', { name: 'X' }),
      'DATABASE_ERROR',
    )
  })
})

describe('SdCabBoardService.remove', () => {
  it('soft-deletes and audits', async () => {
    expectOk(await SdCabBoardService.remove('u1', 'ws1', 'board1'))
    expect(repo.softDelete).toHaveBeenCalledWith('board1', 'ws1')
    expect(auditMutation).toHaveBeenCalledWith(
      expect.objectContaining({ entity: 'sd_cab_board', action: 'delete' }),
    )
  })

  it('refuses an unknown committee and non-admins', async () => {
    repo.findById.mockResolvedValue(err(sdCabBoardNotFound()))
    expectErr(
      await SdCabBoardService.remove('u1', 'ws1', 'nope'),
      'SD_CAB_BOARD_NOT_FOUND',
    )
    actAs('agent')
    expectErr(
      await SdCabBoardService.remove('u1', 'ws1', 'board1'),
      'FORBIDDEN',
    )
  })
})
