import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createFakeSdCustomer,
  createFakeSdCustomerDetail,
} from '@/src/__tests__/factories/sd-customer.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import {
  asSdMember,
  asSdStranger,
} from '@/src/__tests__/helpers/sd-directory.helpers'
import { databaseError, sdCustomerNotFound } from '@/src/errors'
import { err, ok } from '@/src/lib/result'
import {
  CreateSdCustomerSchema,
  ListSdCustomersSchema,
} from '@/src/schemas/sd-customer.schema'

vi.mock('@/src/repositories/membership.repository')
vi.mock('@/src/repositories/sd-access.repository')
vi.mock('@/src/repositories/sd-customer.repository')
vi.mock('@/lib/axiom/audit')

import { auditMutation } from '@/lib/axiom/audit'
import { SdCustomerRepository } from '@/src/repositories/sd-customer.repository'
import { WorkspaceModuleAccessRepository } from '@/src/repositories/workspace-module-access.repository'
import { SdCustomerService } from '../sd-customer.service'

const repo = vi.mocked(SdCustomerRepository)
const audit = vi.mocked(auditMutation)
const moduleAccess = vi.mocked(WorkspaceModuleAccessRepository)

const create = (input: Record<string, unknown>) =>
  CreateSdCustomerSchema.parse({ name: 'Acme', ...input })
const listQuery = ListSdCustomersSchema.parse({})

beforeEach(() => {
  asSdMember('MEMBER')
  repo.findByDocument.mockResolvedValue(ok(null))
})

