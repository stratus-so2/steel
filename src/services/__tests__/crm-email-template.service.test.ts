import type { Role } from '@prisma/client'
import { describe, expect, it, vi } from 'vitest'
import { createFakeCrmEmailTemplate } from '@/src/__tests__/factories/crm-email-marketing.factory'
import { createFakeMembership } from '@/src/__tests__/factories/membership.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { databaseError, notFound } from '@/src/errors'
import { err, ok } from '@/src/lib/result'

vi.mock('@/lib/axiom/audit', () => ({ auditMutation: vi.fn() }))
vi.mock('@/src/repositories/membership.repository')
vi.mock('@/src/repositories/crm-email-template.repository')
vi.mock('@/src/lib/crm-marketing-templates.render', () => ({
  renderMarketingTemplate: vi.fn(
    async (id: string, props?: Record<string, string>) =>
      `<html>${id}:${JSON.stringify(props ?? {})}</html>`,
  ),
}))

import { auditMutation } from '@/lib/axiom/audit'
import { renderMarketingTemplate } from '@/src/lib/crm-marketing-templates.render'
import { CrmEmailTemplateRepository } from '@/src/repositories/crm-email-template.repository'
import { MembershipRepository } from '@/src/repositories/membership.repository'
import { WorkspaceModuleAccessRepository } from '@/src/repositories/workspace-module-access.repository'
import { CrmEmailTemplateService } from '../crm-email-template.service'

const mockedMembershipRepo = vi.mocked(MembershipRepository)
const mockedTemplateRepo = vi.mocked(CrmEmailTemplateRepository)
const mockedModuleAccess = vi.mocked(WorkspaceModuleAccessRepository)
const mockedRender = vi.mocked(renderMarketingTemplate)
const mockedAudit = vi.mocked(auditMutation)

function asRole(role: Role) {
  mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
    ok(createFakeMembership({ role })),
  )
}

const template = createFakeCrmEmailTemplate({ id: 't1', workspaceId: 'ws1' })

