import { describe, expect, it } from 'vitest'
import { seedUser } from '@/src/__tests__/factories/user.factory'
import { seedWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { expectOk } from '@/src/__tests__/helpers/result.helpers'
import { CrmProposalTemplateRepository } from '../crm-proposal-template.repository'

describe('CrmProposalTemplateRepository', () => {
  describe('create()', () => {
    it('should persist template sections', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])

      const result = await CrmProposalTemplateRepository.create({
        workspaceId: workspace.id,
        createdById: user.id,
        name: 'Template X',
        sections: [
          {
            type: 'TERMS_CONDITIONS',
            order: 0,
            enabled: true,
            defaultContent: { type: 'TERMS_CONDITIONS', text: 'Termos padrão' },
          },
        ],
      })

      const template = expectOk(result)
      expect(template.sections).toHaveLength(1)
      expect(template.sections[0].defaultContent).toEqual({
        type: 'TERMS_CONDITIONS',
        text: 'Termos padrão',
      })
    })
  })

  describe('update()', () => {
    it('should replace all sections when sections are provided', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      const created = expectOk(
        await CrmProposalTemplateRepository.create({
          workspaceId: workspace.id,
          createdById: user.id,
          name: 'Template X',
          sections: [{ type: 'COVER', order: 0, enabled: true }],
        }),
      )

      const updated = expectOk(
        await CrmProposalTemplateRepository.update(created.id, {
          sections: [
            { type: 'COVER', order: 0, enabled: true },
            { type: 'SIGNATURE', order: 1, enabled: true },
          ],
        }),
      )

      expect(updated.sections).toHaveLength(2)
    })
  })
})