describe('SdCustomerService', () => {
  describe('authorization', () => {
    it('denies non-members', async () => {
      asSdStranger()
      expectErr(
        await SdCustomerService.list('u1', 'ws1', listQuery),
        'FORBIDDEN',
      )
      expect(repo.list).not.toHaveBeenCalled()
    })

    it('returns MODULE_DISABLED when the ServiceDesk is off', async () => {
      moduleAccess.isEnabled.mockResolvedValueOnce(ok(false))
      expectErr(
        await SdCustomerService.list('u1', 'ws1', listQuery),
        'MODULE_DISABLED',
      )
    })

    it('refuses requesters (members without a department)', async () => {
      asSdMember('MEMBER', { agent: false })
      expectErr(await SdCustomerService.get('u1', 'ws1', 'c1'), 'SD_NOT_AGENT')
      expectErr(
        await SdCustomerService.options('u1', 'ws1', { limit: 5 }),
        'SD_NOT_AGENT',
      )
    })

    it('lets a VIEWER agent read but not write', async () => {
      asSdMember('VIEWER')
      repo.list.mockResolvedValue(ok({ items: [], total: 0 }))
      expectOk(await SdCustomerService.list('u1', 'ws1', listQuery))
      expectErr(
        await SdCustomerService.create('u1', 'ws1', create({})),
        'FORBIDDEN',
      )
      expectErr(
        await SdCustomerService.update('u1', 'ws1', 'c1', { name: 'x' }),
        'FORBIDDEN',
      )
      expect(repo.create).not.toHaveBeenCalled()
      expect(repo.update).not.toHaveBeenCalled()
    })

    it('requires DELETE permission to remove (MEMBER lacks it, ADMIN has it)', async () => {
      expectErr(await SdCustomerService.remove('u1', 'ws1', 'c1'), 'FORBIDDEN')

      asSdMember('ADMIN', { agent: false })
      repo.findById.mockResolvedValue(ok(createFakeSdCustomer({ id: 'c1' })))
      repo.softDelete.mockResolvedValue(ok(undefined))
      expectOk(await SdCustomerService.remove('u1', 'ws1', 'c1'))
      expect(repo.softDelete).toHaveBeenCalledWith('c1')
      expect(audit).toHaveBeenCalledWith(
        expect.objectContaining({ entity: 'sd_customer', action: 'delete' }),
      )
    })
  })

  describe('list()', () => {
    it('maps the page with counts', async () => {
      repo.list.mockResolvedValue(
        ok({
          items: [
            createFakeSdCustomer({
              id: 'c1',
              _count: { contacts: 2, configItems: 3 },
            }),
          ],
          total: 41,
        }),
      )
      const page = expectOk(
        await SdCustomerService.list('u1', 'ws1', {
          ...listQuery,
          page: 2,
          pageSize: 20,
        }),
      )
      expect(page).toMatchObject({ total: 41, page: 2, pageSize: 20 })
      expect(page.items[0]).toMatchObject({
        id: 'c1',
        contactsCount: 2,
        configItemsCount: 3,
      })
    })

    it('propagates repository errors', async () => {
      repo.list.mockResolvedValue(err(databaseError()))
      expectErr(
        await SdCustomerService.list('u1', 'ws1', listQuery),
        'DATABASE_ERROR',
      )
    })
  })

  describe('get()', () => {
    it('returns the detail with contacts and recent tickets', async () => {
      repo.findDetail.mockResolvedValue(
        ok(
          createFakeSdCustomerDetail({
            id: 'c1',
            contacts: [
              {
                contactId: 'p1',
                customerId: 'c1',
                isPrimary: true,
                contact: {
                  id: 'p1',
                  name: 'Ana',
                  jobTitle: 'TI',
                  email: null,
                  phone: null,
                  whatsapp: null,
                },
              },
            ],
          }),
        ),
      )
      repo.listRecentTickets.mockResolvedValue(
        ok([
          {
            id: 't1',
            number: 7,
            type: 'INCIDENT',
            title: 'Sem internet',
            createdAt: new Date('2026-09-01T12:00:00Z'),
            phase: { name: 'Novo', category: 'NEW' },
          },
        ]),
      )

      const detail = expectOk(await SdCustomerService.get('u1', 'ws1', 'c1'))
      expect(detail.contacts).toEqual([
        {
          id: 'p1',
          name: 'Ana',
          jobTitle: 'TI',
          email: null,
          phone: null,
          whatsapp: null,
          isPrimary: true,
        },
      ])
      expect(detail.recentTickets).toEqual([
        {
          id: 't1',
          number: 7,
          type: 'INCIDENT',
          title: 'Sem internet',
          phaseName: 'Novo',
          phaseCategory: 'NEW',
          createdAt: '2026-09-01T12:00:00.000Z',
        },
      ])
      expect(repo.listRecentTickets).toHaveBeenCalledWith('ws1', 'c1')
    })

    it('propagates not found and ticket query errors', async () => {
      repo.findDetail.mockResolvedValueOnce(err(sdCustomerNotFound()))
      expectErr(
        await SdCustomerService.get('u1', 'ws1', 'c1'),
        'SD_CUSTOMER_NOT_FOUND',
      )

      repo.findDetail.mockResolvedValueOnce(ok(createFakeSdCustomerDetail()))
      repo.listRecentTickets.mockResolvedValueOnce(err(databaseError()))
      expectErr(
        await SdCustomerService.get('u1', 'ws1', 'c1'),
        'DATABASE_ERROR',
      )
    })
  })

  describe('options()', () => {
    it('builds label/sublabel from trade name, formatted document and place', async () => {
      repo.options.mockResolvedValue(
        ok([
          {
            id: 'c1',
            kind: 'COMPANY',
            name: 'Acme Ltda',
            tradeName: 'Acme',
            document: '11222333000181',
            city: 'São Paulo',
            state: 'SP',
          },
          {
            id: 'c2',
            kind: 'CLIENT',
            name: 'João',
            tradeName: 'João',
            document: null,
            city: null,
            state: null,
          },
        ]),
      )
      const options = expectOk(
        await SdCustomerService.options('u1', 'ws1', {
          q: 'a',
          kind: 'COMPANY',
          limit: 10,
        }),
      )
      expect(options).toEqual([
        {
          id: 'c1',
          label: 'Acme Ltda',
          sublabel: 'Acme · 11.222.333/0001-81 · São Paulo/SP',
        },
        { id: 'c2', label: 'João', sublabel: null },
      ])
      expect(repo.options).toHaveBeenCalledWith('ws1', {
        q: 'a',
        kind: 'COMPANY',
        limit: 10,
      })
    })

    it('propagates repository errors', async () => {
      repo.options.mockResolvedValue(err(databaseError()))
      expectErr(
        await SdCustomerService.options('u1', 'ws1', { limit: 5 }),
        'DATABASE_ERROR',
      )
    })
  })

  describe('create()', () => {
    it('normalizes document/phones, infers person type and audits', async () => {
      repo.create.mockResolvedValue(ok(createFakeSdCustomer({ id: 'c1' })))
      const dto = expectOk(
        await SdCustomerService.create(
          'u1',
          'ws1',
          create({
            document: '529.982.247-25',
            phone: '(11) 3333-4444',
            whatsapp: '(11) 98765-4321',
          }),
        ),
      )
      expect(dto.id).toBe('c1')
      expect(repo.findByDocument).toHaveBeenCalledWith(
        'ws1',
        '52998224725',
        undefined,
      )
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: 'ws1',
          createdById: 'u1',
          kind: 'CLIENT',
          personType: 'INDIVIDUAL',
          document: '52998224725',
          phone: '551133334444',
          whatsapp: '5511987654321',
          customFields: {},
          country: 'BR',
        }),
      )
      expect(audit).toHaveBeenCalledWith(
        expect.objectContaining({
          entity: 'sd_customer',
          action: 'create',
          targetId: 'c1',
        }),
      )
    })

    it('defaults to LEGAL without document and keeps an explicit person type', async () => {
      repo.create.mockResolvedValue(ok(createFakeSdCustomer()))
      expectOk(await SdCustomerService.create('u1', 'ws1', create({})))
      expect(repo.create).toHaveBeenLastCalledWith(
        expect.objectContaining({ personType: 'LEGAL', document: undefined }),
      )
      expect(repo.findByDocument).not.toHaveBeenCalled()

      expectOk(
        await SdCustomerService.create(
          'u1',
          'ws1',
          create({ personType: 'INDIVIDUAL' }),
        ),
      )
      expect(repo.create).toHaveBeenLastCalledWith(
        expect.objectContaining({ personType: 'INDIVIDUAL' }),
      )
    })

    it.each([
      ['529.982.247-00', 'CPF inválido'],
      ['11.222.333/0001-00', 'CNPJ inválido'],
      ['123', 'Informe um CPF (11 dígitos) ou CNPJ (14 caracteres)'],
    ])('rejects the invalid document %s', async (document, message) => {
      const error = expectErr(
        await SdCustomerService.create('u1', 'ws1', create({ document })),
        'SD_DOCUMENT_INVALID',
      )
      expect(error.message).toBe(message)
      expect(repo.create).not.toHaveBeenCalled()
    })

    it.each([
      ['52998224725', 'LEGAL', 'CPF informado para pessoa jurídica'],
      ['11222333000181', 'INDIVIDUAL', 'CNPJ informado para pessoa física'],
    ] as const)('rejects %s for person type %s', async (document, personType, message) => {
      const error = expectErr(
        await SdCustomerService.create(
          'u1',
          'ws1',
          create({ document, personType }),
        ),
        'SD_DOCUMENT_INVALID',
      )
      expect(error.message).toBe(message)
    })

    it('accepts the alphanumeric CNPJ', async () => {
      repo.create.mockResolvedValue(ok(createFakeSdCustomer()))
      expectOk(
        await SdCustomerService.create(
          'u1',
          'ws1',
          create({ document: '12.abc.345/01de-35' }),
        ),
      )
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          document: '12ABC34501DE35',
          personType: 'LEGAL',
        }),
      )
    })

    it('returns SD_CUSTOMER_DOCUMENT_CONFLICT for a duplicated document', async () => {
      repo.findByDocument.mockResolvedValue(
        ok(createFakeSdCustomer({ name: 'Existente' })),
      )
      const error = expectErr(
        await SdCustomerService.create(
          'u1',
          'ws1',
          create({ document: '11222333000181' }),
        ),
        'SD_CUSTOMER_DOCUMENT_CONFLICT',
      )
      expect(error.message).toContain('Existente')
    })

    it('propagates the document lookup error', async () => {
      repo.findByDocument.mockResolvedValue(err(databaseError()))
      expectErr(
        await SdCustomerService.create(
          'u1',
          'ws1',
          create({ document: '11222333000181' }),
        ),
        'DATABASE_ERROR',
      )
    })

    it('audits the failure when the insert fails', async () => {
      repo.create.mockResolvedValue(err(databaseError()))
      expectErr(
        await SdCustomerService.create('u1', 'ws1', create({})),
        'DATABASE_ERROR',
      )
      expect(audit).toHaveBeenCalledWith(
        expect.objectContaining({
          outcome: 'failure',
          reason: 'DATABASE_ERROR',
        }),
      )
    })
  })

  describe('update()', () => {
    it('re-checks a changed document excluding itself and normalizes phones', async () => {
      repo.findById.mockResolvedValue(
        ok(createFakeSdCustomer({ id: 'c1', document: null })),
      )
      repo.update.mockResolvedValue(ok(createFakeSdCustomer({ id: 'c1' })))

      expectOk(
        await SdCustomerService.update('u1', 'ws1', 'c1', {
          document: '11.222.333/0001-81',
          whatsapp: null,
          phone: '11 3333-4444',
        }),
      )
      expect(repo.findByDocument).toHaveBeenCalledWith(
        'ws1',
        '11222333000181',
        'c1',
      )
      expect(repo.update).toHaveBeenCalledWith(
        'c1',
        expect.objectContaining({
          document: '11222333000181',
          personType: 'LEGAL',
          whatsapp: null,
          phone: '551133334444',
        }),
      )
      expect(audit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'update',
          meta: {
            workspaceId: 'ws1',
            fields: ['document', 'whatsapp', 'phone'],
          },
        }),
      )
    })

    it('keeps the stored document untouched and validates person type against it', async () => {
      repo.findById.mockResolvedValue(
        ok(createFakeSdCustomer({ id: 'c1', document: '52998224725' })),
      )
      repo.update.mockResolvedValue(ok(createFakeSdCustomer({ id: 'c1' })))

      expectOk(
        await SdCustomerService.update('u1', 'ws1', 'c1', { name: 'Novo' }),
      )
      expect(repo.findByDocument).not.toHaveBeenCalled()
      const data = repo.update.mock.calls[0][1]
      expect(data).not.toHaveProperty('document')
      expect(data).not.toHaveProperty('phone')

      expectErr(
        await SdCustomerService.update('u1', 'ws1', 'c1', {
          personType: 'LEGAL',
        }),
        'SD_DOCUMENT_INVALID',
      )
    })

    it('clears the document', async () => {
      repo.findById.mockResolvedValue(ok(createFakeSdCustomer({ id: 'c1' })))
      repo.update.mockResolvedValue(ok(createFakeSdCustomer({ id: 'c1' })))
      expectOk(
        await SdCustomerService.update('u1', 'ws1', 'c1', { document: null }),
      )
      expect(repo.update).toHaveBeenCalledWith(
        'c1',
        expect.objectContaining({ document: null }),
      )
      expect(repo.findByDocument).not.toHaveBeenCalled()
    })

    it('propagates not found, conflict and update errors', async () => {
      repo.findById.mockResolvedValueOnce(err(sdCustomerNotFound()))
      expectErr(
        await SdCustomerService.update('u1', 'ws1', 'c1', { name: 'x' }),
        'SD_CUSTOMER_NOT_FOUND',
      )

      repo.findById.mockResolvedValue(ok(createFakeSdCustomer({ id: 'c1' })))
      repo.findByDocument.mockResolvedValueOnce(ok(createFakeSdCustomer()))
      expectErr(
        await SdCustomerService.update('u1', 'ws1', 'c1', {
          document: '52998224725',
        }),
        'SD_CUSTOMER_DOCUMENT_CONFLICT',
      )

      expectErr(
        await SdCustomerService.update('u1', 'ws1', 'c1', { document: '1' }),
        'SD_DOCUMENT_INVALID',
      )

      repo.update.mockResolvedValueOnce(err(databaseError()))
      expectErr(
        await SdCustomerService.update('u1', 'ws1', 'c1', { name: 'x' }),
        'DATABASE_ERROR',
      )
    })
  })

  describe('remove()', () => {
    it('propagates not found and delete errors', async () => {
      asSdMember('OWNER')
      repo.findById.mockResolvedValueOnce(err(sdCustomerNotFound()))
      expectErr(
        await SdCustomerService.remove('u1', 'ws1', 'c1'),
        'SD_CUSTOMER_NOT_FOUND',
      )

      repo.findById.mockResolvedValue(ok(createFakeSdCustomer({ id: 'c1' })))
      repo.softDelete.mockResolvedValue(err(databaseError()))
      expectErr(
        await SdCustomerService.remove('u1', 'ws1', 'c1'),
        'DATABASE_ERROR',
      )
    })
  })

  describe('importRows()', () => {
    it('creates valid rows and reports rejected lines (header = line 1)', async () => {
      repo.create.mockResolvedValue(ok(createFakeSdCustomer()))
      repo.findByDocument
        .mockResolvedValueOnce(ok(null))
        .mockResolvedValueOnce(ok(createFakeSdCustomer({ name: 'Dup' })))

      const result = expectOk(
        await SdCustomerService.importRows('u1', 'ws1', {
          kind: 'COMPANY',
          rows: [
            { razao_social: 'Acme', cnpj: '11.222.333/0001-81', uf: 'sp' },
            { nome: '' },
            { nome: 'Doc ruim', cnpj: '123' },
            { nome: 'Duplicada', cnpj: '52998224725' },
            { nome: 'Sem doc', email: 'x@y.com' },
          ],
        }),
      )
      expect(result.created).toBe(2)
      expect(result.rejected).toEqual([
        { line: 3, message: 'name: Nome é obrigatório' },
        {
          line: 4,
          message: 'Informe um CPF (11 dígitos) ou CNPJ (14 caracteres)',
        },
        {
          line: 5,
          message: 'Já existe um cadastro com este CPF/CNPJ: Dup',
        },
      ])
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: 'COMPANY',
          name: 'Acme',
          document: '11222333000181',
          state: 'SP',
        }),
      )
      expect(audit).toHaveBeenCalledWith(
        expect.objectContaining({
          entity: 'sd_customer',
          meta: { workspaceId: 'ws1', import: true, created: 2, rejected: 3 },
        }),
      )
    })

    it('reports a failed insert and a row-level validation issue without path', async () => {
      repo.create.mockResolvedValue(err(databaseError('falhou')))
      const result = expectOk(
        await SdCustomerService.importRows('u1', 'ws1', {
          kind: 'CLIENT',
          rows: [{ nome: 'A' }],
        }),
      )
      expect(result).toEqual({
        created: 0,
        rejected: [{ line: 2, message: 'falhou' }],
      })
    })

    it('requires CREATE permission', async () => {
      asSdMember('VIEWER')
      expectErr(
        await SdCustomerService.importRows('u1', 'ws1', {
          kind: 'CLIENT',
          rows: [{ nome: 'A' }],
        }),
        'FORBIDDEN',
      )
    })
  })
})
