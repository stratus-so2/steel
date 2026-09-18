import { describe, expect, it, vi } from 'vitest'
import {
  seedCrmEmailCampaign,
  seedCrmEmailCampaignRecipient,
} from '@/src/__tests__/factories/crm-email-marketing.factory'
import { seedUser } from '@/src/__tests__/factories/user.factory'
import { seedWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { prisma } from '@/src/lib/prisma'
import {
  CrmEmailCampaignRecipientRepository,
  CrmEmailCampaignRepository,
} from '../crm-email-campaign.repository'

describe('CrmEmailCampaignRepository', () => {
  describe('create()', () => {
    it('should default status to SCHEDULED when scheduledAt is set', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])

      const result = await CrmEmailCampaignRepository.create({
        workspaceId: workspace.id,
        createdById: user.id,
        subject: 'Promo',
        contentHtml: '<p>Oi</p>',
        fromAddress: 'crm@stratustelecom.com.br',
        recipientScope: 'ALL',
        scheduledAt: new Date(Date.now() + 86_400_000),
      })

      const campaign = expectOk(result)
      expect(campaign.status).toBe('SCHEDULED')
    })
  })

  describe('listDueScheduled()', () => {
    it('should return only SCHEDULED campaigns with scheduledAt in the past', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      const due = await seedCrmEmailCampaign(workspace.id, user.id, {
        status: 'SCHEDULED',
        scheduledAt: new Date(Date.now() - 60_000),
      })
      await seedCrmEmailCampaign(workspace.id, user.id, {
        status: 'SCHEDULED',
        scheduledAt: new Date(Date.now() + 60_000),
      })
      await seedCrmEmailCampaign(workspace.id, user.id, { status: 'SENT' })

      const list = expectOk(
        await CrmEmailCampaignRepository.listDueScheduled(new Date()),
      )
      expect(list.map((c) => c.id)).toEqual([due.id])
    })
  })

  describe('setStatus()', () => {
    it('should update status and sentAt', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      const campaign = await seedCrmEmailCampaign(workspace.id, user.id)

      const result = expectOk(
        await CrmEmailCampaignRepository.setStatus(
          campaign.id,
          'SENT',
          new Date(),
        ),
      )
      expect(result.status).toBe('SENT')
      expect(result.sentAt).not.toBeNull()
    })
  })
})

describe('CrmEmailCampaignRecipientRepository', () => {
  describe('createMany()', () => {
    it('should bulk insert recipients', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      const campaign = await seedCrmEmailCampaign(workspace.id, user.id)

      const count = expectOk(
        await CrmEmailCampaignRecipientRepository.createMany(campaign.id, [
          { email: 'a@acme.com' },
          { email: 'b@acme.com' },
        ]),
      )
      expect(count).toBe(2)
    })
  })

  describe('markSent()', () => {
    it('should set status SENT and providerMessageId', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      const campaign = await seedCrmEmailCampaign(workspace.id, user.id)
      const recipient = await seedCrmEmailCampaignRecipient(campaign.id)

      expectOk(
        await CrmEmailCampaignRecipientRepository.markSent(
          recipient.id,
          'resend-id-1',
        ),
      )

      const list = expectOk(
        await CrmEmailCampaignRecipientRepository.listByCampaign(campaign.id),
      )
      expect(list[0].status).toBe('SENT')
      expect(list[0].providerMessageId).toBe('resend-id-1')
    })
  })

  describe('findByIdWithCampaign()', () => {
    it('should return the recipient with its campaign workspace', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      const campaign = await seedCrmEmailCampaign(workspace.id, user.id)
      const recipient = await seedCrmEmailCampaignRecipient(campaign.id)

      const found = expectOk(
        await CrmEmailCampaignRecipientRepository.findByIdWithCampaign(
          recipient.id,
        ),
      )
      expect(found.campaign).toEqual({
        id: campaign.id,
        workspaceId: workspace.id,
      })
    })

    it('should return NOT_FOUND for an unknown recipient', async () => {
      expectErr(
        await CrmEmailCampaignRecipientRepository.findByIdWithCampaign(
          'missing',
        ),
        'RESOURCE_NOT_FOUND',
      )
    })
  })

  describe('markSkipped()', () => {
    it('should set status SKIPPED with an opt-out reason', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      const campaign = await seedCrmEmailCampaign(workspace.id, user.id)
      const recipient = await seedCrmEmailCampaignRecipient(campaign.id)

      expectOk(
        await CrmEmailCampaignRecipientRepository.markSkipped(recipient.id),
      )

      const list = expectOk(
        await CrmEmailCampaignRecipientRepository.listByCampaign(campaign.id),
      )
      expect(list[0].status).toBe('SKIPPED')
      expect(list[0].errorMessage).toMatch(/descadastrado/i)
    })
  })
})

