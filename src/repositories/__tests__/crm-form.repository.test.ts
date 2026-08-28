import { describe, expect, it } from 'vitest'
import { seedCrmForm } from '@/src/__tests__/factories/crm-form.factory'
import { seedUser } from '@/src/__tests__/factories/user.factory'
import { seedWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { prisma } from '@/src/lib/prisma'
import {
  CrmFormRepository,
  CrmFormSubmissionRepository,
} from '../crm-form.repository'

describe('CrmFormRepository', () => {
  describe('findPublishedByPublicToken()', () => {
    it('should return CRM_FORM_NOT_PUBLISHED for a draft form', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      const form = await seedCrmForm(workspace.id, user.id)

      expectErr(
        await CrmFormRepository.findPublishedByPublicToken(form.publicToken),
        'CRM_FORM_NOT_PUBLISHED',
      )
    })

    it('should find a published form', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      const form = await seedCrmForm(workspace.id, user.id, {
        status: 'PUBLISHED',
      })

      const found = expectOk(
        await CrmFormRepository.findPublishedByPublicToken(form.publicToken),
      )
      expect(found.id).toBe(form.id)
    })
  })
})

describe('CrmFormRepository phases', () => {
  it('should persist phases on create and update', async () => {
    const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
    const phases = [{ id: 'p1', title: 'Fase 1' }]

    const created = expectOk(
      await CrmFormRepository.create({
        workspaceId: workspace.id,
        createdById: user.id,
        name: 'Contato',
        phases,
      }),
    )
    expect(created.phases).toEqual(phases)

    const updatedPhases = [
      { id: 'p1', title: 'Fase 1' },
      { id: 'p2', title: 'Fase 2' },
    ]
    const updated = expectOk(
      await CrmFormRepository.update(created.id, { phases: updatedPhases }),
    )
    expect(updated.phases).toEqual(updatedPhases)
  })
})

describe('CrmFormSubmissionRepository', () => {
  describe('create()', () => {
    it('should increment the form submissionCount', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      const form = await seedCrmForm(workspace.id, user.id)

      expectOk(
        await CrmFormSubmissionRepository.create({
          formId: form.id,
          values: { name: 'Jane' },
          action: 'LEAD',
        }),
      )

      const updatedForm = await prisma.crmForm.findUniqueOrThrow({
        where: { id: form.id },
      })
      expect(updatedForm.submissionCount).toBe(1)
    })
  })
})
