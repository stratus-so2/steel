import { describe, expect, it, vi } from 'vitest'
import { seedCrmCompany } from '@/src/__tests__/factories/crm-company.factory'
import { seedCrmNote } from '@/src/__tests__/factories/crm-note.factory'
import { seedCrmOpportunity } from '@/src/__tests__/factories/crm-opportunity.factory'
import { seedCrmPerson } from '@/src/__tests__/factories/crm-person.factory'
import {
  seedCrmPipeline,
  seedCrmPipelineStage,
} from '@/src/__tests__/factories/crm-pipeline.factory'
import { seedUser } from '@/src/__tests__/factories/user.factory'
import { seedWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { prisma } from '@/src/lib/prisma'
import { CrmNoteRepository } from '../crm-note.repository'

async function seedBase() {
  const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
  return { workspace, user }
}

describe('CrmNoteRepository', () => {
  describe('listByWorkspace()', () => {
    it('should filter by companyId', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      const company = await seedCrmCompany(workspace.id, user.id)
      const matched = await seedCrmNote(workspace.id, user.id, {
        companyId: company.id,
      })
      await seedCrmNote(workspace.id, user.id)

      const list = expectOk(
        await CrmNoteRepository.listByWorkspace(workspace.id, {
          companyId: company.id,
        }),
      )
      expect(list.map((n) => n.id)).toEqual([matched.id])
    })

    it('should filter by personId and opportunityId', async () => {
      const { workspace, user } = await seedBase()
      const person = await seedCrmPerson(workspace.id, user.id)
      const pipeline = await seedCrmPipeline(workspace.id, user.id)
      const stage = await seedCrmPipelineStage(pipeline.id)
      const opportunity = await seedCrmOpportunity(
        workspace.id,
        user.id,
        pipeline.id,
        stage.id,
      )
      const byPerson = await seedCrmNote(workspace.id, user.id, {
        personId: person.id,
      })
      const byOpportunity = await seedCrmNote(workspace.id, user.id, {
        opportunityId: opportunity.id,
      })

      expect(
        expectOk(
          await CrmNoteRepository.listByWorkspace(workspace.id, {
            personId: person.id,
          }),
        ).map((n) => n.id),
      ).toEqual([byPerson.id])
      expect(
        expectOk(
          await CrmNoteRepository.listByWorkspace(workspace.id, {
            opportunityId: opportunity.id,
          }),
        ).map((n) => n.id),
      ).toEqual([byOpportunity.id])
    })

    it('should hide soft-deleted notes and other workspaces', async () => {
      const { workspace, user } = await seedBase()
      const other = await seedWorkspace()
      const visible = await seedCrmNote(workspace.id, user.id)
      await seedCrmNote(workspace.id, user.id, { deletedAt: new Date() })
      await seedCrmNote(other.id, user.id)

      const list = expectOk(
        await CrmNoteRepository.listByWorkspace(workspace.id),
      )
      expect(list.map((n) => n.id)).toEqual([visible.id])
    })

    it('should return DATABASE_ERROR when the query throws', async () => {
      vi.spyOn(prisma.crmNote, 'findMany').mockRejectedValueOnce(
        new Error('boom'),
      )
      expectErr(await CrmNoteRepository.listByWorkspace('w'), 'DATABASE_ERROR')
    })
  })

  describe('findById()', () => {
    it('should find a note scoped to its workspace', async () => {
      const { workspace, user } = await seedBase()
      const other = await seedWorkspace()
      const note = await seedCrmNote(workspace.id, user.id)

      expect(
        expectOk(await CrmNoteRepository.findById(note.id, workspace.id)).id,
      ).toBe(note.id)
      expectErr(
        await CrmNoteRepository.findById(note.id, other.id),
        'RESOURCE_NOT_FOUND',
      )
    })

    it('should not find a soft-deleted note', async () => {
      const { workspace, user } = await seedBase()
      const note = await seedCrmNote(workspace.id, user.id, {
        deletedAt: new Date(),
      })
      expectErr(
        await CrmNoteRepository.findById(note.id, workspace.id),
        'RESOURCE_NOT_FOUND',
      )
    })

    it('should return DATABASE_ERROR when the query throws', async () => {
      vi.spyOn(prisma.crmNote, 'findFirst').mockRejectedValueOnce(
        new Error('boom'),
      )
      expectErr(await CrmNoteRepository.findById('n', 'w'), 'DATABASE_ERROR')
    })
  })

  describe('create()', () => {
    it('should append the note at the end of the workspace list', async () => {
      const { workspace, user } = await seedBase()
      await seedCrmNote(workspace.id, user.id)
      await seedCrmNote(workspace.id, user.id)

      const note = expectOk(
        await CrmNoteRepository.create({
          workspaceId: workspace.id,
          createdById: user.id,
          title: 'Reunião',
          body: 'Pauta',
        }),
      )
      expect(note.position).toBe(2)
      expect(note.title).toBe('Reunião')
    })

    it('should return DATABASE_ERROR when the workspace does not exist', async () => {
      const user = await seedUser()
      expectErr(
        await CrmNoteRepository.create({
          workspaceId: 'missing',
          createdById: user.id,
        }),
        'DATABASE_ERROR',
      )
    })
  })

  describe('update() / softDelete()', () => {
    it('should update fields and soft delete the note', async () => {
      const { workspace, user } = await seedBase()
      const note = await seedCrmNote(workspace.id, user.id)

      const updated = expectOk(
        await CrmNoteRepository.update(note.id, {
          title: 'Novo',
          body: null,
          updatedById: user.id,
        }),
      )
      expect(updated.title).toBe('Novo')
      expect(updated.body).toBeNull()

      expectOk(await CrmNoteRepository.softDelete(note.id))
      const stored = await prisma.crmNote.findUniqueOrThrow({
        where: { id: note.id },
      })
      expect(stored.deletedAt).not.toBeNull()
    })

    it('should return DATABASE_ERROR for a missing note', async () => {
      expectErr(
        await CrmNoteRepository.update('missing', { title: 'x' }),
        'DATABASE_ERROR',
      )
      expectErr(await CrmNoteRepository.softDelete('missing'), 'DATABASE_ERROR')
    })
  })

  describe('reorder()', () => {
    it('should update positions across the whole workspace', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      const a = await seedCrmNote(workspace.id, user.id)
      const b = await seedCrmNote(workspace.id, user.id)

      expectOk(await CrmNoteRepository.reorder(workspace.id, [b.id, a.id]))

      const list = expectOk(
        await CrmNoteRepository.listByWorkspace(workspace.id),
      )
      expect(list.map((n) => n.id)).toEqual([b.id, a.id])
    })

    it('should fail without touching notes from another workspace', async () => {
      const { workspace, user } = await seedBase()
      const other = await seedWorkspace()
      const foreign = await seedCrmNote(other.id, user.id, { position: 7 })

      expectErr(
        await CrmNoteRepository.reorder(workspace.id, [foreign.id]),
        'DATABASE_ERROR',
      )
      const stored = await prisma.crmNote.findUniqueOrThrow({
        where: { id: foreign.id },
      })
      expect(stored.position).toBe(7)
    })
  })
})
