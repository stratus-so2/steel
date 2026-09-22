import type { Role } from '@prisma/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createFakeMembership } from '@/src/__tests__/factories/membership.factory'
import { createFakeSdSavedView } from '@/src/__tests__/factories/sd-ticket.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { databaseError, notFound } from '@/src/errors'
import { err, ok } from '@/src/lib/result'

vi.mock('@/src/repositories/membership.repository')
vi.mock('@/src/repositories/sd-access.repository')
vi.mock('@/src/repositories/sd-saved-view.repository')
vi.mock('@/lib/axiom/audit')

import { auditMutation } from '@/lib/axiom/audit'
import { MembershipRepository } from '@/src/repositories/membership.repository'
import { SdAccessRepository } from '@/src/repositories/sd-access.repository'
import { SdSavedViewRepository } from '@/src/repositories/sd-saved-view.repository'
import { SdSavedViewService } from '../sd-saved-view.service'

const repo = vi.mocked(SdSavedViewRepository)

function as(role: Role, agent = true) {
  vi.mocked(MembershipRepository).findByUserAndWorkspace.mockResolvedValue(
    ok(createFakeMembership({ role })),
  )
  vi.mocked(SdAccessRepository).listDepartmentLinks.mockResolvedValue(
    ok(agent ? [{ departmentId: 'd', parentId: null, isLead: false }] : []),
  )
}

beforeEach(() => as('MEMBER'))

describe('SdSavedViewService', () => {
  it('denies requesters', async () => {
    as('MEMBER', false)
    expectErr(await SdSavedViewService.list('u1', 'ws1'), 'SD_NOT_AGENT')
    expectErr(
      await SdSavedViewService.create('u1', 'ws1', {
        name: 'x',
        mode: 'KANBAN',
        filters: {},
        sort: [],
        columns: [],
        shared: false,
      }),
      'SD_NOT_AGENT',
    )
    expectErr(await SdSavedViewService.remove('u1', 'ws1', 'v'), 'SD_NOT_AGENT')
  })

  it('lists own and shared views with editability', async () => {
    repo.listVisible.mockResolvedValue(
      ok([
        createFakeSdSavedView({ id: 'mine', userId: 'u1' }),
        createFakeSdSavedView({ id: 'shared', userId: 'u2', shared: true }),
      ]),
    )
    const views = expectOk(await SdSavedViewService.list('u1', 'ws1'))
    expect(views.map((v) => [v.id, v.editable])).toEqual([
      ['mine', true],
      ['shared', false],
    ])
    repo.listVisible.mockResolvedValue(err(databaseError()))
    expectErr(await SdSavedViewService.list('u1', 'ws1'), 'DATABASE_ERROR')
  })

  it('admins can edit shared views of others', async () => {
    as('ADMIN', false)
    repo.listVisible.mockResolvedValue(
      ok([createFakeSdSavedView({ userId: 'u2', shared: true })]),
    )
    expect(
      expectOk(await SdSavedViewService.list('u1', 'ws1'))[0].editable,
    ).toBe(true)
  })

  it('creates a view for the actor and audits', async () => {
    repo.create.mockResolvedValue(
      ok(createFakeSdSavedView({ id: 'v1', userId: 'u1' })),
    )
    const view = expectOk(
      await SdSavedViewService.create('u1', 'ws1', {
        name: 'Fila',
        mode: 'LIST',
        filters: { a: 'b' },
        sort: [],
        columns: ['title'],
        shared: true,
      }),
    )
    expect(view.editable).toBe(true)
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'u1', ticketType: null, mode: 'LIST' }),
    )
    expect(auditMutation).toHaveBeenCalledWith(
      expect.objectContaining({ entity: 'sd_saved_view', action: 'create' }),
    )
    repo.create.mockResolvedValue(err(databaseError()))
    expectErr(
      await SdSavedViewService.create('u1', 'ws1', {
        name: 'Fila',
        ticketType: 'INCIDENT',
        mode: 'LIST',
        filters: {},
        sort: [],
        columns: [],
        shared: false,
      }),
    )
  })

  it('update: not found, hidden personal view, forbidden shared, success', async () => {
    repo.findById.mockResolvedValue(err(notFound('Visão salva')))
    expectErr(
      await SdSavedViewService.update('u1', 'ws1', 'v', { name: 'x' }),
      'RESOURCE_NOT_FOUND',
    )
    repo.findById.mockResolvedValue(ok(createFakeSdSavedView({ userId: 'u2' })))
    expectErr(
      await SdSavedViewService.update('u1', 'ws1', 'v', { name: 'x' }),
      'RESOURCE_NOT_FOUND',
    )
    repo.findById.mockResolvedValue(
      ok(createFakeSdSavedView({ userId: 'u2', shared: true })),
    )
    expectErr(
      await SdSavedViewService.update('u1', 'ws1', 'v', { name: 'x' }),
      'FORBIDDEN',
    )

    repo.findById.mockResolvedValue(ok(createFakeSdSavedView({ userId: 'u1' })))
    repo.update.mockResolvedValue(
      ok(createFakeSdSavedView({ userId: 'u1', name: 'Novo' })),
    )
    const all = {
      name: 'Novo',
      ticketType: null,
      mode: 'TABLE' as const,
      filters: {},
      sort: [],
      columns: [],
      shared: true,
      position: 2,
    }
    expect(
      expectOk(await SdSavedViewService.update('u1', 'ws1', 'v', all)).name,
    ).toBe('Novo')
    expect(repo.update).toHaveBeenCalledWith('v', all)
    await SdSavedViewService.update('u1', 'ws1', 'v', { shared: false })
    expect(repo.update).toHaveBeenLastCalledWith('v', { shared: false })

    repo.update.mockResolvedValue(err(databaseError()))
    expectErr(await SdSavedViewService.update('u1', 'ws1', 'v', { name: 'x' }))
  })

  it('removes a view', async () => {
    repo.findById.mockResolvedValue(ok(createFakeSdSavedView({ userId: 'u1' })))
    repo.delete.mockResolvedValue(ok(undefined))
    expectOk(await SdSavedViewService.remove('u1', 'ws1', 'v'))
    expect(auditMutation).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'delete', targetId: 'v' }),
    )
    repo.delete.mockResolvedValue(err(databaseError()))
    expectErr(await SdSavedViewService.remove('u1', 'ws1', 'v'))
  })
})
