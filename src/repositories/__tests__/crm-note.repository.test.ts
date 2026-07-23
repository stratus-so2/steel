import { describe, expect, it } from 'vitest'
import { seedCrmCompany } from '@/src/__tests__/factories/crm-company.factory'
import { seedCrmNote } from '@/src/__tests__/factories/crm-note.factory'
import { seedUser } from '@/src/__tests__/factories/user.factory'
import { seedWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { expectOk } from '@/src/__tests__/helpers/result.helpers'
import { CrmNoteRepository } from '../crm-note.repository'

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
  })
})
