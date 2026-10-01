import { describe, expect, it, vi } from 'vitest'
import { seedMembership } from '@/src/__tests__/factories/membership.factory'
import {
  seedSdNotificationPreference,
  seedSdTicketFollower,
} from '@/src/__tests__/factories/sd-notification.factory'
import { seedSdTicket } from '@/src/__tests__/factories/sd-ticket.factory'
import {
  seedSdDepartment,
  seedSdDepartmentMember,
  seedSdPhase,
} from '@/src/__tests__/factories/sd-ticket-context.factory'
import { seedUser } from '@/src/__tests__/factories/user.factory'
import { seedWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { prisma } from '@/src/lib/prisma'
import { SdNotificationRepository } from '../sd-notification.repository'

const RISK = new Date('2026-10-01T14:00:00.000Z')

async function setup() {
  const [workspace, user, other] = await Promise.all([
    seedWorkspace(),
    seedUser(),
    seedUser(),
  ])
  await Promise.all([
    seedMembership({ workspaceId: workspace.id, userId: user.id }),
    seedMembership({ workspaceId: workspace.id, userId: other.id }),
  ])
  const phase = await seedSdPhase(workspace.id)
  const ticket = await seedSdTicket(workspace.id, phase.id)
  return { workspace, user, other, phase, ticket }
}

describe('SdNotificationRepository — preferências', () => {
  it('lista, grava e apaga a matriz do usuário', async () => {
    const { workspace, user, other } = await setup()

    expect(
      expectOk(
        await SdNotificationRepository.listPreferences(workspace.id, user.id),
      ),
    ).toEqual([])

    expect(
      expectOk(
        await SdNotificationRepository.upsertPreferences(
          workspace.id,
          user.id,
          [
            { event: 'ticket.message', channel: 'EMAIL', enabled: false },
            { event: 'ticket.message', channel: 'WHATSAPP', enabled: true },
            { event: 'sla.breached', channel: 'IN_APP', enabled: false },
          ],
        ),
      ),
    ).toBe(3)
    // Não mexe em quem não é o dono.
    await seedSdNotificationPreference(workspace.id, other.id, {
      event: 'ticket.message',
      channel: 'EMAIL',
    })

    const rows = expectOk(
      await SdNotificationRepository.listPreferences(workspace.id, user.id),
    )
    expect(rows.map((r) => [r.event, r.channel, r.enabled])).toEqual([
      ['sla.breached', 'IN_APP', false],
      ['ticket.message', 'EMAIL', false],
      ['ticket.message', 'WHATSAPP', true],
    ])

    // Upsert do mesmo par evento × canal atualiza em vez de duplicar.
    expectOk(
      await SdNotificationRepository.upsertPreferences(workspace.id, user.id, [
        { event: 'ticket.message', channel: 'EMAIL', enabled: true },
      ]),
    )
    const updated = expectOk(
      await SdNotificationRepository.listPreferences(workspace.id, user.id),
    )
    expect(updated).toHaveLength(3)
    expect(
      updated.find((r) => r.channel === 'EMAIL' && r.event === 'ticket.message')
        ?.enabled,
    ).toBe(true)

    expect(
      expectOk(
        await SdNotificationRepository.upsertPreferences(
          workspace.id,
          user.id,
          [],
        ),
      ),
    ).toBe(0)

    expect(
      expectOk(
        await SdNotificationRepository.deletePreferences(workspace.id, user.id),
      ),
    ).toBe(3)
    expect(
      expectOk(
        await SdNotificationRepository.listPreferences(workspace.id, user.id),
      ),
    ).toEqual([])
    // A linha do outro usuário sobreviveu.
    expect(
      expectOk(
        await SdNotificationRepository.listPreferences(workspace.id, other.id),
      ),
    ).toHaveLength(1)
  })

  it('lê as preferências de vários usuários para um evento', async () => {
    const { workspace, user, other } = await setup()
    await seedSdNotificationPreference(workspace.id, user.id, {
      event: 'ticket.message',
      channel: 'EMAIL',
      enabled: false,
    })
    await seedSdNotificationPreference(workspace.id, user.id, {
      event: 'sla.breached',
      channel: 'EMAIL',
      enabled: false,
    })
    await seedSdNotificationPreference(workspace.id, other.id, {
      event: 'ticket.message',
      channel: 'IN_APP',
      enabled: false,
    })

    const rows = expectOk(
      await SdNotificationRepository.listPreferencesForEvent(
        workspace.id,
        [user.id, other.id, user.id],
        'ticket.message',
      ),
    )
    expect(rows).toHaveLength(2)
    expect(rows.every((r) => r.event === 'ticket.message')).toBe(true)

    expect(
      expectOk(
        await SdNotificationRepository.listPreferencesForEvent(
          workspace.id,
          [],
          'ticket.message',
        ),
      ),
    ).toEqual([])
  })

  it('lista quem ligou o resumo diário num canal', async () => {
    const { workspace, user, other } = await setup()
    await seedSdNotificationPreference(workspace.id, user.id, {
      event: 'digest.daily',
      channel: 'EMAIL',
      enabled: true,
    })
    await seedSdNotificationPreference(workspace.id, other.id, {
      event: 'digest.daily',
      channel: 'EMAIL',
      enabled: false,
    })
    await seedSdNotificationPreference(workspace.id, other.id, {
      event: 'digest.daily',
      channel: 'IN_APP',
      enabled: true,
    })

    expect(
      expectOk(
        await SdNotificationRepository.listDigestUserIds(
          workspace.id,
          'digest.daily',
          'EMAIL',
        ),
      ),
    ).toEqual([user.id])
    expect(
      expectOk(
        await SdNotificationRepository.listDigestUserIds(
          workspace.id,
          'digest.daily',
          'IN_APP',
        ),
      ),
    ).toEqual([other.id])
  })
})

describe('SdNotificationRepository — seguidores', () => {
  it('segue, lista e deixa de seguir (idempotente)', async () => {
    const { workspace, user, other, ticket, phase } = await setup()
    const another = await seedSdTicket(workspace.id, phase.id)

    expect(
      expectOk(await SdNotificationRepository.listFollowers(ticket.id)),
    ).toEqual([])

    expect(
      expectOk(await SdNotificationRepository.addFollower(ticket.id, user.id)),
    ).toBe(true)
    expect(
      expectOk(await SdNotificationRepository.addFollower(ticket.id, user.id)),
    ).toBe(false)
    expectOk(await SdNotificationRepository.addFollower(ticket.id, other.id))
    await seedSdTicketFollower(another.id, other.id)

    const rows = expectOk(
      await SdNotificationRepository.listFollowers(ticket.id),
    )
    expect(rows.map((r) => r.userId)).toEqual([user.id, other.id])
    expect(rows[0]?.user.email).toBe(
      (await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).email,
    )
    expect(
      expectOk(await SdNotificationRepository.listFollowerIds(ticket.id)),
    ).toEqual([user.id, other.id])

    expect(
      expectOk(
        await SdNotificationRepository.removeFollower(ticket.id, user.id),
      ),
    ).toBe(true)
    expect(
      expectOk(
        await SdNotificationRepository.removeFollower(ticket.id, user.id),
      ),
    ).toBe(false)
    expect(
      expectOk(await SdNotificationRepository.listFollowerIds(ticket.id)),
    ).toEqual([other.id])
    // O outro chamado não foi afetado.
    expect(
      expectOk(await SdNotificationRepository.listFollowerIds(another.id)),
    ).toEqual([other.id])
  })
})

describe('SdNotificationRepository — entrega', () => {
  it('filtra quem é agente (departamento ativo e não excluído)', async () => {
    const { workspace, user, other } = await setup()
    const outsider = await seedUser()
    const active = await seedSdDepartment(workspace.id, { name: 'Suporte' })
    const inactive = await seedSdDepartment(workspace.id, {
      name: 'Antigo',
      active: false,
    })
    await seedSdDepartmentMember(active.id, user.id)
    await seedSdDepartmentMember(inactive.id, other.id)

    expect(
      expectOk(
        await SdNotificationRepository.filterAgentIds(workspace.id, [
          user.id,
          other.id,
          outsider.id,
          user.id,
        ]),
      ),
    ).toEqual([user.id])
    expect(
      expectOk(await SdNotificationRepository.filterAgentIds(workspace.id, [])),
    ).toEqual([])
  })

  it('lê nome e e-mail só de quem é membro do workspace', async () => {
    const { workspace, user } = await setup()
    const stranger = await seedUser()

    const rows = expectOk(
      await SdNotificationRepository.findRecipients(workspace.id, [
        user.id,
        stranger.id,
        user.id,
      ]),
    )
    expect(rows.map((r) => r.id)).toEqual([user.id])
    expect(rows[0]?.name.length).toBeGreaterThan(0)
    expect(
      expectOk(await SdNotificationRepository.findRecipients(workspace.id, [])),
    ).toEqual([])
  })

  it('acha o WhatsApp dos destinatários no cadastro de contatos', async () => {
    const { workspace, user, other } = await setup()
    await prisma.sdContact.create({
      data: {
        workspaceId: workspace.id,
        name: 'Ana (contato)',
        userId: user.id,
        whatsapp: '11999998888',
        createdById: user.id,
      },
    })
    // Sem número, excluído e sem usuário: nenhum entra.
    await prisma.sdContact.create({
      data: {
        workspaceId: workspace.id,
        name: 'Sem número',
        userId: other.id,
        createdById: user.id,
      },
    })
    await prisma.sdContact.create({
      data: {
        workspaceId: workspace.id,
        name: 'Excluído',
        userId: other.id,
        whatsapp: '11777776666',
        deletedAt: new Date(),
        createdById: user.id,
      },
    })

    const map = expectOk(
      await SdNotificationRepository.findWhatsappNumbers(workspace.id, [
        user.id,
        other.id,
      ]),
    )
    expect(map.get(user.id)).toBe('11999998888')
    expect(map.has(other.id)).toBe(false)
    expect(
      expectOk(
        await SdNotificationRepository.findWhatsappNumbers(workspace.id, []),
      ).size,
    ).toBe(0)
  })

  it('lê os canais de um contato externo', async () => {
    const { workspace, user } = await setup()
    const contact = await prisma.sdContact.create({
      data: {
        workspaceId: workspace.id,
        name: 'Cliente',
        email: 'cliente@example.com',
        whatsapp: '11999997777',
        createdById: user.id,
      },
    })
    expect(
      expectOk(
        await SdNotificationRepository.findContactChannels(
          workspace.id,
          contact.id,
        ),
      ),
    ).toEqual({ email: 'cliente@example.com', whatsapp: '11999997777' })

    const gone = await prisma.sdContact.create({
      data: {
        workspaceId: workspace.id,
        name: 'Inativo',
        active: false,
        createdById: user.id,
      },
    })
    expect(
      expectOk(
        await SdNotificationRepository.findContactChannels(
          workspace.id,
          gone.id,
        ),
      ),
    ).toBeNull()
  })
})

describe('SdNotificationRepository.digestCounts', () => {
  it('conta a fila do agente, o que está apertado e o que aguarda resposta', async () => {
    const { workspace, user, other } = await setup()
    const open = await seedSdPhase(workspace.id, {
      name: 'Em atendimento',
      category: 'IN_PROGRESS',
      position: 1,
    })
    const waiting = await seedSdPhase(workspace.id, {
      name: 'Aguardando',
      category: 'WAITING',
      position: 2,
    })
    const closed = await seedSdPhase(workspace.id, {
      name: 'Resolvido',
      category: 'RESOLVED',
      position: 3,
    })

    // Na fila e com prazo apertado.
    await seedSdTicket(workspace.id, open.id, {
      assigneeId: user.id,
      title: 'Prazo apertado',
      resolutionDueAt: new Date('2026-10-01T13:00:00.000Z'),
    })
    // Na fila, 1ª resposta vencida e ainda sem resposta.
    await seedSdTicket(workspace.id, open.id, {
      assigneeId: user.id,
      title: 'Sem 1a resposta',
      firstResponseDueAt: new Date('2026-10-01T12:00:00.000Z'),
    })
    // Na fila e violado.
    await seedSdTicket(workspace.id, open.id, {
      assigneeId: user.id,
      title: 'Violado',
      resolutionBreached: true,
    })
    // Na fila, aguardando resposta e com prazo folgado.
    await seedSdTicket(workspace.id, waiting.id, {
      assigneeId: user.id,
      title: 'Aguardando',
      resolutionDueAt: new Date('2026-10-05T12:00:00.000Z'),
    })
    // Fora da conta: resolvido, de outro agente e excluído.
    await seedSdTicket(workspace.id, closed.id, { assigneeId: user.id })
    await seedSdTicket(workspace.id, open.id, { assigneeId: other.id })
    await seedSdTicket(workspace.id, open.id, {
      assigneeId: user.id,
      deletedAt: new Date(),
    })

    const counts = expectOk(
      await SdNotificationRepository.digestCounts(workspace.id, user.id, RISK),
    )
    expect(counts.queue).toBe(4)
    expect(counts.atRisk).toBe(3)
    expect(counts.waiting).toBe(1)
    expect(counts.highlights).toHaveLength(4)
    // Prazo mais apertado primeiro; sem prazo vai para o fim.
    expect(counts.highlights[0]?.title).toBe('Prazo apertado')
    expect(counts.highlights.at(-1)?.resolutionDueAt).toBeNull()
  })

  it('devolve zeros para quem não tem chamado', async () => {
    const { workspace, other } = await setup()
    expect(
      expectOk(
        await SdNotificationRepository.digestCounts(
          workspace.id,
          other.id,
          RISK,
        ),
      ),
    ).toEqual({ queue: 0, atRisk: 0, waiting: 0, highlights: [] })
  })

  it('limita os destaques a cinco chamados', async () => {
    const { workspace, user } = await setup()
    const open = await seedSdPhase(workspace.id, {
      name: 'Em atendimento',
      category: 'IN_PROGRESS',
      position: 1,
    })
    for (let i = 0; i < 7; i++) {
      await seedSdTicket(workspace.id, open.id, { assigneeId: user.id })
    }
    const counts = expectOk(
      await SdNotificationRepository.digestCounts(workspace.id, user.id, RISK),
    )
    expect(counts.queue).toBe(7)
    expect(counts.highlights).toHaveLength(5)
  })
})

describe('SdNotificationRepository — falhas viram DATABASE_ERROR', () => {
  it('mapeia cada consulta que explode', async () => {
    const boom = new Error('boom')
    const spies = [
      vi.spyOn(prisma.sdNotificationPreference, 'findMany'),
      vi.spyOn(prisma, '$transaction'),
      vi.spyOn(prisma.sdNotificationPreference, 'deleteMany'),
      vi.spyOn(prisma.sdTicketFollower, 'findMany'),
      vi.spyOn(prisma.sdTicketFollower, 'createMany'),
      vi.spyOn(prisma.sdTicketFollower, 'deleteMany'),
      vi.spyOn(prisma.sdDepartmentMember, 'findMany'),
      vi.spyOn(prisma.membership, 'findMany'),
      vi.spyOn(prisma.sdContact, 'findMany'),
      vi.spyOn(prisma.sdContact, 'findFirst'),
      vi.spyOn(prisma.sdTicket, 'count'),
    ]
    for (const spy of spies) spy.mockRejectedValue(boom)

    expectErr(
      await SdNotificationRepository.listPreferences('ws', 'u'),
      'DATABASE_ERROR',
    )
    expectErr(
      await SdNotificationRepository.listPreferencesForEvent(
        'ws',
        ['u'],
        'ticket.message',
      ),
      'DATABASE_ERROR',
    )
    expectErr(
      await SdNotificationRepository.upsertPreferences('ws', 'u', [
        { event: 'ticket.message', channel: 'EMAIL', enabled: false },
      ]),
      'DATABASE_ERROR',
    )
    expectErr(
      await SdNotificationRepository.deletePreferences('ws', 'u'),
      'DATABASE_ERROR',
    )
    expectErr(
      await SdNotificationRepository.listDigestUserIds(
        'ws',
        'digest.daily',
        'EMAIL',
      ),
      'DATABASE_ERROR',
    )
    expectErr(
      await SdNotificationRepository.listFollowers('t'),
      'DATABASE_ERROR',
    )
    expectErr(
      await SdNotificationRepository.listFollowerIds('t'),
      'DATABASE_ERROR',
    )
    expectErr(
      await SdNotificationRepository.addFollower('t', 'u'),
      'DATABASE_ERROR',
    )
    expectErr(
      await SdNotificationRepository.removeFollower('t', 'u'),
      'DATABASE_ERROR',
    )
    expectErr(
      await SdNotificationRepository.filterAgentIds('ws', ['u']),
      'DATABASE_ERROR',
    )
    expectErr(
      await SdNotificationRepository.findRecipients('ws', ['u']),
      'DATABASE_ERROR',
    )
    expectErr(
      await SdNotificationRepository.findWhatsappNumbers('ws', ['u']),
      'DATABASE_ERROR',
    )
    expectErr(
      await SdNotificationRepository.findContactChannels('ws', 'c'),
      'DATABASE_ERROR',
    )
    expectErr(
      await SdNotificationRepository.digestCounts('ws', 'u', RISK),
      'DATABASE_ERROR',
    )

    for (const spy of spies) spy.mockRestore()
  })
})

describe('SdNotificationRepository.digestCounts — limite', () => {
  it('não quebra com muitos chamados', async () => {
    const { workspace, user } = await setup()
    const open = await seedSdPhase(workspace.id, {
      name: 'Em atendimento',
      category: 'IN_PROGRESS',
      position: 1,
    })
    for (let i = 0; i < 7; i++) {
      await seedSdTicket(workspace.id, open.id, { assigneeId: user.id })
    }
    const counts = expectOk(
      await SdNotificationRepository.digestCounts(workspace.id, user.id, RISK),
    )
    expect(counts.queue).toBe(7)
    expect(counts.highlights).toHaveLength(5)
  })
})
