import { describe, expect, it, vi } from 'vitest'
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

describe('CrmFormRepository (management)', () => {
  describe('listByWorkspace()', () => {
    it('should order by position and hide deleted and foreign forms', async () => {
      const [workspace, other, user] = await Promise.all([
        seedWorkspace(),
        seedWorkspace(),
        seedUser(),
      ])
      const b = await seedCrmForm(workspace.id, user.id, { position: 1 })
      const a = await seedCrmForm(workspace.id, user.id, { position: 0 })
      await seedCrmForm(workspace.id, user.id, { deletedAt: new Date() })
      await seedCrmForm(other.id, user.id)

      const list = expectOk(
        await CrmFormRepository.listByWorkspace(workspace.id),
      )
      expect(list.map((f) => f.id)).toEqual([a.id, b.id])
    })

    it('should return DATABASE_ERROR when the query throws', async () => {
      vi.spyOn(prisma.crmForm, 'findMany').mockRejectedValueOnce(
        new Error('boom'),
      )
      expectErr(await CrmFormRepository.listByWorkspace('w'), 'DATABASE_ERROR')
    })
  })

  describe('findById()', () => {
    it('should find within the workspace only', async () => {
      const [workspace, other, user] = await Promise.all([
        seedWorkspace(),
        seedWorkspace(),
        seedUser(),
      ])
      const form = await seedCrmForm(workspace.id, user.id)

      expect(
        expectOk(await CrmFormRepository.findById(form.id, workspace.id)).id,
      ).toBe(form.id)
      expectErr(
        await CrmFormRepository.findById(form.id, other.id),
        'RESOURCE_NOT_FOUND',
      )
    })

    it('should return DATABASE_ERROR when the query throws', async () => {
      vi.spyOn(prisma.crmForm, 'findFirst').mockRejectedValueOnce(
        new Error('boom'),
      )
      expectErr(await CrmFormRepository.findById('f', 'w'), 'DATABASE_ERROR')
    })
  })

  describe('findPublishedByPublicToken() edge cases', () => {
    it('should return RESOURCE_NOT_FOUND for unknown or deleted forms', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      const deleted = await seedCrmForm(workspace.id, user.id, {
        status: 'PUBLISHED',
        deletedAt: new Date(),
      })

      expectErr(
        await CrmFormRepository.findPublishedByPublicToken('unknown'),
        'RESOURCE_NOT_FOUND',
      )
      expectErr(
        await CrmFormRepository.findPublishedByPublicToken(deleted.publicToken),
        'RESOURCE_NOT_FOUND',
      )
    })

    it('should return DATABASE_ERROR when the query throws', async () => {
      vi.spyOn(prisma.crmForm, 'findFirst').mockRejectedValueOnce(
        new Error('boom'),
      )
      expectErr(
        await CrmFormRepository.findPublishedByPublicToken('t'),
        'DATABASE_ERROR',
      )
    })
  })

  describe('create()', () => {
    it('should append at the end with a fresh public token', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      const existing = await seedCrmForm(workspace.id, user.id)

      const form = expectOk(
        await CrmFormRepository.create({
          workspaceId: workspace.id,
          createdById: user.id,
          name: 'Contato',
          action: 'LEAD',
        }),
      )
      expect(form.position).toBe(1)
      expect(form.status).toBe('DRAFT')
      expect(form.publicToken).toBeTruthy()
      expect(form.publicToken).not.toBe(existing.publicToken)
    })

    it('should return DATABASE_ERROR when the workspace does not exist', async () => {
      const user = await seedUser()
      expectErr(
        await CrmFormRepository.create({
          workspaceId: 'missing',
          createdById: user.id,
          name: 'X',
        }),
        'DATABASE_ERROR',
      )
    })
  })

  describe('setPublished()', () => {
    it('should publish with a timestamp and unpublish clearing it', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      const form = await seedCrmForm(workspace.id, user.id)

      const published = expectOk(
        await CrmFormRepository.setPublished(form.id, true),
      )
      expect(published.status).toBe('PUBLISHED')
      expect(published.publishedAt).toBeInstanceOf(Date)

      const draft = expectOk(
        await CrmFormRepository.setPublished(form.id, false),
      )
      expect(draft.status).toBe('DRAFT')
      expect(draft.publishedAt).toBeNull()
    })
  })

  describe('softDelete()', () => {
    it('should hide the form from lookups', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      const form = await seedCrmForm(workspace.id, user.id)

      expectOk(await CrmFormRepository.softDelete(form.id))
      expectErr(
        await CrmFormRepository.findById(form.id, workspace.id),
        'RESOURCE_NOT_FOUND',
      )
    })
  })

  describe('write failures', () => {
    it('should return DATABASE_ERROR for a missing form', async () => {
      expectErr(
        await CrmFormRepository.update('missing', { name: 'x' }),
        'DATABASE_ERROR',
      )
      expectErr(
        await CrmFormRepository.setPublished('missing', true),
        'DATABASE_ERROR',
      )
      expectErr(await CrmFormRepository.softDelete('missing'), 'DATABASE_ERROR')
    })
  })

  describe('reorder()', () => {
    it('should rewrite positions in the given order', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      const a = await seedCrmForm(workspace.id, user.id, { position: 0 })
      const b = await seedCrmForm(workspace.id, user.id, { position: 1 })

      expectOk(await CrmFormRepository.reorder(workspace.id, [b.id, a.id]))
      const list = expectOk(
        await CrmFormRepository.listByWorkspace(workspace.id),
      )
      expect(list.map((f) => f.id)).toEqual([b.id, a.id])
    })

    it('should refuse to reorder a form from another workspace', async () => {
      const [workspace, other, user] = await Promise.all([
        seedWorkspace(),
        seedWorkspace(),
        seedUser(),
      ])
      const foreign = await seedCrmForm(other.id, user.id, { position: 3 })

      expectErr(
        await CrmFormRepository.reorder(workspace.id, [foreign.id]),
        'DATABASE_ERROR',
      )
      const stored = await prisma.crmForm.findUniqueOrThrow({
        where: { id: foreign.id },
      })
      expect(stored.position).toBe(3)
    })
  })
})

