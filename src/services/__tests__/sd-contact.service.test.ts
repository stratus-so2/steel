import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createFakeSdContact } from '@/src/__tests__/factories/sd-contact.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import {
  asSdMember,
  asSdStranger,
} from '@/src/__tests__/helpers/sd-directory.helpers'
import { databaseError, sdContactNotFound } from '@/src/errors'
import { err, ok } from '@/src/lib/result'
import {
  CreateSdContactSchema,
  ListSdContactsSchema,
} from '@/src/schemas/sd-contact.schema'

vi.mock('@/src/repositories/membership.repository')
vi.mock('@/src/repositories/sd-access.repository')
vi.mock('@/src/repositories/sd-contact.repository')
vi.mock('@/src/repositories/sd-customer.repository')
vi.mock('@/lib/axiom/audit')

import { auditMutation } from '@/lib/axiom/audit'
import { SdContactRepository } from '@/src/repositories/sd-contact.repository'
import { SdCustomerRepository } from '@/src/repositories/sd-customer.repository'
import { WorkspaceModuleAccessRepository } from '@/src/repositories/workspace-module-access.repository'
import { SdContactService } from '../sd-contact.service'

const repo = vi.mocked(SdContactRepository)
const customers = vi.mocked(SdCustomerRepository)
const audit = vi.mocked(auditMutation)
const moduleAccess = vi.mocked(WorkspaceModuleAccessRepository)

const create = (input: Record<string, unknown> = {}) =>
  CreateSdContactSchema.parse({ name: 'Ana', ...input })
const listQuery = ListSdContactsSchema.parse({})

beforeEach(() => {
  asSdMember('MEMBER')
  customers.findExistingIds.mockImplementation(async (_ws, ids) => ok(ids))
  repo.isWorkspaceMember.mockResolvedValue(ok(true))
})

