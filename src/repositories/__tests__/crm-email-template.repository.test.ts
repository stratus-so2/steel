import { describe, expect, it, vi } from 'vitest'
import { seedCrmEmailTemplate } from '@/src/__tests__/factories/crm-email-marketing.factory'
import { seedUser } from '@/src/__tests__/factories/user.factory'
import { seedWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { prisma } from '@/src/lib/prisma'
import { CrmEmailTemplateRepository } from '../crm-email-template.repository'

describe('CrmEmailTemplateRepository', () => {
  describe('listByWorkspace()', () => {
    it('should exclude soft-deleted templates', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      const kept = await seedCrmEmailTemplate(workspace.id, user.id)
      await seedCrmEmailTemplate(workspace.id, user.id, {
        deletedAt: new Date(),
      })

      const list = expectOk(
        await CrmEmailTemplateRepository.listByWorkspace(workspace.id),
      )
      expect(list.map((t) => t.id)).toEqual([kept.id])
    })

    it('should list newest first without leaking other workspaces', async () => {
      const [workspace, other, user] = await Promise.all([
        seedWorkspace(),
        seedWorkspace(),
        seedUser(),
      ])
      const older = await seedCrmEmailTemplate(workspace.id, user.id)
      await prisma.crmEmailTemplate.update({
        where: { id: older.id },
        data: { createdAt: new Date('2020-01-01') },
      })
      const newer = await seedCrmEmailTemplate(workspace.id, user.id)
      await seedCrmEmailTemplate(other.id, user.id)

      const list = expectOk(
        await CrmEmailTemplateRepository.listByWorkspace(workspace.id),
      )
      expect(list.map((t) => t.id)).toEqual([newer.id, older.id])
    })

    it('should return DATABASE_ERROR when the query throws', async () => {
      vi.spyOn(prisma.crmEmailTemplate, 'findMany').mockRejectedValueOnce(
        new Error('boom'),
      )
      expectErr(
        await CrmEmailTemplateRepository.listByWorkspace('w'),
        'DATABASE_ERROR',
      )
    })
  })

  describe('findById()', () => {
    it('should find within the workspace, never deleted or foreign templates', async () => {
      const [workspace, other, user] = await Promise.all([
        seedWorkspace(),
        seedWorkspace(),
        seedUser(),
      ])
      const template = await seedCrmEmailTemplate(workspace.id, user.id)
      const deleted = await seedCrmEmailTemplate(workspace.id, user.id, {
        deletedAt: new Date(),
      })

      expect(
        expectOk(
          await CrmEmailTemplateRepository.findById(template.id, workspace.id),
        ).id,
      ).toBe(template.id)
      expectErr(
        await CrmEmailTemplateRepository.findById(template.id, other.id),
        'RESOURCE_NOT_FOUND',
      )
      expectErr(
        await CrmEmailTemplateRepository.findById(deleted.id, workspace.id),
        'RESOURCE_NOT_FOUND',
      )
    })

    it('should return DATABASE_ERROR when the query throws', async () => {
      vi.spyOn(prisma.crmEmailTemplate, 'findFirst').mockRejectedValueOnce(
        new Error('boom'),
      )
      expectErr(
        await CrmEmailTemplateRepository.findById('t', 'w'),
        'DATABASE_ERROR',
      )
    })
  })

  describe('create() / update() / softDelete()', () => {
    it('should create with template props, update and soft delete', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])

      const created = expectOk(
        await CrmEmailTemplateRepository.create({
          workspaceId: workspace.id,
          createdById: user.id,
          name: 'Boas-vindas',
          subject: 'Olá',
          contentHtml: '<p>Olá</p>',
          templateId: 'welcome',
          templateProps: { headline: 'Bem-vindo' },
        }),
      )
      expect(created.templateProps).toEqual({ headline: 'Bem-vindo' })

      const updated = expectOk(
        await CrmEmailTemplateRepository.update(created.id, {
          subject: 'Olá de novo',
          updatedById: user.id,
        }),
      )
      expect(updated.subject).toBe('Olá de novo')
      expect(updated.name).toBe('Boas-vindas')

      expectOk(await CrmEmailTemplateRepository.softDelete(created.id))
      expectErr(
        await CrmEmailTemplateRepository.findById(created.id, workspace.id),
        'RESOURCE_NOT_FOUND',
      )
    })

    it('should return DATABASE_ERROR on invalid writes', async () => {
      const user = await seedUser()
      expectErr(
        await CrmEmailTemplateRepository.create({
          workspaceId: 'missing',
          createdById: user.id,
          name: 'X',
          subject: 'X',
          contentHtml: '<p/>',
        }),
        'DATABASE_ERROR',
      )
      expectErr(
        await CrmEmailTemplateRepository.update('missing', { name: 'X' }),
        'DATABASE_ERROR',
      )
      expectErr(
        await CrmEmailTemplateRepository.softDelete('missing'),
        'DATABASE_ERROR',
      )
    })
  })
})
