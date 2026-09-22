import { beforeEach, describe, expect, it, vi } from 'vitest'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { actAs } from '@/src/__tests__/helpers/sd-config.helpers'
import { databaseError } from '@/src/errors'
import { err, ok } from '@/src/lib/result'
import type { SdCannedResponseWithAuthor } from '@/src/repositories/sd-canned-response.repository'

vi.mock('@/lib/axiom/audit', () => ({ auditMutation: vi.fn() }))
vi.mock('@/src/repositories/membership.repository')
vi.mock('@/src/repositories/sd-access.repository')
vi.mock('@/src/repositories/sd-config.repository')
vi.mock('@/src/repositories/sd-canned-response.repository')

import { auditMutation } from '@/lib/axiom/audit'
import { SdCannedResponseRepository } from '@/src/repositories/sd-canned-response.repository'
import { SdConfigRepository } from '@/src/repositories/sd-config.repository'
import { SdCannedResponseService } from '../sd-canned-response.service'

const repo = vi.mocked(SdCannedResponseRepository)
const refs = vi.mocked(SdConfigRepository.findExistingRefs)
const WS = 'ws1'

function response(
  overrides: Partial<SdCannedResponseWithAuthor> = {},
): SdCannedResponseWithAuthor {
  const now = new Date()
  return {
    id: 'cr1',
    workspaceId: WS,
    title: 'Saudação',
    shortcut: 'oi',
    body: 'Olá!',
    departmentId: null,
    createdById: 'u1',
    createdAt: now,
    updatedAt: now,
    createdBy: { name: 'Ana' },
    ...overrides,
  }
}

beforeEach(() => {
  actAs('agent')
  refs.mockImplementation(async (_ws, wanted) => ok(wanted))
})

describe('SdCannedResponseService.list', () => {
  it('lists for agents with filters', async () => {
    repo.list.mockResolvedValue(
      ok([response(), response({ id: 'cr2', createdBy: null })]),
    )
    const list = expectOk(
      await SdCannedResponseService.list('u1', WS, {
        departmentId: 'd1',
        q: 'oi',
      }),
    )
    expect(list[0].createdByName).toBe('Ana')
    expect(list[1].createdByName).toBeNull()
    expect(repo.list).toHaveBeenCalledWith(WS, { departmentId: 'd1', q: 'oi' })
    expectOk(await SdCannedResponseService.list('u1', WS))
    expect(repo.list).toHaveBeenLastCalledWith(WS, {})
  })

  it('refuses requesters and propagates errors', async () => {
    actAs('requester')
    expectErr(await SdCannedResponseService.list('u1', WS), 'SD_NOT_AGENT')
    actAs('agent')
    repo.list.mockResolvedValue(err(databaseError()))
    expectErr(await SdCannedResponseService.list('u1', WS), 'DATABASE_ERROR')
  })
})

describe('SdCannedResponseService.create', () => {
  const dto = { title: 'Oi', body: 'Olá', departmentId: 'd1' }

  it('lets agents create and audits', async () => {
    repo.create.mockResolvedValue(ok(response()))
    expectOk(await SdCannedResponseService.create('u1', WS, dto))
    expect(repo.create).toHaveBeenCalledWith(WS, 'u1', dto)
    expect(auditMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        entity: 'sd_canned_response',
        action: 'create',
        targetId: 'cr1',
      }),
    )
  })

  it('audits create failures', async () => {
    repo.create.mockResolvedValue(err(databaseError()))
    expectErr(
      await SdCannedResponseService.create('u1', WS, dto),
      'DATABASE_ERROR',
    )
    expect(auditMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: 'failure',
        targetId: null,
        reason: 'DATABASE_ERROR',
      }),
    )
  })

  it('refuses requesters, disabled module and foreign departments', async () => {
    actAs('requester')
    expectErr(
      await SdCannedResponseService.create('u1', WS, dto),
      'SD_NOT_AGENT',
    )
    actAs('disabled')
    expectErr(
      await SdCannedResponseService.create('u1', WS, dto),
      'MODULE_DISABLED',
    )
    actAs('agent')
    refs.mockResolvedValue(ok({ departmentIds: [] }))
    expectErr(
      await SdCannedResponseService.create('u1', WS, dto),
      'SD_CONFIG_NOT_FOUND',
    )
  })
})

describe('SdCannedResponseService.update', () => {
  it('lets the author edit', async () => {
    repo.findById.mockResolvedValue(ok(response()))
    repo.update.mockResolvedValue(ok(response({ title: 'Novo' })))
    const updated = expectOk(
      await SdCannedResponseService.update('u1', WS, 'cr1', { title: 'Novo' }),
    )
    expect(updated.title).toBe('Novo')
  })

  it("refuses another agent's response", async () => {
    repo.findById.mockResolvedValue(ok(response({ createdById: 'other' })))
    expectErr(
      await SdCannedResponseService.update('u1', WS, 'cr1', { title: 'x' }),
      'FORBIDDEN',
    )
    expect(repo.update).not.toHaveBeenCalled()
  })

  it('lets admins edit any response', async () => {
    actAs('admin')
    repo.findById.mockResolvedValue(ok(response({ createdById: 'other' })))
    repo.update.mockResolvedValue(ok(response()))
    expectOk(
      await SdCannedResponseService.update('u1', WS, 'cr1', { title: 'x' }),
    )
  })

  it('propagates errors', async () => {
    actAs('requester')
    expectErr(
      await SdCannedResponseService.update('u1', WS, 'cr1', { title: 'x' }),
      'SD_NOT_AGENT',
    )
    actAs('agent')
    repo.findById.mockResolvedValue(err(databaseError()))
    expectErr(
      await SdCannedResponseService.update('u1', WS, 'cr1', { title: 'x' }),
      'DATABASE_ERROR',
    )
    repo.findById.mockResolvedValue(ok(response()))
    refs.mockResolvedValue(ok({ departmentIds: [] }))
    expectErr(
      await SdCannedResponseService.update('u1', WS, 'cr1', {
        departmentId: 'd9',
      }),
      'SD_CONFIG_NOT_FOUND',
    )
    refs.mockImplementation(async (_ws, wanted) => ok(wanted))
    repo.update.mockResolvedValue(err(databaseError()))
    expectErr(
      await SdCannedResponseService.update('u1', WS, 'cr1', { title: 'x' }),
      'DATABASE_ERROR',
    )
  })
})

describe('SdCannedResponseService.remove', () => {
  it('lets the author delete', async () => {
    repo.findById.mockResolvedValue(ok(response()))
    repo.delete.mockResolvedValue(ok(undefined))
    expectOk(await SdCannedResponseService.remove('u1', WS, 'cr1'))
    expect(auditMutation).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'delete', targetId: 'cr1' }),
    )
  })

  it("refuses another agent's response and propagates errors", async () => {
    repo.findById.mockResolvedValue(ok(response({ createdById: 'other' })))
    expectErr(
      await SdCannedResponseService.remove('u1', WS, 'cr1'),
      'FORBIDDEN',
    )
    actAs('requester')
    expectErr(
      await SdCannedResponseService.remove('u1', WS, 'cr1'),
      'SD_NOT_AGENT',
    )
  })
})
