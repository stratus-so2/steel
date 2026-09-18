import { describe, expect, it } from 'vitest'
import { createFakeCrmSettings } from '@/src/__tests__/factories/crm-settings.factory'
import { toCrmSettingsDTO } from '../crm-settings.mapper'

describe('toCrmSettingsDTO()', () => {
  it('should expose the defaults when there is no saved row', () => {
    expect(toCrmSettingsDTO('ws1', null)).toEqual({
      workspaceId: 'ws1',
      leadReopenStage: 'RECEIVED',
      proposalValidityDays: 15,
      notifyProposalExpiry: true,
      isDefault: true,
      updatedById: null,
      updatedAt: null,
    })
  })

  it('should map a saved row', () => {
    const updatedAt = new Date('2026-09-18T12:00:00.000Z')
    const dto = toCrmSettingsDTO(
      'ws1',
      createFakeCrmSettings({
        workspaceId: 'ws1',
        leadReopenStage: 'QUALIFIED',
        proposalValidityDays: 30,
        notifyProposalExpiry: false,
        updatedById: 'u1',
        updatedAt,
      }),
    )
    expect(dto).toEqual({
      workspaceId: 'ws1',
      leadReopenStage: 'QUALIFIED',
      proposalValidityDays: 30,
      notifyProposalExpiry: false,
      isDefault: false,
      updatedById: 'u1',
      updatedAt: updatedAt.toISOString(),
    })
  })
})
