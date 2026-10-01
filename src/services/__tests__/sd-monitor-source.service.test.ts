import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createFakeSdMonitorAlert,
  createFakeSdMonitorSource,
} from '@/src/__tests__/factories/sd-monitor.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { actAs } from '@/src/__tests__/helpers/sd-config.helpers'
import { databaseError, sdMonitorSourceNotFound } from '@/src/errors'
import { err, ok } from '@/src/lib/result'
import { CreateSdMonitorSourceSchema } from '@/src/schemas/sd-monitor-source.schema'

vi.mock('@/lib/axiom/audit', () => ({ auditMutation: vi.fn() }))
vi.mock('@/src/repositories/membership.repository')
vi.mock('@/src/repositories/sd-access.repository')
vi.mock('@/src/repositories/sd-config.repository')
vi.mock('@/src/repositories/sd-customer.repository')
vi.mock('@/src/repositories/sd-monitor-source.repository')
vi.mock('@/src/repositories/sd-monitor-alert.repository')

import { auditMutation } from '@/lib/axiom/audit'
import { SdConfigRepository } from '@/src/repositories/sd-config.repository'
import { SdCustomerRepository } from '@/src/repositories/sd-customer.repository'
import { SdMonitorAlertRepository } from '@/src/repositories/sd-monitor-alert.repository'
import { SdMonitorSourceRepository } from '@/src/repositories/sd-monitor-source.repository'
import {
  hashSdMonitorToken,
  newSdMonitorToken,
  SdMonitorSourceService,
} from '../sd-monitor-source.service'

const sources = vi.mocked(SdMonitorSourceRepository)
const alerts = vi.mocked(SdMonitorAlertRepository)
const customers = vi.mocked(SdCustomerRepository)
const config = vi.mocked(SdConfigRepository)
const WS = 'ws1'

const dto = CreateSdMonitorSourceSchema.parse({ name: 'Zabbix matriz' })

beforeEach(() => {
  actAs('owner')
  config.findExistingRefs.mockResolvedValue(
    ok({
      departmentIds: ['dep-1'],
      categoryIds: ['cat-1'],
      priorityIds: ['p1'],
    } as never),
  )
  customers.findExistingIds.mockResolvedValue(ok(['cus-1']))
  sources.create.mockResolvedValue(ok(createFakeSdMonitorSource()))
  sources.update.mockResolvedValue(ok(createFakeSdMonitorSource()))
  sources.findById.mockResolvedValue(ok(createFakeSdMonitorSource()))
  sources.softDelete.mockResolvedValue(ok(undefined))
})

describe('token helpers', () => {
  it('hashes the token with sha-256 and never repeats it', () => {
    const first = newSdMonitorToken()
    const second = newSdMonitorToken()
    expect(first.token).not.toBe(second.token)
    expect(first.hash).toMatch(/^[0-9a-f]{64}$/)
    expect(first.hash).toBe(hashSdMonitorToken(first.token))
    expect(first.hash).not.toBe(second.hash)
    // base64url: nada de `+`, `/` ou `=` para caber no path da URL.
    expect(first.token).toMatch(/^[A-Za-z0-9_-]{43}$/)
  })
})

describe('SdMonitorSourceService.list', () => {
  it('lists for agents without leaking the token', async () => {
    actAs('agent')
    sources.list.mockResolvedValue(ok([createFakeSdMonitorSource()]))
    const list = expectOk(
      await SdMonitorSourceService.list('u1', WS, { includeInactive: true }),
    )
    expect(list[0]).not.toHaveProperty('tokenHash')
    expect(sources.list).toHaveBeenCalledWith(WS, { includeInactive: true })
    expectOk(await SdMonitorSourceService.list('u1', WS))
    expect(sources.list).toHaveBeenLastCalledWith(WS, {
      includeInactive: false,
    })
  })

  it('refuses requesters and propagates database errors', async () => {
    actAs('requester')
    expectErr(await SdMonitorSourceService.list('u1', WS), 'SD_NOT_AGENT')
    actAs('agent')
    sources.list.mockResolvedValue(err(databaseError()))
    expectErr(await SdMonitorSourceService.list('u1', WS), 'DATABASE_ERROR')
  })
})

describe('SdMonitorSourceService.listAlerts', () => {
  it('lists the recent alerts for agents', async () => {
    actAs('agent')
    alerts.list.mockResolvedValue(ok([createFakeSdMonitorAlert()]))
    const list = expectOk(
      await SdMonitorSourceService.listAlerts('u1', WS, {
        sourceId: 'src-1',
        limit: 5,
      }),
    )
    expect(list[0].subject).toBe('Sem resposta do agente no SRV-01')
    expect(alerts.list).toHaveBeenCalledWith(WS, {
      sourceId: 'src-1',
      limit: 5,
    })
  })

  it('refuses requesters and propagates database errors', async () => {
    actAs('requester')
    expectErr(
      await SdMonitorSourceService.listAlerts('u1', WS, { limit: 20 }),
      'SD_NOT_AGENT',
    )
    actAs('agent')
    alerts.list.mockResolvedValue(err(databaseError()))
    expectErr(
      await SdMonitorSourceService.listAlerts('u1', WS, { limit: 20 }),
      'DATABASE_ERROR',
    )
  })
})

