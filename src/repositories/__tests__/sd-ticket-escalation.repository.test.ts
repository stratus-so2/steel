import { describe, expect, it, vi } from 'vitest'
import { seedSdTicket } from '@/src/__tests__/factories/sd-ticket.factory'
import { seedSdPhase } from '@/src/__tests__/factories/sd-ticket-context.factory'
import { seedUser } from '@/src/__tests__/factories/user.factory'
import { seedWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { prisma } from '@/src/lib/prisma'
import { SdTicketEscalationRepository } from '../sd-ticket-escalation.repository'

describe('SdTicketEscalationRepository', () => {
  it('creates, lists newest first and finds the latest by rule', async () => {
    const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
    const phase = await seedSdPhase(workspace.id)
    const ticket = await seedSdTicket(workspace.id, phase.id)
    const base = {
      workspaceId: workspace.id,
      ticketId: ticket.id,
      kind: 'HIERARCHICAL' as const,
      fromLevel: 0,
      toLevel: 1,
      reason: 'SLA',
    }
    const manual = expectOk(
      await SdTicketEscalationRepository.create({
        ...base,
        createdById: user.id,
        createdAt: new Date('2026-09-01'),
      }),
    )
    expect(manual.createdBy?.id).toBe(user.id)
    const auto = expectOk(
      await SdTicketEscalationRepository.create({
        ...base,
        automatic: true,
        ruleId: 'r1',
        createdAt: new Date('2026-09-02'),
      }),
    )
    expect(
      expectOk(await SdTicketEscalationRepository.listByTicket(ticket.id)).map(
        (e) => e.id,
      ),
    ).toEqual([auto.id, manual.id])
    expect(
      expectOk(
        await SdTicketEscalationRepository.findLatestByRule(ticket.id, 'r1'),
      )?.id,
    ).toBe(auto.id)
    expect(
      expectOk(
        await SdTicketEscalationRepository.findLatestByRule(ticket.id, 'r2'),
      ),
    ).toBeNull()
  })

  it('maps failures to DATABASE_ERROR', async () => {
    const spies = [
      vi
        .spyOn(prisma.sdTicketEscalation, 'create')
        .mockRejectedValueOnce(new Error('boom')),
      vi
        .spyOn(prisma.sdTicketEscalation, 'findMany')
        .mockRejectedValueOnce(new Error('boom')),
      vi
        .spyOn(prisma.sdTicketEscalation, 'findFirst')
        .mockRejectedValueOnce(new Error('boom')),
    ]
    expectErr(
      await SdTicketEscalationRepository.create({
        workspaceId: 'w',
        ticketId: 't',
        kind: 'FUNCTIONAL',
        fromLevel: 0,
        toLevel: 0,
        reason: 'x',
      }),
      'DATABASE_ERROR',
    )
    expectErr(
      await SdTicketEscalationRepository.listByTicket('t'),
      'DATABASE_ERROR',
    )
    expectErr(
      await SdTicketEscalationRepository.findLatestByRule('t', 'r'),
      'DATABASE_ERROR',
    )
    for (const spy of spies) spy.mockRestore()
  })
})