describe('SdContactService', () => {
  describe('authorization', () => {
    it('denies non-members, disabled module and requesters', async () => {
      asSdStranger()
      expectErr(
        await SdContactService.list('u1', 'ws1', listQuery),
        'FORBIDDEN',
      )

      asSdMember('MEMBER')
      moduleAccess.isEnabled.mockResolvedValueOnce(ok(false))
      expectErr(
        await SdContactService.list('u1', 'ws1', listQuery),
        'MODULE_DISABLED',
      )

      asSdMember('MEMBER', { agent: false })
      expectErr(await SdContactService.get('u1', 'ws1', 'p1'), 'SD_NOT_AGENT')
      expectErr(
        await SdContactService.lookup('u1', 'ws1', { email: 'a@b.c' }),
        'SD_NOT_AGENT',
      )
      expect(repo.list).not.toHaveBeenCalled()
    })

    it('denies VIEWER writes and MEMBER deletes', async () => {
      asSdMember('VIEWER')
      expectErr(
        await SdContactService.create('u1', 'ws1', create()),
        'FORBIDDEN',
      )
      expectErr(
        await SdContactService.update('u1', 'ws1', 'p1', { name: 'x' }),
        'FORBIDDEN',
      )
      asSdMember('MEMBER')
      expectErr(await SdContactService.remove('u1', 'ws1', 'p1'), 'FORBIDDEN')
      expect(repo.create).not.toHaveBeenCalled()
      expect(repo.softDelete).not.toHaveBeenCalled()
    })
  })

  describe('list() / get()', () => {
    it('maps the page', async () => {
      repo.list.mockResolvedValue(
        ok({
          items: [
            createFakeSdContact({
              id: 'p1',
              user: {
                id: 'u9',
                name: 'Ana',
                email: 'ana@x.com',
                image: null,
              },
              customers: [
                {
                  contactId: 'p1',
                  customerId: 'c1',
                  isPrimary: true,
                  customer: { id: 'c1', name: 'Acme', kind: 'COMPANY' },
                },
              ],
            }),
          ],
          total: 1,
        }),
      )
      const page = expectOk(await SdContactService.list('u1', 'ws1', listQuery))
      expect(page.items[0]).toMatchObject({
        id: 'p1',
        user: { id: 'u9', name: 'Ana', email: 'ana@x.com', image: null },
        customers: [
          { id: 'c1', name: 'Acme', kind: 'COMPANY', isPrimary: true },
        ],
      })
      expect(page).toMatchObject({ total: 1, page: 1, pageSize: 25 })
    })

    it('propagates list errors', async () => {
      repo.list.mockResolvedValue(err(databaseError()))
      expectErr(
        await SdContactService.list('u1', 'ws1', listQuery),
        'DATABASE_ERROR',
      )
    })

    it('returns the detail with recent tickets', async () => {
      repo.findById.mockResolvedValue(ok(createFakeSdContact({ id: 'p1' })))
      repo.listRecentTickets.mockResolvedValue(ok([]))
      const detail = expectOk(await SdContactService.get('u1', 'ws1', 'p1'))
      expect(detail).toMatchObject({ id: 'p1', recentTickets: [], user: null })
      expect(repo.listRecentTickets).toHaveBeenCalledWith('ws1', 'p1')
    })

    it('propagates detail errors', async () => {
      repo.findById.mockResolvedValueOnce(err(sdContactNotFound()))
      expectErr(
        await SdContactService.get('u1', 'ws1', 'p1'),
        'SD_CONTACT_NOT_FOUND',
      )
      repo.findById.mockResolvedValueOnce(ok(createFakeSdContact()))
      repo.listRecentTickets.mockResolvedValueOnce(err(databaseError()))
      expectErr(await SdContactService.get('u1', 'ws1', 'p1'), 'DATABASE_ERROR')
    })
  })

  describe('options()', () => {
    it('builds sublabels from job title, primary customer and email/whatsapp', async () => {
      repo.options.mockResolvedValue(
        ok([
          {
            id: 'p1',
            name: 'Ana',
            jobTitle: 'TI',
            email: 'ana@x.com',
            whatsapp: null,
            customers: [{ customer: { name: 'Acme' } }],
          },
          {
            id: 'p2',
            name: 'Bia',
            jobTitle: null,
            email: null,
            whatsapp: '5511987654321',
            customers: [],
          },
          {
            id: 'p3',
            name: 'Caio',
            jobTitle: null,
            email: null,
            whatsapp: null,
            customers: [],
          },
        ]),
      )
      expect(
        expectOk(
          await SdContactService.options('u1', 'ws1', {
            customerId: 'c1',
            limit: 20,
          }),
        ),
      ).toEqual([
        { id: 'p1', label: 'Ana', sublabel: 'TI · Acme · ana@x.com' },
        { id: 'p2', label: 'Bia', sublabel: '+55 (11) 98765-4321' },
        { id: 'p3', label: 'Caio', sublabel: null },
      ])
    })

    it('propagates errors', async () => {
      repo.options.mockResolvedValue(err(databaseError()))
      expectErr(
        await SdContactService.options('u1', 'ws1', { limit: 5 }),
        'DATABASE_ERROR',
      )
    })
  })

  describe('userOptions()', () => {
    it('maps workspace members to options for agents', async () => {
      repo.listMemberOptions.mockResolvedValue(
        ok([{ id: 'u9', name: 'Bob', email: 'bob@x.com', image: null }]),
      )
      expect(
        expectOk(await SdContactService.userOptions('u1', 'ws1', { limit: 5 })),
      ).toEqual([{ id: 'u9', label: 'Bob', sublabel: 'bob@x.com' }])

      repo.listMemberOptions.mockResolvedValueOnce(err(databaseError()))
      expectErr(
        await SdContactService.userOptions('u1', 'ws1', { limit: 5 }),
        'DATABASE_ERROR',
      )
      asSdMember('MEMBER', { agent: false })
      expectErr(
        await SdContactService.userOptions('u1', 'ws1', { limit: 5 }),
        'SD_NOT_AGENT',
      )
    })
  })

  describe('findByChannel() / lookup()', () => {
    it('matches WhatsApp with and without the ninth digit and trims the email', async () => {
      repo.findByChannel.mockResolvedValue(
        ok(createFakeSdContact({ id: 'p1' })),
      )
      const found = expectOk(
        await SdContactService.findByChannel('ws1', {
          whatsapp: '+55 11 98765-4321',
          email: '  ana@x.com ',
        }),
      )
      expect(found?.id).toBe('p1')
      expect(repo.findByChannel).toHaveBeenCalledWith('ws1', {
        whatsapp: ['5511987654321', '551187654321'],
        email: 'ana@x.com',
      })
    })

    it('returns null when nothing matches and propagates errors', async () => {
      repo.findByChannel.mockResolvedValueOnce(ok(null))
      expect(
        expectOk(await SdContactService.findByChannel('ws1', { email: '' })),
      ).toBeNull()
      expect(repo.findByChannel).toHaveBeenLastCalledWith('ws1', {
        whatsapp: [],
        email: undefined,
      })

      repo.findByChannel.mockResolvedValueOnce(err(databaseError()))
      expectErr(
        await SdContactService.findByChannel('ws1', { whatsapp: '1199' }),
        'DATABASE_ERROR',
      )
    })

    it('lookup() requires an agent and delegates', async () => {
      repo.findByChannel.mockResolvedValue(ok(null))
      expect(
        expectOk(
          await SdContactService.lookup('u1', 'ws1', { email: 'x@y.z' }),
        ),
      ).toBeNull()
    })
  })

  describe('create()', () => {
    it('dedupes links, marks the first as primary, normalizes phones and audits', async () => {
      repo.create.mockResolvedValue(ok(createFakeSdContact({ id: 'p1' })))
      expectOk(
        await SdContactService.create(
          'u1',
          'ws1',
          create({
            whatsapp: '(11) 98765-4321',
            phone: '',
            userId: 'u9',
            customers: [
              { customerId: 'c1' },
              { customerId: 'c2' },
              { customerId: 'c1' },
            ],
          }),
        ),
      )
      expect(customers.findExistingIds).toHaveBeenCalledWith('ws1', [
        'c1',
        'c2',
      ])
      expect(repo.isWorkspaceMember).toHaveBeenCalledWith('ws1', 'u9')
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: 'ws1',
          createdById: 'u1',
          whatsapp: '5511987654321',
          phone: null,
          userId: 'u9',
        }),
        [
          { customerId: 'c1', isPrimary: true },
          { customerId: 'c2', isPrimary: false },
        ],
      )
      expect(audit).toHaveBeenCalledWith(
        expect.objectContaining({
          entity: 'sd_contact',
          action: 'create',
          targetId: 'p1',
        }),
      )
    })

    it('keeps an explicit primary and merges duplicates flagged primary', async () => {
      repo.create.mockResolvedValue(ok(createFakeSdContact()))
      expectOk(
        await SdContactService.create(
          'u1',
          'ws1',
          create({
            customers: [
              { customerId: 'c1' },
              { customerId: 'c2', isPrimary: true },
              { customerId: 'c2' },
            ],
          }),
        ),
      )
      expect(repo.create.mock.calls[0][1]).toEqual([
        { customerId: 'c1', isPrimary: false },
        { customerId: 'c2', isPrimary: true },
      ])
    })

    it('skips membership check without user and accepts no links', async () => {
      repo.create.mockResolvedValue(ok(createFakeSdContact()))
      expectOk(await SdContactService.create('u1', 'ws1', create()))
      expect(repo.isWorkspaceMember).not.toHaveBeenCalled()
      expect(repo.create.mock.calls[0][1]).toEqual([])
    })

    it('rejects unknown customers and non-member users', async () => {
      customers.findExistingIds.mockResolvedValueOnce(ok([]))
      expectErr(
        await SdContactService.create(
          'u1',
          'ws1',
          create({ customers: [{ customerId: 'other-ws' }] }),
        ),
        'SD_CUSTOMER_NOT_FOUND',
      )

      customers.findExistingIds.mockResolvedValueOnce(err(databaseError()))
      expectErr(
        await SdContactService.create(
          'u1',
          'ws1',
          create({ customers: [{ customerId: 'c1' }] }),
        ),
        'DATABASE_ERROR',
      )

      repo.isWorkspaceMember.mockResolvedValueOnce(ok(false))
      expectErr(
        await SdContactService.create('u1', 'ws1', create({ userId: 'x' })),
        'VALIDATION_ERROR',
      )

      repo.isWorkspaceMember.mockResolvedValueOnce(err(databaseError()))
      expectErr(
        await SdContactService.create('u1', 'ws1', create({ userId: 'x' })),
        'DATABASE_ERROR',
      )
      expect(repo.create).not.toHaveBeenCalled()
    })

    it('audits failed inserts', async () => {
      repo.create.mockResolvedValue(err(databaseError()))
      expectErr(
        await SdContactService.create('u1', 'ws1', create()),
        'DATABASE_ERROR',
      )
      expect(audit).toHaveBeenCalledWith(
        expect.objectContaining({ outcome: 'failure' }),
      )
    })
  })

  describe('update()', () => {
    it('replaces links only when sent and re-checks a changed user', async () => {
      repo.findById.mockResolvedValue(
        ok(createFakeSdContact({ id: 'p1', userId: 'u5' })),
      )
      repo.update.mockResolvedValue(ok(createFakeSdContact({ id: 'p1' })))

      expectOk(
        await SdContactService.update('u1', 'ws1', 'p1', { jobTitle: 'CTO' }),
      )
      expect(repo.update).toHaveBeenLastCalledWith(
        'p1',
        expect.objectContaining({ jobTitle: 'CTO' }),
        undefined,
      )

      expectOk(
        await SdContactService.update('u1', 'ws1', 'p1', {
          userId: 'u5',
          customers: [{ customerId: 'c3', isPrimary: false }],
          whatsapp: '11 98765-4321',
        }),
      )
      expect(repo.isWorkspaceMember).not.toHaveBeenCalled()
      expect(repo.update).toHaveBeenLastCalledWith(
        'p1',
        expect.objectContaining({ whatsapp: '5511987654321' }),
        [{ customerId: 'c3', isPrimary: true }],
      )

      repo.isWorkspaceMember.mockResolvedValueOnce(ok(false))
      expectErr(
        await SdContactService.update('u1', 'ws1', 'p1', { userId: 'u6' }),
        'VALIDATION_ERROR',
      )
      expect(audit).toHaveBeenCalledWith(
        expect.objectContaining({ entity: 'sd_contact', action: 'update' }),
      )
    })

    it('propagates not found, link and update errors', async () => {
      repo.findById.mockResolvedValueOnce(err(sdContactNotFound()))
      expectErr(
        await SdContactService.update('u1', 'ws1', 'p1', { name: 'x' }),
        'SD_CONTACT_NOT_FOUND',
      )

      repo.findById.mockResolvedValue(ok(createFakeSdContact({ id: 'p1' })))
      customers.findExistingIds.mockResolvedValueOnce(ok([]))
      expectErr(
        await SdContactService.update('u1', 'ws1', 'p1', {
          customers: [{ customerId: 'nope', isPrimary: true }],
        }),
        'SD_CUSTOMER_NOT_FOUND',
      )

      repo.update.mockResolvedValueOnce(err(databaseError()))
      expectErr(
        await SdContactService.update('u1', 'ws1', 'p1', { name: 'x' }),
        'DATABASE_ERROR',
      )
    })
  })

  describe('remove()', () => {
    it('soft-deletes for ADMIN and propagates errors', async () => {
      asSdMember('ADMIN')
      repo.findById.mockResolvedValue(ok(createFakeSdContact({ id: 'p1' })))
      repo.softDelete.mockResolvedValueOnce(ok(undefined))
      expectOk(await SdContactService.remove('u1', 'ws1', 'p1'))
      expect(audit).toHaveBeenCalledWith(
        expect.objectContaining({ entity: 'sd_contact', action: 'delete' }),
      )

      repo.softDelete.mockResolvedValueOnce(err(databaseError()))
      expectErr(
        await SdContactService.remove('u1', 'ws1', 'p1'),
        'DATABASE_ERROR',
      )

      repo.findById.mockResolvedValueOnce(err(sdContactNotFound()))
      expectErr(
        await SdContactService.remove('u1', 'ws1', 'p1'),
        'SD_CONTACT_NOT_FOUND',
      )
    })
  })

  describe('importRows()', () => {
    it('links by customer document, reports unknown documents and invalid rows', async () => {
      repo.create.mockResolvedValue(ok(createFakeSdContact()))
      customers.findByDocument
        .mockResolvedValueOnce(ok({ id: 'c1' } as never))
        .mockResolvedValueOnce(ok(null))
        .mockResolvedValueOnce(err(databaseError('db caiu')))

      const result = expectOk(
        await SdContactService.importRows('u1', 'ws1', {
          rows: [
            {
              nome: 'Ana',
              celular: '11987654321',
              cnpj_cliente: '11.222.333/0001-81',
            },
            { nome: 'Bia', documento_cliente: '999' },
            { nome: 'Caio', documento_cliente: '52998224725' },
            { nome: 'Dani', email: 'invalido' },
            { nome: 'Edu' },
          ],
        }),
      )
      expect(result.created).toBe(2)
      expect(result.rejected).toEqual([
        { line: 3, message: 'Nenhum cliente/empresa com o documento 999' },
        { line: 4, message: 'db caiu' },
        { line: 5, message: 'email: E-mail inválido' },
      ])
      expect(customers.findByDocument).toHaveBeenNthCalledWith(
        1,
        'ws1',
        '11222333000181',
      )
      expect(repo.create).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ name: 'Ana', whatsapp: '5511987654321' }),
        [{ customerId: 'c1', isPrimary: true }],
      )
      expect(repo.create).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ name: 'Edu' }),
        [],
      )
    })

    it('reports failed inserts and rows without a name', async () => {
      repo.create.mockResolvedValue(err(databaseError('falhou')))
      const result = expectOk(
        await SdContactService.importRows('u1', 'ws1', {
          rows: [{ nome: 'A' }, { cargo: 'TI' }],
        }),
      )
      expect(result.created).toBe(0)
      expect(result.rejected[0]).toEqual({ line: 2, message: 'falhou' })
      expect(result.rejected[1].line).toBe(3)
      expect(result.rejected[1].message).toMatch(/^name: /)
    })

    it('requires CREATE permission', async () => {
      asSdMember('VIEWER')
      expectErr(
        await SdContactService.importRows('u1', 'ws1', {
          rows: [{ nome: 'A' }],
        }),
        'FORBIDDEN',
      )
    })
  })
})