describe('SdMonitorSourceService writes', () => {
  it.each([
    ['requester', 'FORBIDDEN'],
    ['agent', 'FORBIDDEN'],
    ['viewer', 'FORBIDDEN'],
    ['stranger', 'FORBIDDEN'],
    ['disabled', 'MODULE_DISABLED'],
  ] as const)('denies %s', async (actor, code) => {
    actAs(actor)
    expectErr(await SdMonitorSourceService.create('u1', WS, dto), code)
    expectErr(
      await SdMonitorSourceService.update('u1', WS, 'src-1', { active: false }),
      code,
    )
    expectErr(
      await SdMonitorSourceService.regenerateToken('u1', WS, 'src-1'),
      code,
    )
    expectErr(await SdMonitorSourceService.remove('u1', WS, 'src-1'), code)
  })

  it('shows the token once on create and stores only its hash', async () => {
    const created = expectOk(await SdMonitorSourceService.create('u1', WS, dto))
    expect(created.token).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(created.webhookPath).toBe(
      `/api/servicedesk/monitoring/${created.token}`,
    )
    const [, payload] = sources.create.mock.calls[0]
    expect(payload.tokenHash).toBe(hashSdMonitorToken(created.token))
    expect(payload).not.toHaveProperty('token')
    expect(payload.createdById).toBe('u1')
    expect(auditMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        entity: 'sd_monitor_source',
        action: 'create',
      }),
    )
  })

  it('only sends the fields the caller asked for', async () => {
    expectOk(
      await SdMonitorSourceService.create('u1', WS, {
        name: 'Prometheus',
        kind: 'WEBHOOK',
        active: false,
        ticketType: 'PROBLEM',
        departmentId: 'dep-1',
        categoryId: 'cat-1',
        customerId: 'cus-1',
        severityMap: [{ from: 'critical', priorityId: 'p1' }],
        autoResolve: false,
        flappingWindowMinutes: 10,
      }),
    )
    const [, payload] = sources.create.mock.calls[0]
    expect(payload).toMatchObject({
      name: 'Prometheus',
      kind: 'WEBHOOK',
      active: false,
      ticketType: 'PROBLEM',
      departmentId: 'dep-1',
      categoryId: 'cat-1',
      customerId: 'cus-1',
      autoResolve: false,
      flappingWindowMinutes: 10,
    })

    expectOk(
      await SdMonitorSourceService.update('u1', WS, 'src-1', { name: 'Novo' }),
    )
    expect(sources.update).toHaveBeenCalledWith('src-1', WS, { name: 'Novo' })
  })

  it('checks the department, the category and the priorities of the map', async () => {
    config.findExistingRefs.mockResolvedValue(
      ok({ departmentIds: [], categoryIds: [], priorityIds: [] } as never),
    )
    expectErr(
      await SdMonitorSourceService.create('u1', WS, {
        ...dto,
        departmentId: 'dep-outro',
      }),
      'SD_CONFIG_NOT_FOUND',
    )
    expectErr(
      await SdMonitorSourceService.create('u1', WS, {
        ...dto,
        severityMap: [{ from: 'high', priorityId: 'p-outro' }],
      }),
      'SD_CONFIG_NOT_FOUND',
    )
    expect(sources.create).not.toHaveBeenCalled()

    // Também na atualização, antes de escrever.
    expectErr(
      await SdMonitorSourceService.update('u1', WS, 'src-1', {
        categoryId: 'cat-outra',
      }),
      'SD_CONFIG_NOT_FOUND',
    )
    expect(sources.update).not.toHaveBeenCalled()
  })

  it('checks the default customer belongs to the workspace', async () => {
    customers.findExistingIds.mockResolvedValue(ok([]))
    const error = expectErr(
      await SdMonitorSourceService.create('u1', WS, {
        ...dto,
        customerId: 'cus-outro',
      }),
      'SD_CONFIG_NOT_FOUND',
    )
    expect(error.message).toContain('Cliente')

    customers.findExistingIds.mockResolvedValue(err(databaseError()))
    expectErr(
      await SdMonitorSourceService.create('u1', WS, {
        ...dto,
        customerId: 'cus-1',
      }),
      'DATABASE_ERROR',
    )
  })

  it('rotates the token and invalidates the previous one', async () => {
    const rotated = expectOk(
      await SdMonitorSourceService.regenerateToken('u1', WS, 'src-1'),
    )
    expect(sources.update).toHaveBeenCalledWith('src-1', WS, {
      tokenHash: hashSdMonitorToken(rotated.token),
    })
    expect(rotated.webhookPath).toContain(rotated.token)
  })

  it('refuses to touch a source from another workspace', async () => {
    sources.findById.mockResolvedValue(err(sdMonitorSourceNotFound()))
    expectErr(
      await SdMonitorSourceService.update('u1', WS, 'src-x', { active: true }),
      'SD_MONITOR_SOURCE_NOT_FOUND',
    )
    expectErr(
      await SdMonitorSourceService.regenerateToken('u1', WS, 'src-x'),
      'SD_MONITOR_SOURCE_NOT_FOUND',
    )
    expectErr(
      await SdMonitorSourceService.remove('u1', WS, 'src-x'),
      'SD_MONITOR_SOURCE_NOT_FOUND',
    )
    expect(sources.update).not.toHaveBeenCalled()
    expect(sources.softDelete).not.toHaveBeenCalled()
  })

  it('removes the source and audits the failure of the database', async () => {
    expectOk(await SdMonitorSourceService.remove('u1', WS, 'src-1'))
    expect(sources.softDelete).toHaveBeenCalledWith('src-1', WS)

    sources.update.mockResolvedValue(err(databaseError()))
    expectErr(
      await SdMonitorSourceService.update('u1', WS, 'src-1', { active: false }),
      'DATABASE_ERROR',
    )
    expectErr(
      await SdMonitorSourceService.regenerateToken('u1', WS, 'src-1'),
      'DATABASE_ERROR',
    )
    sources.create.mockResolvedValue(err(databaseError()))
    expectErr(
      await SdMonitorSourceService.create('u1', WS, dto),
      'DATABASE_ERROR',
    )
    expect(auditMutation).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: 'failure', reason: 'DATABASE_ERROR' }),
    )
  })
})
