import { describe, expect, it } from 'vitest'
import { seedCrmSettings } from '@/src/__tests__/factories/crm-settings.factory'
import { seedUser } from '@/src/__tests__/factories/user.factory'
import { seedWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { expectOk } from '@/src/__tests__/helpers/result.helpers'
import { CrmSettingsRepository } from '../crm-settings.repository'

describe('CrmSettingsRepository', () => {
  describe('findByWorkspace()', () => {
    it('should return null when the workspace never saved settings', async () => {
      const workspace = await seedWorkspace()
      expect(
        expectOk(await CrmSettingsRepository.findByWorkspace(workspace.id)),
      ).toBeNull()
    })

    it('should return only the settings of the given workspace', async () => {
      const [workspace, other] = await Promise.all([
        seedWorkspace(),
        seedWorkspace(),
      ])
      await seedCrmSettings(other.id, { proposalValidityDays: 30 })
      await seedCrmSettings(workspace.id, { proposalValidityDays: 7 })

      const found = expectOk(
        await CrmSettingsRepository.findByWorkspace(workspace.id),
      )
      expect(found?.proposalValidityDays).toBe(7)
    })
  })

  describe('upsert()', () => {
    it('should create the row with database defaults for omitted fields', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])

      const created = expectOk(
        await CrmSettingsRepository.upsert(workspace.id, {
          leadReopenStage: 'QUALIFIED',
          updatedById: user.id,
        }),
      )

      expect(created.leadReopenStage).toBe('QUALIFIED')
      expect(created.proposalValidityDays).toBe(15)
      expect(created.notifyProposalExpiry).toBe(true)
      expect(created.updatedById).toBe(user.id)
    })

    it('should update only the given fields of an existing row', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      await seedCrmSettings(workspace.id, {
        leadReopenStage: 'IN_CONTACT',
        proposalValidityDays: 10,
      })

      const updated = expectOk(
        await CrmSettingsRepository.upsert(workspace.id, {
          proposalValidityDays: 45,
          updatedById: user.id,
        }),
      )

      expect(updated.proposalValidityDays).toBe(45)
      expect(updated.leadReopenStage).toBe('IN_CONTACT')
    })
  })
})