describe('CrmEmailCampaignRepository (reads, drafts and failures)', () => {
  it('should create a DRAFT campaign when no schedule is given', async () => {
    const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])

    const campaign = expectOk(
      await CrmEmailCampaignRepository.create({
        workspaceId: workspace.id,
        createdById: user.id,
        subject: 'Newsletter',
        contentHtml: '<p>Oi</p>',
        fromAddress: 'crm@acme.com',
        recipientScope: 'ALL',
      }),
    )
    expect(campaign.status).toBe('DRAFT')
    expect(campaign.scheduledAt).toBeNull()
  })

  it('should list the workspace campaigns newest first with recipient statuses', async () => {
    const [workspace, other, user] = await Promise.all([
      seedWorkspace(),
      seedWorkspace(),
      seedUser(),
    ])
    const older = await seedCrmEmailCampaign(workspace.id, user.id)
    await prisma.crmEmailCampaign.update({
      where: { id: older.id },
      data: { createdAt: new Date('2020-01-01') },
    })
    const newer = await seedCrmEmailCampaign(workspace.id, user.id)
    await seedCrmEmailCampaignRecipient(older.id, { status: 'SENT' })
    await seedCrmEmailCampaign(other.id, user.id)

    const list = expectOk(
      await CrmEmailCampaignRepository.listByWorkspace(workspace.id),
    )
    expect(list.map((c) => c.id)).toEqual([newer.id, older.id])
    expect(list[1]._count.recipients).toBe(1)
    expect(list[1].recipients).toEqual([{ status: 'SENT' }])
  })

  it('should find a campaign only inside its workspace', async () => {
    const [workspace, other, user] = await Promise.all([
      seedWorkspace(),
      seedWorkspace(),
      seedUser(),
    ])
    const campaign = await seedCrmEmailCampaign(workspace.id, user.id)

    expect(
      expectOk(
        await CrmEmailCampaignRepository.findById(campaign.id, workspace.id),
      ).id,
    ).toBe(campaign.id)
    expectErr(
      await CrmEmailCampaignRepository.findById(campaign.id, other.id),
      'RESOURCE_NOT_FOUND',
    )
  })

  it('should update the campaign content', async () => {
    const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
    const campaign = await seedCrmEmailCampaign(workspace.id, user.id)

    const updated = expectOk(
      await CrmEmailCampaignRepository.update(campaign.id, {
        subject: 'Novo assunto',
        fromAddress: 'news@acme.com',
      }),
    )
    expect(updated).toMatchObject({
      subject: 'Novo assunto',
      fromAddress: 'news@acme.com',
    })
  })

  it('should return DATABASE_ERROR on failing reads and writes', async () => {
    const user = await seedUser()
    vi.spyOn(prisma.crmEmailCampaign, 'findMany')
      .mockRejectedValueOnce(new Error('boom'))
      .mockRejectedValueOnce(new Error('boom'))
    vi.spyOn(prisma.crmEmailCampaign, 'findFirst').mockRejectedValueOnce(
      new Error('boom'),
    )

    expectErr(
      await CrmEmailCampaignRepository.listByWorkspace('w'),
      'DATABASE_ERROR',
    )
    expectErr(
      await CrmEmailCampaignRepository.listDueScheduled(new Date()),
      'DATABASE_ERROR',
    )
    expectErr(
      await CrmEmailCampaignRepository.findById('c', 'w'),
      'DATABASE_ERROR',
    )
    expectErr(
      await CrmEmailCampaignRepository.create({
        workspaceId: 'missing',
        createdById: user.id,
        subject: 'x',
        contentHtml: 'x',
        fromAddress: 'x@x.com',
        recipientScope: 'ALL',
      }),
      'DATABASE_ERROR',
    )
    expectErr(
      await CrmEmailCampaignRepository.update('missing', { subject: 'x' }),
      'DATABASE_ERROR',
    )
    expectErr(
      await CrmEmailCampaignRepository.setStatus('missing', 'SENT'),
      'DATABASE_ERROR',
    )
  })
})

describe('CrmEmailCampaignRecipientRepository (listing and failures)', () => {
  it('should list the campaign recipients oldest first and mark one failed', async () => {
    const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
    const campaign = await seedCrmEmailCampaign(workspace.id, user.id)
    const otherCampaign = await seedCrmEmailCampaign(workspace.id, user.id)
    const first = await seedCrmEmailCampaignRecipient(campaign.id, {
      email: 'a@x.com',
    })
    await prisma.crmEmailCampaignRecipient.update({
      where: { id: first.id },
      data: { createdAt: new Date('2020-01-01') },
    })
    const second = await seedCrmEmailCampaignRecipient(campaign.id, {
      email: 'b@x.com',
    })
    await seedCrmEmailCampaignRecipient(otherCampaign.id)

    const list = expectOk(
      await CrmEmailCampaignRecipientRepository.listByCampaign(campaign.id),
    )
    expect(list.map((r) => r.id)).toEqual([first.id, second.id])

    expectOk(
      await CrmEmailCampaignRecipientRepository.markFailed(
        second.id,
        'Caixa cheia',
      ),
    )
    const stored = await prisma.crmEmailCampaignRecipient.findUniqueOrThrow({
      where: { id: second.id },
    })
    expect(stored).toMatchObject({
      status: 'FAILED',
      errorMessage: 'Caixa cheia',
    })
  })

  it('should return DATABASE_ERROR on failing reads and writes', async () => {
    vi.spyOn(
      prisma.crmEmailCampaignRecipient,
      'findMany',
    ).mockRejectedValueOnce(new Error('boom'))
    vi.spyOn(
      prisma.crmEmailCampaignRecipient,
      'findUnique',
    ).mockRejectedValueOnce(new Error('boom'))

    expectErr(
      await CrmEmailCampaignRecipientRepository.listByCampaign('c'),
      'DATABASE_ERROR',
    )
    expectErr(
      await CrmEmailCampaignRecipientRepository.findByIdWithCampaign('r'),
      'DATABASE_ERROR',
    )
    expectErr(
      await CrmEmailCampaignRecipientRepository.createMany('missing', [
        { email: 'x@x.com' },
      ]),
      'DATABASE_ERROR',
    )
    expectErr(
      await CrmEmailCampaignRecipientRepository.markSkipped('missing'),
      'DATABASE_ERROR',
    )
    expectErr(
      await CrmEmailCampaignRecipientRepository.markSent('missing'),
      'DATABASE_ERROR',
    )
    expectErr(
      await CrmEmailCampaignRecipientRepository.markFailed('missing', 'x'),
      'DATABASE_ERROR',
    )
  })
})
