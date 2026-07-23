import { describe, expect, it } from 'vitest'
import {
  seedCrmEmailCampaign,
  seedCrmEmailCampaignRecipient,
} from '@/src/__tests__/factories/crm-email-marketing.factory'
import { seedUser } from '@/src/__tests__/factories/user.factory'
import { seedWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { expectOk } from '@/src/__tests__/helpers/result.helpers'
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
})
