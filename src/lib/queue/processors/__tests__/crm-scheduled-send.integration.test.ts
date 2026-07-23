import type { Job } from 'bullmq'
import { describe, expect, it } from 'vitest'
import {
  seedCrmEmailCampaign,
  seedCrmEmailCampaignRecipient,
} from '@/src/__tests__/factories/crm-email-marketing.factory'
import { seedMembership } from '@/src/__tests__/factories/membership.factory'
import { seedUser } from '@/src/__tests__/factories/user.factory'
import { seedWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { prisma } from '@/src/lib/prisma'
import { CrmScheduledSendJob } from '../../jobs'
import { processCrmScheduledSend } from '../crm-scheduled-send'

function tickJob(): Job {
  return {
    name: CrmScheduledSendJob.RunTick,
    id: 'test-tick',
  } as unknown as Job
}

describe('processCrmScheduledSend()', () => {
  it('should send due SCHEDULED campaigns and leave future ones alone', async () => {
    const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
    await seedMembership({ userId: user.id, workspaceId: workspace.id })
    const due = await seedCrmEmailCampaign(workspace.id, user.id, {
      status: 'SCHEDULED',
      scheduledAt: new Date(Date.now() - 60_000),
    })
    await seedCrmEmailCampaignRecipient(due.id, { email: 'jane@example.com' })

    const future = await seedCrmEmailCampaign(workspace.id, user.id, {
      status: 'SCHEDULED',
      scheduledAt: new Date(Date.now() + 60_000),
    })

    const result = await processCrmScheduledSend(tickJob())

    expect(result.due).toBe(1)
    expect(result.sent).toBe(1)
    expect(result.failed).toBe(0)

    const [dueAfter, futureAfter] = await Promise.all([
      prisma.crmEmailCampaign.findUniqueOrThrow({ where: { id: due.id } }),
      prisma.crmEmailCampaign.findUniqueOrThrow({ where: { id: future.id } }),
    ])
    expect(dueAfter.status).toBe('SENT')
    expect(futureAfter.status).toBe('SCHEDULED')
  })
})
