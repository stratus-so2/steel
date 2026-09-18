import { describe, expect, it, vi } from 'vitest'
import {
  seedCrmProposalTemplate,
  seedCrmProposalTemplateSection,
} from '@/src/__tests__/factories/crm-proposal-template.factory'
import { seedUser } from '@/src/__tests__/factories/user.factory'
import { seedWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { prisma } from '@/src/lib/prisma'
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

  describe('create() / failures', () => {
    it('should return DATABASE_ERROR when the workspace does not exist', async () => {
      const user = await seedUser()
      expectErr(
        await CrmProposalTemplateRepository.create({
          workspaceId: 'missing-workspace',
          createdById: user.id,
          name: 'Orphan',
          sections: [],
        }),
        'DATABASE_ERROR',
      )
    })
  })

  describe('listByWorkspace()', () => {
    it('should list live templates by position without leaking other workspaces', async () => {
      const [workspace, other, user] = await Promise.all([
        seedWorkspace(),
        seedWorkspace(),
        seedUser(),
      ])
      const second = await seedCrmProposalTemplate(workspace.id, user.id, {
        position: 2,
      })
      const first = await seedCrmProposalTemplate(workspace.id, user.id, {
        position: 1,
      })
      await seedCrmProposalTemplate(workspace.id, user.id, {
        deletedAt: new Date(),
      })
      await seedCrmProposalTemplate(other.id, user.id)

      const list = expectOk(
        await CrmProposalTemplateRepository.listByWorkspace(workspace.id),
      )
      expect(list.map((t) => t.id)).toEqual([first.id, second.id])
    })

    it('should return DATABASE_ERROR when the query throws', async () => {
      vi.spyOn(prisma.crmProposalTemplate, 'findMany').mockRejectedValueOnce(
        new Error('boom'),
      )
      expectErr(
        await CrmProposalTemplateRepository.listByWorkspace('ws'),
        'DATABASE_ERROR',
      )
    })
  })

  describe('findById()', () => {
    it('should return the template with sections ordered by order', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      const template = await seedCrmProposalTemplate(workspace.id, user.id)
      await seedCrmProposalTemplateSection(template.id, {
        type: 'SIGNATURE',
        order: 1,
      })
      await seedCrmProposalTemplateSection(template.id, {
        type: 'COVER',
        order: 0,
      })

      const found = expectOk(
        await CrmProposalTemplateRepository.findById(template.id, workspace.id),
      )
      expect(found.sections.map((s) => s.type)).toEqual(['COVER', 'SIGNATURE'])
    })

    it('should return CRM_PROPOSAL_TEMPLATE_NOT_FOUND across workspaces or when deleted', async () => {
      const [workspace, other, user] = await Promise.all([
        seedWorkspace(),
        seedWorkspace(),
        seedUser(),
      ])
      const template = await seedCrmProposalTemplate(workspace.id, user.id)
      const deleted = await seedCrmProposalTemplate(workspace.id, user.id, {
        deletedAt: new Date(),
      })

      expectErr(
        await CrmProposalTemplateRepository.findById(template.id, other.id),
        'CRM_PROPOSAL_TEMPLATE_NOT_FOUND',
      )
      expectErr(
        await CrmProposalTemplateRepository.findById(deleted.id, workspace.id),
        'CRM_PROPOSAL_TEMPLATE_NOT_FOUND',
      )
    })

    it('should return DATABASE_ERROR when the query throws', async () => {
      vi.spyOn(prisma.crmProposalTemplate, 'findFirst').mockRejectedValueOnce(
        new Error('boom'),
      )
      expectErr(
        await CrmProposalTemplateRepository.findById('t', 'ws'),
        'DATABASE_ERROR',
      )
    })
  })

  describe('update() / metadata only', () => {
    it('should keep sections intact when sections are omitted', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      const template = await seedCrmProposalTemplate(workspace.id, user.id)
      await seedCrmProposalTemplateSection(template.id, { type: 'COVER' })

      const updated = expectOk(
        await CrmProposalTemplateRepository.update(template.id, {
          name: 'Renamed',
          description: null,
          updatedById: user.id,
        }),
      )
      expect(updated.name).toBe('Renamed')
      expect(updated.sections.map((s) => s.type)).toEqual(['COVER'])
    })

    it('should return DATABASE_ERROR for a missing template', async () => {
      expectErr(
        await CrmProposalTemplateRepository.update('missing', {
          name: 'x',
          sections: [],
        }),
        'DATABASE_ERROR',
      )
    })
  })

  describe('softDelete()', () => {
    it('should hide the template from reads', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      const template = await seedCrmProposalTemplate(workspace.id, user.id)

      expectOk(await CrmProposalTemplateRepository.softDelete(template.id))
      expectErr(
        await CrmProposalTemplateRepository.findById(template.id, workspace.id),
        'CRM_PROPOSAL_TEMPLATE_NOT_FOUND',
      )
    })

    it('should return DATABASE_ERROR for a missing template', async () => {
      expectErr(
        await CrmProposalTemplateRepository.softDelete('missing'),
        'DATABASE_ERROR',
      )
    })
  })
})
