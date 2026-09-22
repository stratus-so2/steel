import type { SdTicketTemplate } from '@prisma/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { actAs } from '@/src/__tests__/helpers/sd-config.helpers'
import { databaseError } from '@/src/errors'
import { err, ok } from '@/src/lib/result'

vi.mock('@/lib/axiom/audit', () => ({ auditMutation: vi.fn() }))
vi.mock('@/src/repositories/membership.repository')
vi.mock('@/src/repositories/sd-access.repository')
vi.mock('@/src/repositories/sd-config.repository')
vi.mock('@/src/repositories/sd-ticket-template.repository')

import { auditMutation } from '@/lib/axiom/audit'
import { SdConfigRepository } from '@/src/repositories/sd-config.repository'
import { SdTicketTemplateRepository } from '@/src/repositories/sd-ticket-template.repository'
import { SdTicketTemplateService } from '../sd-ticket-template.service'

const repo = vi.mocked(SdTicketTemplateRepository)
const refs = vi.mocked(SdConfigRepository.findExistingRefs)
const WS = 'ws1'

function template(overrides: Partial<SdTicketTemplate> = {}): SdTicketTemplate {
  const now = new Date()
  return {
    id: 't1',
    workspaceId: WS,
    ticketType: 'SERVICE_REQUEST',
    name: 'Reset de senha',
    description: null,
    defaults: { title: 'Reset' },
    tasks: [{ title: 'Confirmar' }],
    portalVisible: false,
    active: true,
    position: 0,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

const defaults = {
  categoryId: 'c1',
  subcategoryId: 'c2',
  serviceId: 'c3',
  priorityId: 'p1',
  impactId: 'i1',
  urgencyId: 'ur1',
  severityId: 's1',
  classificationId: 'cl1',
  departmentId: 'd1',
}

const createDto = {
  ticketType: 'SERVICE_REQUEST' as const,
  name: 'Reset',
  defaults,
  tasks: [{ title: 'x' }],
  portalVisible: true,
  active: true,
}

beforeEach(() => {
  actAs('owner')
  refs.mockImplementation(async (_ws, wanted) => ok(wanted))
})

describe('SdTicketTemplateService.list', () => {
  it('returns all templates to agents', async () => {
    actAs('agent')
    repo.list.mockResolvedValue(
      ok([template(), template({ id: 't2', portalVisible: true })]),
    )
    const list = expectOk(
      await SdTicketTemplateService.list('u1', WS, {
        ticketType: 'SERVICE_REQUEST',
        includeInactive: true,
      }),
    )
    expect(list).toHaveLength(2)
    expect(list[0].defaults).toEqual({ title: 'Reset' })
    expect(repo.list).toHaveBeenCalledWith(WS, {
      ticketType: 'SERVICE_REQUEST',
      includeInactive: true,
    })
  })

  it('returns only portal templates to requesters', async () => {
    actAs('requester')
    repo.list.mockResolvedValue(
      ok([template(), template({ id: 't2', portalVisible: true })]),
    )
    const list = expectOk(
      await SdTicketTemplateService.list('u1', WS, { includeInactive: true }),
    )
    expect(list.map((t) => t.id)).toEqual(['t2'])
    expect(repo.list).toHaveBeenCalledWith(WS, {
      ticketType: undefined,
      includeInactive: false,
    })
  })

  it('handles defaults, errors and strangers', async () => {
    repo.list.mockResolvedValue(ok([]))
    expectOk(await SdTicketTemplateService.list('u1', WS))
    repo.list.mockResolvedValue(err(databaseError()))
    expectErr(await SdTicketTemplateService.list('u1', WS), 'DATABASE_ERROR')
    actAs('stranger')
    expectErr(await SdTicketTemplateService.list('u1', WS), 'FORBIDDEN')
  })
})

describe('SdTicketTemplateService.create', () => {
  it.each([
    ['requester', 'FORBIDDEN'],
    ['agent', 'FORBIDDEN'],
    ['viewer', 'FORBIDDEN'],
    ['stranger', 'FORBIDDEN'],
    ['disabled', 'MODULE_DISABLED'],
  ] as const)('denies %s', async (actor, code) => {
    actAs(actor)
    expectErr(await SdTicketTemplateService.create('u1', WS, createDto), code)
  })

  it('validates every referenced id and creates', async () => {
    repo.create.mockResolvedValue(ok(template()))
    expectOk(await SdTicketTemplateService.create('u1', WS, createDto))
    expect(refs).toHaveBeenCalledWith(WS, {
      categoryIds: ['c1', 'c2', 'c3'],
      priorityIds: ['p1'],
      impactIds: ['i1'],
      urgencyIds: ['ur1'],
      severityIds: ['s1'],
      classificationIds: ['cl1'],
      departmentIds: ['d1'],
    })
    expect(auditMutation).toHaveBeenCalledWith(
      expect.objectContaining({ entity: 'sd_ticket_template', targetId: 't1' }),
    )
  })

  it('refuses foreign ids and propagates errors', async () => {
    refs.mockResolvedValue(ok({}))
    expectErr(
      await SdTicketTemplateService.create('u1', WS, createDto),
      'SD_CONFIG_NOT_FOUND',
    )
    refs.mockImplementation(async (_ws, wanted) => ok(wanted))
    repo.create.mockResolvedValue(err(databaseError()))
    expectErr(
      await SdTicketTemplateService.create('u1', WS, createDto),
      'DATABASE_ERROR',
    )
  })
})

describe('SdTicketTemplateService.update/remove/reorder', () => {
  it('updates without defaults (no refs needed)', async () => {
    repo.findById.mockResolvedValue(ok(template()))
    repo.update.mockResolvedValue(ok(template({ name: 'Novo' })))
    const updated = expectOk(
      await SdTicketTemplateService.update('u1', WS, 't1', { name: 'Novo' }),
    )
    expect(updated.name).toBe('Novo')
    expect(refs).not.toHaveBeenCalled()
  })

  it('updates defaults and tasks', async () => {
    repo.findById.mockResolvedValue(ok(template()))
    repo.update.mockResolvedValue(ok(template()))
    expectOk(
      await SdTicketTemplateService.update('u1', WS, 't1', {
        defaults,
        tasks: [],
      }),
    )
    expect(repo.update).toHaveBeenCalledWith(
      't1',
      WS,
      expect.objectContaining({ defaults, tasks: [] }),
    )
  })

  it('propagates update errors', async () => {
    repo.findById.mockResolvedValue(err(databaseError()))
    expectErr(
      await SdTicketTemplateService.update('u1', WS, 't1', { name: 'x' }),
      'DATABASE_ERROR',
    )
    repo.findById.mockResolvedValue(ok(template()))
    refs.mockResolvedValue(ok({}))
    expectErr(
      await SdTicketTemplateService.update('u1', WS, 't1', { defaults }),
      'SD_CONFIG_NOT_FOUND',
    )
    refs.mockImplementation(async (_ws, wanted) => ok(wanted))
    repo.update.mockResolvedValue(err(databaseError()))
    expectErr(
      await SdTicketTemplateService.update('u1', WS, 't1', { name: 'x' }),
      'DATABASE_ERROR',
    )
  })

  it('removes and reorders', async () => {
    repo.findById.mockResolvedValue(ok(template()))
    repo.delete.mockResolvedValue(ok(undefined))
    expectOk(await SdTicketTemplateService.remove('u1', WS, 't1'))
    repo.findById.mockResolvedValue(err(databaseError()))
    expectErr(
      await SdTicketTemplateService.remove('u1', WS, 't1'),
      'DATABASE_ERROR',
    )
    repo.reorder.mockResolvedValue(ok(undefined))
    expectOk(await SdTicketTemplateService.reorder('u1', WS, ['t1']))
    expect(repo.reorder).toHaveBeenCalledWith(WS, ['t1'])
  })

  it('denies non-admins', async () => {
    actAs('agent')
    expectErr(
      await SdTicketTemplateService.update('u1', WS, 't1', { name: 'x' }),
      'FORBIDDEN',
    )
    expectErr(await SdTicketTemplateService.remove('u1', WS, 't1'), 'FORBIDDEN')
    expectErr(
      await SdTicketTemplateService.reorder('u1', WS, ['t1']),
      'FORBIDDEN',
    )
  })
})
