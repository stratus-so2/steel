import { beforeEach, describe, expect, it, vi } from 'vitest'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { actAs } from '@/src/__tests__/helpers/sd-config.helpers'
import { databaseError } from '@/src/errors'
import { err, ok } from '@/src/lib/result'

vi.mock('@/lib/axiom/audit', () => ({ auditMutation: vi.fn() }))
vi.mock('@/src/repositories/membership.repository')
vi.mock('@/src/repositories/sd-access.repository')
vi.mock('@/src/repositories/sd-config.repository')

import { auditMutation } from '@/lib/axiom/audit'
import { SdConfigRepository } from '@/src/repositories/sd-config.repository'
import { assertSdRefs, sdAdminMutation } from '../sd-config-support'

const findRefs = vi.mocked(SdConfigRepository.findExistingRefs)

beforeEach(() => actAs('owner'))

describe('sdAdminMutation', () => {
  it('runs for admins and audits success with a derived target', async () => {
    const run = vi.fn(async () => ok({ id: 'x1' }))
    const value = expectOk(
      await sdAdminMutation({
        actorId: 'u1',
        workspaceId: 'ws1',
        entity: 'sd_part',
        action: 'create',
        targetId: (v) => v.id,
        meta: { a: 1 },
        run,
      }),
    )
    expect(value).toEqual({ id: 'x1' })
    expect(run).toHaveBeenCalledWith(expect.objectContaining({ isAdmin: true }))
    expect(auditMutation).toHaveBeenCalledWith({
      entity: 'sd_part',
      action: 'create',
      actorId: 'u1',
      targetId: 'x1',
      meta: { workspaceId: 'ws1', a: 1 },
    })
  })

  it('audits failures with the error code and a null derived target', async () => {
    expectErr(
      await sdAdminMutation({
        actorId: 'u1',
        workspaceId: 'ws1',
        entity: 'sd_part',
        action: 'create',
        targetId: (v: { id: string }) => v.id,
        run: async () => err(databaseError()),
      }),
      'DATABASE_ERROR',
    )
    expect(auditMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        targetId: null,
        outcome: 'failure',
        reason: 'DATABASE_ERROR',
      }),
    )
  })

  it('uses a fixed target id or null when absent', async () => {
    await sdAdminMutation({
      actorId: 'u1',
      workspaceId: 'ws1',
      entity: 'sd_part',
      action: 'update',
      targetId: 'fixed',
      run: async () => ok(1),
    })
    expect(auditMutation).toHaveBeenLastCalledWith(
      expect.objectContaining({ targetId: 'fixed' }),
    )
    await sdAdminMutation({
      actorId: 'u1',
      workspaceId: 'ws1',
      entity: 'sd_part',
      action: 'update',
      run: async () => ok(1),
    })
    expect(auditMutation).toHaveBeenLastCalledWith(
      expect.objectContaining({ targetId: null }),
    )
  })

  it.each([
    ['agent', 'FORBIDDEN'],
    ['requester', 'FORBIDDEN'],
    ['viewer', 'FORBIDDEN'],
    ['stranger', 'FORBIDDEN'],
    ['disabled', 'MODULE_DISABLED'],
  ] as const)('refuses %s without running or auditing', async (actor, code) => {
    actAs(actor)
    const run = vi.fn()
    expectErr(
      await sdAdminMutation({
        actorId: 'u1',
        workspaceId: 'ws1',
        entity: 'sd_part',
        action: 'create',
        run,
      }),
      code,
    )
    expect(run).not.toHaveBeenCalled()
    expect(auditMutation).not.toHaveBeenCalled()
  })
})

describe('assertSdRefs', () => {
  it('skips the query when there is nothing to check', async () => {
    expectOk(
      await assertSdRefs('ws1', { departmentIds: [null, undefined, ''] }),
    )
    expect(findRefs).not.toHaveBeenCalled()
  })

  it('deduplicates ids and passes when all exist', async () => {
    findRefs.mockResolvedValue(ok({ departmentIds: ['d1'], userIds: ['u1'] }))
    expectOk(
      await assertSdRefs('ws1', {
        departmentIds: ['d1', 'd1'],
        userIds: ['u1'],
      }),
    )
    expect(findRefs).toHaveBeenCalledWith('ws1', {
      departmentIds: ['d1'],
      userIds: ['u1'],
    })
  })

  it('returns SD_CONFIG_NOT_FOUND listing every missing id', async () => {
    findRefs.mockResolvedValue(ok({ departmentIds: ['d1'] }))
    const error = expectErr(
      await assertSdRefs('ws1', {
        departmentIds: ['d1', 'd2'],
        userIds: ['u9'],
      }),
      'SD_CONFIG_NOT_FOUND',
    )
    expect(error.message).toBe('Departamento não encontrado(a) nesta workspace')
    expect(error.details).toEqual({
      missing: [
        { kind: 'departmentIds', id: 'd2' },
        { kind: 'userIds', id: 'u9' },
      ],
    })
  })

  it('propagates repository errors', async () => {
    findRefs.mockResolvedValue(err(databaseError()))
    expectErr(
      await assertSdRefs('ws1', { calendarIds: ['c1'] }),
      'DATABASE_ERROR',
    )
  })
})
