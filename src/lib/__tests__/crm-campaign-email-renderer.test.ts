import { describe, expect, it, vi } from 'vitest'
import { ok } from '@/src/lib/result'

vi.mock('@/src/services/crm-email-builder.service', () => ({
  renderCampaignEmail: vi.fn(),
}))

import { renderCampaignEmail as renderBuilderEmail } from '@/src/services/crm-email-builder.service'
import { renderCampaignEmail } from '../crm-campaign/email-renderer'

describe('renderCampaignEmail (campaign seam)', () => {
  it('should delegate to the e-mail builder render API', async () => {
    vi.mocked(renderBuilderEmail).mockResolvedValue(
      ok({ subject: 'Oi', html: '<p>Oi</p>', text: 'Oi' }),
    )
    const result = await renderCampaignEmail('tpl1', {
      workspaceId: 'ws1',
      name: 'Ana',
      email: 'ana@example.com',
      campaignLink: 'https://a.test/c/t',
      unsubscribeUrl: 'https://a.test/unsubscribe/u',
    })
    expect(result.ok && result.value.subject).toBe('Oi')
    expect(renderBuilderEmail).toHaveBeenCalledWith(
      'tpl1',
      { name: 'Ana', email: 'ana@example.com' },
      {
        workspaceId: 'ws1',
        campaignLink: 'https://a.test/c/t',
        unsubscribeUrl: 'https://a.test/unsubscribe/u',
      },
    )
  })
})
