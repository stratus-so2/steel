import { describe, expect, it, vi } from 'vitest'
import {
  createFakeCrmCampaign,
  createFakeCrmCampaignRecipient,
} from '@/src/__tests__/factories/crm-campaign.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { databaseError } from '@/src/errors'
import { createCampaignUnsubscribeToken } from '@/src/lib/crm-campaign/tokens'
import { err, ok } from '@/src/lib/result'

vi.mock('@/lib/axiom/audit', () => ({ auditMutation: vi.fn() }))
vi.mock('@/src/repositories/crm-campaign.repository')
vi.mock('@/src/repositories/crm-email-opt-out.repository')

import { CrmCampaignRecipientRepository } from '@/src/repositories/crm-campaign.repository'
import { CrmEmailOptOutRepository } from '@/src/repositories/crm-email-opt-out.repository'
import { CrmEmailOptOutService } from '../crm-email-opt-out.service'

const recipients = vi.mocked(CrmCampaignRecipientRepository)
const optOuts = vi.mocked(CrmEmailOptOutRepository)

function withRecipient(email: string | null = 'Ana@Example.com') {
  recipients.findWithCampaign.mockResolvedValue(
    ok({
      ...createFakeCrmCampaignRecipient({ id: 'r1', email, personId: 'p1' }),
      campaign: createFakeCrmCampaign({ id: 'mc1', workspaceId: 'ws1' }),
    }),
  )
}

describe('CrmEmailOptOutService — multichannel campaign tokens', () => {
  const token = createCampaignUnsubscribeToken('r1')

  it('should preview and unsubscribe through the same opt-out table', async () => {
    withRecipient()
    expect(expectOk(await CrmEmailOptOutService.preview(token))).toEqual({
      email: 'ana@example.com',
    })

    optOuts.upsert.mockResolvedValue(
      ok({
        created: true,
        optOut: {
          id: 'o1',
          workspaceId: 'ws1',
          email: 'ana@example.com',
          personId: 'p1',
          campaignId: 'mc1',
          source: 'LINK',
          createdAt: new Date(),
        },
      }),
    )
    recipients.markFirst.mockResolvedValue(ok(true))
    expect(
      expectOk(await CrmEmailOptOutService.unsubscribe(token, 'LINK')),
    ).toEqual({ email: 'ana@example.com', alreadyOptedOut: false })
    expect(optOuts.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'ws1',
        campaignId: 'mc1',
        personId: 'p1',
      }),
    )
    expect(recipients.markFirst).toHaveBeenCalledWith(
      { id: 'r1' },
      'unsubscribedAt',
      expect.any(Date),
    )
  })

  it('should reject forged, unknown or address-less recipients', async () => {
    expectErr(
      await CrmEmailOptOutService.preview(`${token}x`),
      'CRM_EMAIL_UNSUBSCRIBE_INVALID',
    )
    recipients.findWithCampaign.mockResolvedValueOnce(ok(null))
    expectErr(
      await CrmEmailOptOutService.preview(token),
      'CRM_EMAIL_UNSUBSCRIBE_INVALID',
    )
    withRecipient(null)
    expectErr(
      await CrmEmailOptOutService.preview(token),
      'CRM_EMAIL_UNSUBSCRIBE_INVALID',
    )
    recipients.findWithCampaign.mockResolvedValueOnce(err(databaseError('x')))
    expectErr(await CrmEmailOptOutService.preview(token), 'DATABASE_ERROR')
  })
})
