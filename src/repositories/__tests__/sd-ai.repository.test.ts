import { describe, expect, it } from 'vitest'
import { seedSdTicket } from '@/src/__tests__/factories/sd-ticket.factory'
import {
  seedSdCategory,
  seedSdDepartment,
  seedSdImpact,
  seedSdPhase,
  seedSdPriority,
  seedSdUrgency,
} from '@/src/__tests__/factories/sd-ticket-context.factory'
import { seedSdTicketMessage } from '@/src/__tests__/factories/sd-ticket-tabs.factory'
import { seedUser } from '@/src/__tests__/factories/user.factory'
import { seedWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { expectOk } from '@/src/__tests__/helpers/result.helpers'
import { prisma } from '@/src/lib/prisma'
import { SdAiRepository } from '../sd-ai.repository'

/** Conversas da IA, catálogo enviado ao modelo e os campos de IA do chamado. */

async function setup() {
  const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
  const phase = await seedSdPhase(workspace.id)
  const ticket = await seedSdTicket(workspace.id, phase.id)
  return { workspace, user, phase, ticket }
}

const at = (minutes: number) => new Date(Date.UTC(2026, 8, 21, 12, minutes, 0))

describe('SdAiRepository — conversations', () => {
  it('creates, finds, updates and deletes a copilot conversation', async () => {
    const { workspace, user, ticket } = await setup()

    const created = expectOk(
      await SdAiRepository.createConversation({
        workspaceId: workspace.id,
        mode: 'COPILOT',
        userId: user.id,
        ticketId: ticket.id,
      }),
    )
    expect(created.messages).toEqual([])
    expect(created.outcome).toBeNull()

    expect(
      expectOk(
        await SdAiRepository.findCopilotConversation(
          workspace.id,
          ticket.id,
          user.id,
        ),
      )?.id,
    ).toBe(created.id)

    const other = await seedUser()
    expect(
      expectOk(
        await SdAiRepository.findCopilotConversation(
          workspace.id,
          ticket.id,
          other.id,
        ),
      ),
    ).toBeNull()

    const updated = expectOk(
      await SdAiRepository.updateConversation(created.id, {
        messages: [{ role: 'user', content: 'oi', at: at(1).toISOString() }],
      }),
    )
    expect(updated.messages).toHaveLength(1)

    expect(
      expectOk(await SdAiRepository.findConversation(created.id, workspace.id))
        ?.id,
    ).toBe(created.id)
    const stranger = await seedWorkspace()
    expect(
      expectOk(await SdAiRepository.findConversation(created.id, stranger.id)),
    ).toBeNull()

    expectOk(await SdAiRepository.deleteConversation(created.id))
    expect(
      expectOk(await SdAiRepository.findConversation(created.id, workspace.id)),
    ).toBeNull()
  })

  it('finds only the open pre-service of a whatsapp conversation', async () => {
    const { workspace, user } = await setup()
    const connection = await prisma.whatsAppConnection.create({
      data: {
        workspaceId: workspace.id,
        module: 'SERVICE_DESK',
        provider: 'ZAPI',
        label: 'ServiceDesk',
        phoneNumber: '5511988887777',
        createdById: user.id,
      },
    })
    const contact = await prisma.whatsAppContact.create({
      data: { workspaceId: workspace.id, waId: '5511977776666' },
    })
    const conversation = await prisma.whatsAppConversation.create({
      data: {
        workspaceId: workspace.id,
        connectionId: connection.id,
        contactId: contact.id,
      },
    })

    const closed = expectOk(
      await SdAiRepository.createConversation({
        workspaceId: workspace.id,
        mode: 'PRE_SERVICE',
        whatsappConversationId: conversation.id,
      }),
    )
    expectOk(
      await SdAiRepository.updateConversation(closed.id, {
        outcome: 'abandoned',
      }),
    )
    expect(
      expectOk(
        await SdAiRepository.findActiveWhatsappConversation(conversation.id),
      ),
    ).toBeNull()

    const open = expectOk(
      await SdAiRepository.createConversation({
        workspaceId: workspace.id,
        mode: 'PRE_SERVICE',
        whatsappConversationId: conversation.id,
      }),
    )
    expect(
      expectOk(
        await SdAiRepository.findActiveWhatsappConversation(conversation.id),
      )?.id,
    ).toBe(open.id)
  })

  it('fails with a database error when the conversation does not exist', async () => {
    expect(
      (
        await SdAiRepository.updateConversation('nope', {
          outcome: 'abandoned',
        })
      ).ok,
    ).toBe(false)
    expect((await SdAiRepository.deleteConversation('nope')).ok).toBe(false)
  })
})

describe('SdAiRepository.loadCatalog', () => {
  it('loads the active catalog ordered by level and position', async () => {
    const { workspace } = await setup()
    const category = await seedSdCategory(workspace.id, {
      name: 'Rede',
      level: 'CATEGORY',
    })
    await seedSdCategory(workspace.id, {
      name: 'VPN',
      level: 'SUBCATEGORY',
      parentId: category.id,
    })
    await seedSdCategory(workspace.id, { name: 'Inativa', active: false })
    await seedSdImpact(workspace.id, 1)
    await seedSdUrgency(workspace.id, 1)
    await seedSdPriority(workspace.id, { name: 'P1', level: 1 })
    await seedSdDepartment(workspace.id, { name: 'Infra' })

    const catalog = expectOk(await SdAiRepository.loadCatalog(workspace.id))
    expect(catalog.categories.map((row) => row.name)).toEqual(['Rede', 'VPN'])
    expect(catalog.impacts).toHaveLength(1)
    expect(catalog.urgencies).toHaveLength(1)
    expect(catalog.priorities.map((row) => row.name)).toEqual(['P1'])
    expect(catalog.departments.map((row) => row.name)).toEqual(['Infra'])
  })

  it('narrows the catalog by ticket type and by portal visibility', async () => {
    const { workspace } = await setup()
    await seedSdCategory(workspace.id, { name: 'Todos os tipos' })
    await seedSdCategory(workspace.id, {
      name: 'Só mudanças',
      ticketTypes: ['CHANGE'],
    })
    await seedSdCategory(workspace.id, {
      name: 'Interna',
      portalVisible: false,
    })

    const incident = expectOk(
      await SdAiRepository.loadCatalog(workspace.id, { type: 'INCIDENT' }),
    )
    expect(incident.categories.map((row) => row.name).sort()).toEqual([
      'Interna',
      'Todos os tipos',
    ])

    const portal = expectOk(
      await SdAiRepository.loadCatalog(workspace.id, { portalOnly: true }),
    )
    expect(portal.categories.map((row) => row.name)).not.toContain('Interna')
  })

  it('ignores deleted departments', async () => {
    const { workspace } = await setup()
    const department = await seedSdDepartment(workspace.id, { name: 'Antigo' })
    await prisma.sdDepartment.update({
      where: { id: department.id },
      data: { deletedAt: new Date() },
    })
    const catalog = expectOk(await SdAiRepository.loadCatalog(workspace.id))
    expect(catalog.departments).toEqual([])
  })
})

describe('SdAiRepository.listTicketMessages', () => {
  it('returns the newest messages in chronological order, without deleted ones', async () => {
    const { workspace, ticket } = await setup()
    await seedSdTicketMessage(workspace.id, ticket.id, {
      body: 'primeira',
      createdAt: at(1),
    })
    await seedSdTicketMessage(workspace.id, ticket.id, {
      body: 'interna',
      visibility: 'INTERNAL',
      createdAt: at(2),
    })
    await seedSdTicketMessage(workspace.id, ticket.id, {
      body: 'apagada',
      createdAt: at(3),
      deletedAt: at(4),
    })
    await seedSdTicketMessage(workspace.id, ticket.id, {
      body: 'ultima',
      createdAt: at(5),
    })

    const all = expectOk(await SdAiRepository.listTicketMessages(ticket.id))
    expect(all.map((row) => row.body)).toEqual([
      'primeira',
      'interna',
      'ultima',
    ])

    const publicOnly = expectOk(
      await SdAiRepository.listTicketMessages(ticket.id, { publicOnly: true }),
    )
    expect(publicOnly.map((row) => row.body)).toEqual(['primeira', 'ultima'])
  })
})

describe('SdAiRepository.setTicketAi', () => {
  it('stores the summary and the triage record', async () => {
    const { ticket } = await setup()

    expectOk(
      await SdAiRepository.setTicketAi(ticket.id, {
        aiSummary: 'Cliente sem acesso à VPN.',
      }),
    )
    expectOk(
      await SdAiRepository.setTicketAi(ticket.id, {
        aiTriage: { applied: ['categoryId'], model: 'gpt', at: 'agora' },
      }),
    )

    const stored = await prisma.sdTicket.findUniqueOrThrow({
      where: { id: ticket.id },
    })
    expect(stored.aiSummary).toBe('Cliente sem acesso à VPN.')
    expect(stored.aiTriage).toMatchObject({ applied: ['categoryId'] })
  })

  it('fails with a database error for an unknown ticket', async () => {
    const result = await SdAiRepository.setTicketAi('nope', {
      aiSummary: 'x',
    })
    expect(result.ok).toBe(false)
  })
})