describe('CrmEmailTemplateService', () => {
  describe('authorization', () => {
    it('should return FORBIDDEN for a non-member', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(ok(null))
      expectErr(await CrmEmailTemplateService.list('u1', 'ws1'), 'FORBIDDEN')
    })

    it('should return MODULE_DISABLED when the CRM is off', async () => {
      asRole('OWNER')
      mockedModuleAccess.isEnabled.mockResolvedValueOnce(ok(false))
      expectErr(
        await CrmEmailTemplateService.previewLayout('u1', 'ws1', {
          templateId: 'newsletter-update',
        }),
        'MODULE_DISABLED',
      )
      expect(mockedRender).not.toHaveBeenCalled()
    })

    it('should forbid a MEMBER from deleting a template', async () => {
      asRole('MEMBER')
      expectErr(
        await CrmEmailTemplateService.remove('u1', 'ws1', 't1'),
        'FORBIDDEN',
      )
      expect(mockedTemplateRepo.softDelete).not.toHaveBeenCalled()
    })

    it.each([
      [
        'create',
        () =>
          CrmEmailTemplateService.create('u1', 'ws1', {
            name: 'X',
            subject: 'Y',
            contentHtml: '<p/>',
          }),
      ],
      [
        'update',
        () => CrmEmailTemplateService.update('u1', 'ws1', 't1', { name: 'X' }),
      ],
      ['remove', () => CrmEmailTemplateService.remove('u1', 'ws1', 't1')],
    ])('should forbid a VIEWER from %s', async (_name, call) => {
      asRole('VIEWER')
      expectErr(await call(), 'FORBIDDEN')
      expect(mockedTemplateRepo.create).not.toHaveBeenCalled()
      expect(mockedTemplateRepo.findById).not.toHaveBeenCalled()
    })
  })

  describe('list()', () => {
    it('should list templates for a VIEWER', async () => {
      asRole('VIEWER')
      mockedTemplateRepo.listByWorkspace.mockResolvedValue(ok([template]))
      const dtos = expectOk(await CrmEmailTemplateService.list('u1', 'ws1'))
      expect(dtos.map((d) => d.id)).toEqual(['t1'])
    })

    it('should propagate repository errors', async () => {
      asRole('MEMBER')
      mockedTemplateRepo.listByWorkspace.mockResolvedValue(err(databaseError()))
      expectErr(
        await CrmEmailTemplateService.list('u1', 'ws1'),
        'DATABASE_ERROR',
      )
    })
  })

  describe('create()', () => {
    it('should keep the free-form HTML when no layout is chosen', async () => {
      asRole('MEMBER')
      mockedTemplateRepo.create.mockResolvedValue(ok(template))

      expectOk(
        await CrmEmailTemplateService.create('u1', 'ws1', {
          name: 'Boas-vindas',
          subject: 'Oi',
          contentHtml: '<p>livre</p>',
        }),
      )
      expect(mockedRender).not.toHaveBeenCalled()
      expect(mockedTemplateRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: 'ws1',
          createdById: 'u1',
          contentHtml: '<p>livre</p>',
        }),
      )
      expect(mockedAudit).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'create', targetId: 't1' }),
      )
    })

    it('should render the HTML from the fixed layout, ignoring contentHtml', async () => {
      asRole('MEMBER')
      mockedTemplateRepo.create.mockResolvedValue(ok(template))

      expectOk(
        await CrmEmailTemplateService.create('u1', 'ws1', {
          name: 'Layout',
          subject: 'Oi',
          contentHtml: '<p>ignorado</p>',
          templateId: 'newsletter-update',
          templateProps: { title: 'T' },
        }),
      )
      expect(mockedRender).toHaveBeenCalledWith('newsletter-update', {
        title: 'T',
      })
      expect(mockedTemplateRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          contentHtml: '<html>newsletter-update:{"title":"T"}</html>',
          templateId: 'newsletter-update',
        }),
      )
    })

    it('should fall back to an empty body when neither is informed', async () => {
      asRole('MEMBER')
      mockedTemplateRepo.create.mockResolvedValue(ok(template))
      expectOk(
        await CrmEmailTemplateService.create('u1', 'ws1', {
          name: 'X',
          subject: 'Y',
        }),
      )
      expect(mockedTemplateRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ contentHtml: '' }),
      )
    })

    it('should audit a failure and propagate the repository error', async () => {
      asRole('MEMBER')
      mockedTemplateRepo.create.mockResolvedValue(err(databaseError()))
      expectErr(
        await CrmEmailTemplateService.create('u1', 'ws1', {
          name: 'X',
          subject: 'Y',
          contentHtml: '<p/>',
        }),
        'DATABASE_ERROR',
      )
      expect(mockedAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          outcome: 'failure',
          reason: 'DATABASE_ERROR',
        }),
      )
    })
  })

  describe('update()', () => {
    it('should keep free-form HTML edits when the layout is untouched', async () => {
      asRole('MEMBER')
      mockedTemplateRepo.findById.mockResolvedValue(ok(template))
      mockedTemplateRepo.update.mockResolvedValue(ok(template))

      expectOk(
        await CrmEmailTemplateService.update('u1', 'ws1', 't1', {
          contentHtml: '<p>novo</p>',
        }),
      )
      expect(mockedRender).not.toHaveBeenCalled()
      expect(mockedTemplateRepo.update).toHaveBeenCalledWith(
        't1',
        expect.objectContaining({
          contentHtml: '<p>novo</p>',
          updatedById: 'u1',
        }),
      )
      expect(mockedAudit).toHaveBeenCalledWith(
        expect.objectContaining({ meta: { fields: ['contentHtml'] } }),
      )
    })

    it('should re-render with the stored layout when only the props change', async () => {
      asRole('MEMBER')
      mockedTemplateRepo.findById.mockResolvedValue(
        ok(
          createFakeCrmEmailTemplate({
            id: 't1',
            templateId: 'newsletter-update',
            templateProps: { title: 'Antigo' },
          }),
        ),
      )
      mockedTemplateRepo.update.mockResolvedValue(ok(template))

      expectOk(
        await CrmEmailTemplateService.update('u1', 'ws1', 't1', {
          templateProps: { title: 'Novo' },
        }),
      )
      expect(mockedRender).toHaveBeenCalledWith('newsletter-update', {
        title: 'Novo',
      })
    })

    it('should re-render a new layout reusing the stored props', async () => {
      asRole('MEMBER')
      mockedTemplateRepo.findById.mockResolvedValue(
        ok(
          createFakeCrmEmailTemplate({
            id: 't1',
            templateId: 'newsletter-update',
            templateProps: { title: 'Guardado' },
          }),
        ),
      )
      mockedTemplateRepo.update.mockResolvedValue(ok(template))

      expectOk(
        await CrmEmailTemplateService.update('u1', 'ws1', 't1', {
          templateId: 'promo-announcement',
        }),
      )
      expect(mockedRender).toHaveBeenCalledWith('promo-announcement', {
        title: 'Guardado',
      })
    })

    it('should fall back to the edited HTML when props change on a free-form template', async () => {
      asRole('MEMBER')
      mockedTemplateRepo.findById.mockResolvedValue(ok(template))
      mockedTemplateRepo.update.mockResolvedValue(ok(template))

      expectOk(
        await CrmEmailTemplateService.update('u1', 'ws1', 't1', {
          templateProps: { title: 'X' },
        }),
      )
      // Sem layout (nem novo, nem guardado) não há o que renderizar.
      expect(mockedRender).not.toHaveBeenCalled()
      expect(mockedTemplateRepo.update).toHaveBeenCalledWith(
        't1',
        expect.objectContaining({ contentHtml: '' }),
      )
    })

    it('should return not found for a template outside the workspace', async () => {
      asRole('MEMBER')
      mockedTemplateRepo.findById.mockResolvedValue(
        err(notFound('CrmEmailTemplate')),
      )
      expectErr(
        await CrmEmailTemplateService.update('u1', 'ws1', 't1', { name: 'X' }),
        'RESOURCE_NOT_FOUND',
      )
      expect(mockedTemplateRepo.update).not.toHaveBeenCalled()
    })

    it('should propagate update errors', async () => {
      asRole('MEMBER')
      mockedTemplateRepo.findById.mockResolvedValue(ok(template))
      mockedTemplateRepo.update.mockResolvedValue(err(databaseError()))
      expectErr(
        await CrmEmailTemplateService.update('u1', 'ws1', 't1', { name: 'X' }),
        'DATABASE_ERROR',
      )
      expect(mockedAudit).not.toHaveBeenCalled()
    })
  })

  describe('remove()', () => {
    it('should soft-delete for an ADMIN and audit it', async () => {
      asRole('ADMIN')
      mockedTemplateRepo.findById.mockResolvedValue(ok(template))
      mockedTemplateRepo.softDelete.mockResolvedValue(ok(undefined as never))

      expectOk(await CrmEmailTemplateService.remove('u1', 'ws1', 't1'))
      expect(mockedTemplateRepo.softDelete).toHaveBeenCalledWith('t1')
      expect(mockedAudit).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'delete', targetId: 't1' }),
      )
    })

    it('should return not found for a missing template', async () => {
      asRole('OWNER')
      mockedTemplateRepo.findById.mockResolvedValue(
        err(notFound('CrmEmailTemplate')),
      )
      expectErr(
        await CrmEmailTemplateService.remove('u1', 'ws1', 't1'),
        'RESOURCE_NOT_FOUND',
      )
      expect(mockedTemplateRepo.softDelete).not.toHaveBeenCalled()
    })

    it('should propagate soft-delete errors', async () => {
      asRole('OWNER')
      mockedTemplateRepo.findById.mockResolvedValue(ok(template))
      mockedTemplateRepo.softDelete.mockResolvedValue(err(databaseError()))
      expectErr(
        await CrmEmailTemplateService.remove('u1', 'ws1', 't1'),
        'DATABASE_ERROR',
      )
    })
  })

  describe('previewLayout()', () => {
    it('should render the layout without persisting anything (VIEWER allowed)', async () => {
      asRole('VIEWER')
      const dto = expectOk(
        await CrmEmailTemplateService.previewLayout('u1', 'ws1', {
          templateId: 'newsletter-update',
          templateProps: { title: 'Oi' },
        }),
      )
      expect(dto.html).toBe('<html>newsletter-update:{"title":"Oi"}</html>')
      expect(mockedTemplateRepo.create).not.toHaveBeenCalled()
      expect(mockedTemplateRepo.update).not.toHaveBeenCalled()
    })
  })
})
