import { describe, expect, it, vi } from 'vitest'
import { seedSdTicket } from '@/src/__tests__/factories/sd-ticket.factory'
import {
  seedSdAutomationRule,
  seedSdPhase,
} from '@/src/__tests__/factories/sd-ticket-context.factory'
import { seedUser } from '@/src/__tests__/factories/user.factory'
import { seedWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { prisma } from '@/src/lib/prisma'
import { SdAutomationRepository } from '../sd-automation.repository'

describe('SdAutomationRepository', () => {
  it('lists active rules of the event in order and marks runs', async () => {
    const workspace = await seedWorkspace()
    const second = await seedSdAutomationRule(workspace.id, { position: 2 })
    const first = await seedSdAutomationRule(workspace.id, { position: 1 })
    await seedSdAutomationRule(workspace.id, { active: false })
    await seedSdAutomationRule(workspace.id, { event: 'SLA_BREACHED' })

    const rules = expectOk(
      await SdAutomationRepository.listActiveRules(
        workspace.id,
        'TICKET_CREATED',
      ),
    )
    expect(rules.map((r) => r.id)).toEqual([first.id, second.id])

    const at = new Date('2026-09-21T12:00:00Z')
    expectOk(await SdAutomationRepository.markRun(first.id, at))
    expectOk(await SdAutomationRepository.markRun(first.id, at))
    const stored = await prisma.sdAutomationRule.findUniqueOrThrow({
      where: { id: first.id },
    })
    expect(stored).toMatchObject({ runCount: 2, lastRunAt: at })
  })

  it('inserts system messages and tasks at the end of the list', async () => {
    const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
    const phase = await seedSdPhase(workspace.id)
    const ticket = await seedSdTicket(workspace.id, phase.id)

    const message = expectOk(
      await SdAutomationRepository.insertSystemMessage({
        workspaceId: workspace.id,
        ticketId: ticket.id,
        body: 'Recebemos seu chamado',
        visibility: 'PUBLIC',
      }),
    )
    const stored = await prisma.sdTicketMessage.findUniqueOrThrow({
      where: { id: message.id },
    })
    expect(stored).toMatchObject({ authorKind: 'SYSTEM', channel: 'PLATFORM' })

    expect(
      expectOk(
        await SdAutomationRepository.insertTasks(
          workspace.id,
          ticket.id,
          user.id,
          [],
        ),
      ),
    ).toBe(0)
    expect(
      expectOk(
        await SdAutomationRepository.insertTasks(
          workspace.id,
          ticket.id,
          user.id,
          [{ title: 'A' }],
        ),
      ),
    ).toBe(1)
    const due = new Date('2026-10-01')
    expectOk(
      await SdAutomationRepository.insertTasks(
        workspace.id,
        ticket.id,
        user.id,
        [
          { title: 'B', description: 'd', assigneeId: user.id, dueDate: due },
          { title: 'C' },
        ],
      ),
    )
    const tasks = await prisma.sdTicketTask.findMany({
      where: { ticketId: ticket.id },
      orderBy: { position: 'asc' },
    })
    expect(tasks.map((t) => [t.title, t.position])).toEqual([
      ['A', 0],
      ['B', 1],
      ['C', 2],
    ])
    expect(tasks[1]).toMatchObject({
      description: 'd',
      assigneeId: user.id,
      dueDate: due,
    })
  })

  it('maps failures to DATABASE_ERROR', async () => {
    const spies = [
      vi
        .spyOn(prisma.sdAutomationRule, 'findMany')
        .mockRejectedValueOnce(new Error('boom')),
      vi
        .spyOn(prisma.sdAutomationRule, 'update')
        .mockRejectedValueOnce(new Error('boom')),
      vi
        .spyOn(prisma.sdTicketMessage, 'create')
        .mockRejectedValueOnce(new Error('boom')),
      vi
        .spyOn(prisma.sdTicketTask, 'count')
        .mockRejectedValueOnce(new Error('boom')),
    ]
    expectErr(
      await SdAutomationRepository.listActiveRules('w', 'TICKET_CREATED'),
      'DATABASE_ERROR',
    )
    expectErr(
      await SdAutomationRepository.markRun('r', new Date()),
      'DATABASE_ERROR',
    )
    expectErr(
      await SdAutomationRepository.insertSystemMessage({
        workspaceId: 'w',
        ticketId: 't',
        body: 'x',
        visibility: 'INTERNAL',
      }),
      'DATABASE_ERROR',
    )
    expectErr(
      await SdAutomationRepository.insertTasks('w', 't', 'u', [{ title: 'x' }]),
      'DATABASE_ERROR',
    )
    for (const spy of spies) spy.mockRestore()
  })
})
