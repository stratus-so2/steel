import { describe, expect, it, vi } from 'vitest'
import { createFakeCrmForm } from '@/src/__tests__/factories/crm-form.factory'
import { createFakeCrmLead } from '@/src/__tests__/factories/crm-lead.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { ok } from '@/src/lib/result'

vi.mock('@/src/repositories/membership.repository')
vi.mock('@/src/repositories/crm-form.repository')
vi.mock('@/src/repositories/crm-lead.repository')

import {
  CrmFormRepository,
  CrmFormSubmissionRepository,
} from '@/src/repositories/crm-form.repository'
import { CrmLeadRepository } from '@/src/repositories/crm-lead.repository'
import { MembershipRepository } from '@/src/repositories/membership.repository'
import { CrmFormService } from '../crm-form.service'

const mockedMembershipRepo = vi.mocked(MembershipRepository)
const mockedFormRepo = vi.mocked(CrmFormRepository)
const mockedSubmissionRepo = vi.mocked(CrmFormSubmissionRepository)
const mockedLeadRepo = vi.mocked(CrmLeadRepository)

describe('CrmFormService', () => {
  describe('list()', () => {
    it('should return FORBIDDEN for a non-member', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(ok(null))
      expectErr(await CrmFormService.list('u1', 'ws1'), 'FORBIDDEN')
    })
  })

  describe('submit()', () => {
    it('should apply field mappings and create a lead + submission for a LEAD-action form', async () => {
      mockedFormRepo.findPublishedByPublicToken.mockResolvedValue(
        ok(
          createFakeCrmForm({
            id: 'f1',
            action: 'LEAD',
            workspaceId: 'ws1',
            createdById: 'owner1',
            fields: [
              {
                key: 'full_name',
                label: 'Nome',
                type: 'text',
                required: true,
                mapping: { target: 'lead', attribute: 'name' },
              },
              {
                key: 'work_email',
                label: 'E-mail',
                type: 'email',
                required: true,
                mapping: { target: 'lead', attribute: 'email' },
              },
            ],
          }),
        ),
      )
      mockedLeadRepo.create.mockResolvedValue(
        ok(createFakeCrmLead({ id: 'lead1' })),
      )
      mockedSubmissionRepo.create.mockResolvedValue(
        ok({
          id: 's1',
          formId: 'f1',
          values: { full_name: 'Jane', work_email: 'jane@acme.com' },
          action: 'LEAD',
          createdPersonId: null,
          createdCompanyId: null,
          createdLeadId: 'lead1',
          ipHash: 'hashed',
          referrer: null,
          createdAt: new Date(),
        }),
      )

      const dto = expectOk(
        await CrmFormService.submit('tok', '1.2.3.4', undefined, {
          values: { full_name: 'Jane', work_email: 'jane@acme.com' },
        }),
      )
      expect(dto.createdLeadId).toBe('lead1')
      expect(mockedLeadRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: 'ws1',
          createdById: 'owner1',
          name: 'Jane',
          emails: ['jane@acme.com'],
        }),
      )
    })

    it('should fall back to a default name when no name mapping matched', async () => {
      mockedFormRepo.findPublishedByPublicToken.mockResolvedValue(
        ok(
          createFakeCrmForm({
            id: 'f1',
            action: 'LEAD',
            workspaceId: 'ws1',
            createdById: 'owner1',
            fields: [],
          }),
        ),
      )
      mockedLeadRepo.create.mockResolvedValue(
        ok(createFakeCrmLead({ id: 'lead1' })),
      )
      mockedSubmissionRepo.create.mockResolvedValue(
        ok({
          id: 's1',
          formId: 'f1',
          values: {},
          action: 'LEAD',
          createdPersonId: null,
          createdCompanyId: null,
          createdLeadId: 'lead1',
          ipHash: 'hashed',
          referrer: null,
          createdAt: new Date(),
        }),
      )

      expectOk(
        await CrmFormService.submit('tok', '1.2.3.4', undefined, {
          values: {},
        }),
      )
      expect(mockedLeadRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Sem nome' }),
      )
    })
  })
})
