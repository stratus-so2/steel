import { describe, expect, it } from 'vitest'
import { seedSdConfigItem } from '@/src/__tests__/factories/sd-config-item.factory'
import {
  seedSdMonitorAlert,
  seedSdMonitorSource,
} from '@/src/__tests__/factories/sd-monitor.factory'
import { seedSdTicket } from '@/src/__tests__/factories/sd-ticket.factory'
import { seedSdPhaseFlow } from '@/src/__tests__/factories/sd-ticket-context.factory'
import { seedUser } from '@/src/__tests__/factories/user.factory'
import { seedWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { prisma } from '@/src/lib/prisma'
import { hashSdMonitorToken } from '@/src/services/sd-monitor-source.service'
import { SdMonitorAlertRepository } from '../sd-monitor-alert.repository'
import { SdMonitorSourceRepository } from '../sd-monitor-source.repository'

async function setup() {
  const [workspace, other, user] = await Promise.all([
    seedWorkspace(),
    seedWorkspace(),
    seedUser(),
  ])
  return { workspace, other, user }
}

describe('SdMonitorSourceRepository', () => {
  it('creates, lists, finds, updates and soft deletes within the workspace', async () => {
    const { workspace, other, user } = await setup()
    const created = expectOk(
      await SdMonitorSourceRepository.create(workspace.id, {
        name: 'Zabbix matriz',
        tokenHash: hashSdMonitorToken('tok-a'),
        createdById: user.id,
        severityMap: [{ from: 'Disaster', priorityId: 'p1' }],
        flappingWindowMinutes: 15,
      }),
    )
    expect(created.kind).toBe('ZABBIX')
    expect(created.autoResolve).toBe(true)
    expect(created.flappingWindowMinutes).toBe(15)

    await seedSdMonitorSource(workspace.id, user.id, {
      name: 'Webhook inativo',
      kind: 'WEBHOOK',
      active: false,
    })
    await seedSdMonitorSource(workspace.id, user.id, {
      name: 'Excluída',
      deletedAt: new Date(),
    })
    await seedSdMonitorSource(other.id, user.id, { name: 'De outra' })

    const active = expectOk(await SdMonitorSourceRepository.list(workspace.id))
    expect(active.map((s) => s.name)).toEqual(['Zabbix matriz'])
    const all = expectOk(
      await SdMonitorSourceRepository.list(workspace.id, {
        includeInactive: true,
      }),
    )
    expect(all.map((s) => s.name)).toEqual(['Webhook inativo', 'Zabbix matriz'])

    expectOk(await SdMonitorSourceRepository.findById(created.id, workspace.id))
    expectErr(
      await SdMonitorSourceRepository.findById(created.id, other.id),
      'SD_MONITOR_SOURCE_NOT_FOUND',
    )

    const updated = expectOk(
      await SdMonitorSourceRepository.update(created.id, workspace.id, {
        name: 'Zabbix DC',
        autoResolve: false,
        departmentId: null,
      }),
    )
    expect(updated.name).toBe('Zabbix DC')
    expect(updated.autoResolve).toBe(false)

    expectOk(
      await SdMonitorSourceRepository.softDelete(created.id, workspace.id),
    )
    const row = await prisma.sdMonitorSource.findUnique({
      where: { id: created.id },
    })
    expect(row?.deletedAt).toBeInstanceOf(Date)
    expect(row?.active).toBe(false)
    expectErr(
      await SdMonitorSourceRepository.findById(created.id, workspace.id),
      'SD_MONITOR_SOURCE_NOT_FOUND',
    )
  })

  it('refuses a duplicated token hash and a missing update target', async () => {
    const { workspace, user } = await setup()
    await SdMonitorSourceRepository.create(workspace.id, {
      name: 'A',
      tokenHash: hashSdMonitorToken('mesmo'),
      createdById: user.id,
    })
    expectErr(
      await SdMonitorSourceRepository.create(workspace.id, {
        name: 'B',
        tokenHash: hashSdMonitorToken('mesmo'),
        createdById: user.id,
      }),
      'SD_CONFIG_CONFLICT',
    )
    expectErr(
      await SdMonitorSourceRepository.update('nao-existe', workspace.id, {
        name: 'x',
      }),
      'SD_CONFIG_NOT_FOUND',
    )
    expectErr(
      await SdMonitorSourceRepository.softDelete('nao-existe', workspace.id),
      'SD_CONFIG_NOT_FOUND',
    )
  })

  it('finds only an active, undeleted source by its token hash', async () => {
    const { workspace, user } = await setup()
    const live = await seedSdMonitorSource(workspace.id, user.id, {
      tokenHash: hashSdMonitorToken('viva'),
    })
    await seedSdMonitorSource(workspace.id, user.id, {
      name: 'Inativa',
      tokenHash: hashSdMonitorToken('inativa'),
      active: false,
    })
    await seedSdMonitorSource(workspace.id, user.id, {
      name: 'Excluída',
      tokenHash: hashSdMonitorToken('excluida'),
      deletedAt: new Date(),
    })

    const found = expectOk(
      await SdMonitorSourceRepository.findByTokenHash(
        hashSdMonitorToken('viva'),
      ),
    )
    expect(found?.id).toBe(live.id)
    expect(
      expectOk(
        await SdMonitorSourceRepository.findByTokenHash(
          hashSdMonitorToken('inativa'),
        ),
      ),
    ).toBeNull()
    expect(
      expectOk(
        await SdMonitorSourceRepository.findByTokenHash(
          hashSdMonitorToken('excluida'),
        ),
      ),
    ).toBeNull()
    expect(
      expectOk(await SdMonitorSourceRepository.findByTokenHash('desconhecido')),
    ).toBeNull()
  })

  it('stamps the last event and fails loudly for a missing source', async () => {
    const { workspace, user } = await setup()
    const source = await seedSdMonitorSource(workspace.id, user.id)
    const at = new Date('2026-10-01T15:00:00.000Z')
    expectOk(await SdMonitorSourceRepository.touchLastEvent(source.id, at))
    const row = await prisma.sdMonitorSource.findUnique({
      where: { id: source.id },
    })
    expect(row?.lastEventAt?.toISOString()).toBe(at.toISOString())
    expectErr(
      await SdMonitorSourceRepository.touchLastEvent('nao-existe', at),
      'SD_CONFIG_NOT_FOUND',
    )
  })
})

describe('SdMonitorAlertRepository', () => {
  it('creates, deduplicates by external id and updates with relations', async () => {
    const { workspace, user } = await setup()
    const source = await seedSdMonitorSource(workspace.id, user.id)
    const flow = await seedSdPhaseFlow(workspace.id, 'INCIDENT')
    const ticket = await seedSdTicket(workspace.id, flow.initial.id)
    const ci = await seedSdConfigItem(workspace.id, user.id, { name: 'SRV-01' })

    const created = expectOk(
      await SdMonitorAlertRepository.create({
        workspaceId: workspace.id,
        sourceId: source.id,
        externalId: '31415',
        subject: 'Sem resposta do agente',
        severity: 'Disaster',
        host: 'SRV-01',
        configItemId: ci.id,
        ticketId: ticket.id,
        payload: { eventId: '31415' },
      }),
    )
    expect(created.status).toBe('OPEN')
    expect(created.source.name).toBe('Zabbix matriz')
    expect(created.configItem?.name).toBe('SRV-01')
    expect(created.ticket?.number).toBe(ticket.number)
    expect(created.ticket?.phase.name).toBe('Novo')

    // `(sourceId, externalId)` é único: o mesmo evento não entra duas vezes.
    expectErr(
      await SdMonitorAlertRepository.create({
        workspaceId: workspace.id,
        sourceId: source.id,
        externalId: '31415',
        subject: 'Repetido',
      }),
      'SD_CONFIG_CONFLICT',
    )

    const found = expectOk(
      await SdMonitorAlertRepository.findByExternalId(source.id, '31415'),
    )
    expect(found?.id).toBe(created.id)
    expect(
      expectOk(
        await SdMonitorAlertRepository.findByExternalId(source.id, 'outro'),
      ),
    ).toBeNull()

    const resolvedAt = new Date('2026-10-01T16:00:00.000Z')
    const updated = expectOk(
      await SdMonitorAlertRepository.update(created.id, {
        status: 'RESOLVED',
        resolvedAt,
        severity: 'High',
      }),
    )
    expect(updated.status).toBe('RESOLVED')
    expect(updated.resolvedAt?.toISOString()).toBe(resolvedAt.toISOString())
    expectErr(
      await SdMonitorAlertRepository.update('nao-existe', { status: 'OPEN' }),
      'SD_CONFIG_NOT_FOUND',
    )
  })

  it('lists newest first and filters by source, ticket, status and limit', async () => {
    const { workspace, other, user } = await setup()
    const source = await seedSdMonitorSource(workspace.id, user.id)
    const second = await seedSdMonitorSource(workspace.id, user.id, {
      name: 'Webhook',
      kind: 'WEBHOOK',
    })
    const flow = await seedSdPhaseFlow(workspace.id, 'INCIDENT')
    const ticket = await seedSdTicket(workspace.id, flow.initial.id)

    await seedSdMonitorAlert(workspace.id, source.id, {
      externalId: 'a',
      subject: 'Primeiro',
      ticketId: ticket.id,
    })
    await seedSdMonitorAlert(workspace.id, source.id, {
      externalId: 'b',
      subject: 'Segundo',
      status: 'RESOLVED',
    })
    await seedSdMonitorAlert(workspace.id, second.id, {
      externalId: 'c',
      subject: 'Terceiro',
    })
    const otherSource = await seedSdMonitorSource(other.id, user.id)
    await seedSdMonitorAlert(other.id, otherSource.id, { subject: 'De outra' })

    const all = expectOk(await SdMonitorAlertRepository.list(workspace.id))
    expect(all).toHaveLength(3)
    expect(all[0].subject).toBe('Terceiro')

    expect(
      expectOk(
        await SdMonitorAlertRepository.list(workspace.id, {
          sourceId: source.id,
        }),
      ).map((a) => a.subject),
    ).toEqual(['Segundo', 'Primeiro'])
    expect(
      expectOk(
        await SdMonitorAlertRepository.list(workspace.id, {
          ticketId: ticket.id,
        }),
      ).map((a) => a.subject),
    ).toEqual(['Primeiro'])
    expect(
      expectOk(
        await SdMonitorAlertRepository.list(workspace.id, {
          status: 'RESOLVED',
        }),
      ).map((a) => a.subject),
    ).toEqual(['Segundo'])
    expect(
      expectOk(await SdMonitorAlertRepository.list(workspace.id, { limit: 1 })),
    ).toHaveLength(1)
  })

  it('matches the config item by name, code or ip, ignoring case and deleted ones', async () => {
    const { workspace, other, user } = await setup()
    await seedSdConfigItem(workspace.id, user.id, {
      name: 'SRV-01',
      code: 'PAT-900',
      ipAddress: '10.0.0.4',
    })
    await seedSdConfigItem(workspace.id, user.id, {
      name: 'SRV-DEL',
      deletedAt: new Date(),
    })
    await seedSdConfigItem(other.id, user.id, { name: 'SRV-OUTRA' })

    const byName = expectOk(
      await SdMonitorAlertRepository.findConfigItemByHost(
        workspace.id,
        'srv-01',
      ),
    )
    expect(byName?.name).toBe('SRV-01')
    expect(
      expectOk(
        await SdMonitorAlertRepository.findConfigItemByHost(
          workspace.id,
          'pat-900',
        ),
      )?.name,
    ).toBe('SRV-01')
    expect(
      expectOk(
        await SdMonitorAlertRepository.findConfigItemByHost(
          workspace.id,
          '10.0.0.4',
        ),
      )?.name,
    ).toBe('SRV-01')
    expect(
      expectOk(
        await SdMonitorAlertRepository.findConfigItemByHost(
          workspace.id,
          'SRV-DEL',
        ),
      ),
    ).toBeNull()
    expect(
      expectOk(
        await SdMonitorAlertRepository.findConfigItemByHost(
          workspace.id,
          'SRV-OUTRA',
        ),
      ),
    ).toBeNull()
  })

  it('picks the initial phase first and then by position', async () => {
    const { workspace } = await setup()
    const flow = await seedSdPhaseFlow(workspace.id, 'INCIDENT')
    expect(
      expectOk(
        await SdMonitorAlertRepository.findPhaseIdByCategory(
          workspace.id,
          'INCIDENT',
          'RESOLVED',
        ),
      ),
    ).toBe(flow.resolved.id)
    expect(
      expectOk(
        await SdMonitorAlertRepository.findPhaseIdByCategory(
          workspace.id,
          'INCIDENT',
          'NEW',
        ),
      ),
    ).toBe(flow.initial.id)
    expect(
      expectOk(
        await SdMonitorAlertRepository.findPhaseIdByCategory(
          workspace.id,
          'PROBLEM',
          'RESOLVED',
        ),
      ),
    ).toBeNull()

    await prisma.sdPhase.update({
      where: { id: flow.resolved.id },
      data: { active: false },
    })
    expect(
      expectOk(
        await SdMonitorAlertRepository.findPhaseIdByCategory(
          workspace.id,
          'INCIDENT',
          'RESOLVED',
        ),
      ),
    ).toBeNull()
  })
})