describe('CrmFormSubmissionRepository (listing and failures)', () => {
  it('should list submissions of the form newest first', async () => {
    const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
    const form = await seedCrmForm(workspace.id, user.id)
    const other = await seedCrmForm(workspace.id, user.id)
    const older = expectOk(
      await CrmFormSubmissionRepository.create({
        formId: form.id,
        values: { email: 'a@example.com' },
        action: 'PERSON',
      }),
    )
    await prisma.crmFormSubmission.update({
      where: { id: older.id },
      data: { createdAt: new Date('2020-01-01') },
    })
    const newer = expectOk(
      await CrmFormSubmissionRepository.create({
        formId: form.id,
        values: { email: 'b@example.com' },
        action: 'PERSON',
      }),
    )
    await CrmFormSubmissionRepository.create({
      formId: other.id,
      values: {},
      action: 'PERSON',
    })

    const list = expectOk(await CrmFormSubmissionRepository.listByForm(form.id))
    expect(list.map((s) => s.id)).toEqual([newer.id, older.id])
  })

  it('should return DATABASE_ERROR when listing throws', async () => {
    vi.spyOn(prisma.crmFormSubmission, 'findMany').mockRejectedValueOnce(
      new Error('boom'),
    )
    expectErr(
      await CrmFormSubmissionRepository.listByForm('f'),
      'DATABASE_ERROR',
    )
  })

  it('should return DATABASE_ERROR for a missing form', async () => {
    expectErr(
      await CrmFormSubmissionRepository.create({
        formId: 'missing',
        values: {},
        action: 'LEAD',
      }),
      'DATABASE_ERROR',
    )
  })
})
