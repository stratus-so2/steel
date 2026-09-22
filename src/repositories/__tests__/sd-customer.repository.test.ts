import { afterEach, describe, expect, it, vi } from 'vitest'
import { seedSdCustomer } from '@/src/__tests__/factories/sd-customer.factory'
import { seedUser } from '@/src/__tests__/factories/user.factory'
import { seedWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { prisma } from '@/src/lib/prisma'
import { ListSdCustomersSchema } from '@/src/schemas/sd-customer.schema'
import { SdCustomerRepository } from '../sd-customer.repository'

const list = (input: Record<string, unknown> = {}) =>
  ListSdCustomersSchema.parse(input)

async function setup() {
  const [workspace, other, user] = await Promise.all([
    seedWorkspace(),
    seedWorkspace(),
    seedUser(),
  ])
  return { workspace, other, user }
}

describe('SdCustomerRepository', () => {
  describe('list()', () => {
    it('scopes to the workspace, hides soft-deleted and filters by kind/active/state/city', async () => {
      const { workspace, other, user } = await setup()
      const a = await seedSdCustomer(workspace.id, user.id, {
        name: 'Alfa',
        kind: 'CLIENT',
        state: 'SP',
        city: 'São Paulo',
      })
      await seedSdCustomer(workspace.id, user.id, {
        name: 'Beta',
        kind: 'COMPANY',
        state: 'RJ',
      })
      await seedSdCustomer(workspace.id, user.id, {
        name: 'Gama',
        kind: 'CLIENT',
        active: false,
      })
      await seedSdCustomer(workspace.id, user.id, {
        name: 'Excluído',
        deletedAt: new Date(),
      })
      await seedSdCustomer(other.id, user.id, { name: 'Outra' })

      const all = expectOk(
        await SdCustomerRepository.list(workspace.id, list()),
      )
      expect(all.total).toBe(3)
      expect(all.items.map((c) => c.name)).toEqual(['Alfa', 'Beta', 'Gama'])

      const clients = expectOk(
        await SdCustomerRepository.list(
          workspace.id,
          list({ kind: 'CLIENT', active: 'true' }),
        ),
      )
      expect(clients.items.map((c) => c.id)).toEqual([a.id])

      const byPlace = expectOk(
        await SdCustomerRepository.list(
          workspace.id,
          list({ state: 'sp', city: 'são paulo' }),
        ),
      )
      expect(byPlace.items.map((c) => c.id)).toEqual([a.id])
    })

    it('searches name/tradeName/document/email/city, including a masked document', async () => {
      const { workspace, user } = await setup()
      const acme = await seedSdCustomer(workspace.id, user.id, {
        name: 'Acme Ltda',
        document: '11222333000181',
      })
      const bob = await seedSdCustomer(workspace.id, user.id, {
        name: 'Roberto',
        tradeName: 'Bob Serviços',
        email: 'bob@example.com',
        city: 'Campinas',
      })

      const search = async (q: string) =>
        expectOk(
          await SdCustomerRepository.list(workspace.id, list({ q })),
        ).items.map((c) => c.id)

      expect(await search('acme')).toEqual([acme.id])
      expect(await search('bob serv')).toEqual([bob.id])
      expect(await search('EXAMPLE.COM')).toEqual([bob.id])
      expect(await search('campinas')).toEqual([bob.id])
      expect(await search('11.222.333/0001-81')).toEqual([acme.id])
      expect(await search('112223')).toEqual([acme.id])
    })

    it('paginates and sorts, with counts of live contacts and CIs', async () => {
      const { workspace, user } = await setup()
      const first = await seedSdCustomer(workspace.id, user.id, { name: 'A' })
      await seedSdCustomer(workspace.id, user.id, { name: 'B' })
      await seedSdCustomer(workspace.id, user.id, { name: 'C' })

      const live = await prisma.sdContact.create({
        data: { workspaceId: workspace.id, createdById: user.id, name: 'Viva' },
      })
      const dead = await prisma.sdContact.create({
        data: {
          workspaceId: workspace.id,
          createdById: user.id,
          name: 'Morta',
          deletedAt: new Date(),
        },
      })
      await prisma.sdContactCustomer.createMany({
        data: [
          { contactId: live.id, customerId: first.id },
          { contactId: dead.id, customerId: first.id },
        ],
      })
      await prisma.sdConfigItem.createMany({
        data: [
          {
            workspaceId: workspace.id,
            createdById: user.id,
            name: 'Servidor',
            customerId: first.id,
          },
          {
            workspaceId: workspace.id,
            createdById: user.id,
            name: 'Velho',
            customerId: first.id,
            deletedAt: new Date(),
          },
        ],
      })

      const page2 = expectOk(
        await SdCustomerRepository.list(
          workspace.id,
          list({ page: 2, pageSize: 2, sort: 'name', order: 'desc' }),
        ),
      )
      expect(page2.total).toBe(3)
      expect(page2.items.map((c) => c.name)).toEqual(['A'])
      expect(page2.items[0]._count).toEqual({ contacts: 1, configItems: 1 })
    })
  })

  describe('findById() / findDetail()', () => {
    it('returns SD_CUSTOMER_NOT_FOUND across workspaces or when deleted', async () => {
      const { workspace, other, user } = await setup()
      const c = await seedSdCustomer(workspace.id, user.id)
      const gone = await seedSdCustomer(workspace.id, user.id, {
        deletedAt: new Date(),
      })

      expect(
        expectOk(await SdCustomerRepository.findById(c.id, workspace.id)).id,
      ).toBe(c.id)
      expectErr(
        await SdCustomerRepository.findById(c.id, other.id),
        'SD_CUSTOMER_NOT_FOUND',
      )
      expectErr(
        await SdCustomerRepository.findById(gone.id, workspace.id),
        'SD_CUSTOMER_NOT_FOUND',
      )
      expectErr(
        await SdCustomerRepository.findDetail(c.id, other.id),
        'SD_CUSTOMER_NOT_FOUND',
      )
    })

    it('includes live contacts, primary first', async () => {
      const { workspace, user } = await setup()
      const c = await seedSdCustomer(workspace.id, user.id)
      const [zeca, ana, gone] = await Promise.all(
        ['Zeca', 'Ana', 'Removida'].map((name) =>
          prisma.sdContact.create({
            data: {
              workspaceId: workspace.id,
              createdById: user.id,
              name,
              deletedAt: name === 'Removida' ? new Date() : null,
            },
          }),
        ),
      )
      await prisma.sdContactCustomer.createMany({
        data: [
          { contactId: ana.id, customerId: c.id },
          { contactId: zeca.id, customerId: c.id, isPrimary: true },
          { contactId: gone.id, customerId: c.id },
        ],
      })

      const detail = expectOk(
        await SdCustomerRepository.findDetail(c.id, workspace.id),
      )
      expect(detail.contacts.map((l) => l.contact.name)).toEqual([
        'Zeca',
        'Ana',
      ])
      expect(detail._count.contacts).toBe(2)
    })
  })

  describe('listRecentTickets()', () => {
    it('returns the last tickets as customer or company, newest first, max N', async () => {
      const { workspace, user } = await setup()
      const c = await seedSdCustomer(workspace.id, user.id)
      const phase = await prisma.sdPhase.create({
        data: {
          workspaceId: workspace.id,
          ticketType: 'INCIDENT',
          name: 'Novo',
          category: 'NEW',
        },
      })
      const base = {
        workspaceId: workspace.id,
        type: 'INCIDENT' as const,
        phaseId: phase.id,
      }
      await prisma.sdTicket.createMany({
        data: [
          {
            ...base,
            number: 1,
            title: 'Cliente',
            customerId: c.id,
            createdAt: new Date('2026-01-01'),
          },
          {
            ...base,
            number: 2,
            title: 'Empresa',
            companyId: c.id,
            createdAt: new Date('2026-01-02'),
          },
          { ...base, number: 3, title: 'Outro' },
          {
            ...base,
            number: 4,
            title: 'Excluído',
            customerId: c.id,
            deletedAt: new Date(),
          },
        ],
      })

      const tickets = expectOk(
        await SdCustomerRepository.listRecentTickets(workspace.id, c.id),
      )
      expect(tickets.map((t) => t.title)).toEqual(['Empresa', 'Cliente'])
      expect(tickets[0].phase).toEqual({ name: 'Novo', category: 'NEW' })

      const limited = expectOk(
        await SdCustomerRepository.listRecentTickets(workspace.id, c.id, 1),
      )
      expect(limited).toHaveLength(1)
    })
  })

  describe('findByDocument() / findExistingIds()', () => {
    it('finds live customers by document, optionally excluding one id', async () => {
      const { workspace, user } = await setup()
      const c = await seedSdCustomer(workspace.id, user.id, {
        document: '11222333000181',
      })
      await seedSdCustomer(workspace.id, user.id, {
        document: '52998224725',
        deletedAt: new Date(),
      })

      expect(
        expectOk(
          await SdCustomerRepository.findByDocument(
            workspace.id,
            '11222333000181',
          ),
        )?.id,
      ).toBe(c.id)
      expect(
        expectOk(
          await SdCustomerRepository.findByDocument(
            workspace.id,
            '11222333000181',
            c.id,
          ),
        ),
      ).toBeNull()
      expect(
        expectOk(
          await SdCustomerRepository.findByDocument(
            workspace.id,
            '52998224725',
          ),
        ),
      ).toBeNull()
    })

    it('returns only ids that exist in the workspace', async () => {
      const { workspace, other, user } = await setup()
      const mine = await seedSdCustomer(workspace.id, user.id)
      const theirs = await seedSdCustomer(other.id, user.id)

      expect(
        expectOk(
          await SdCustomerRepository.findExistingIds(workspace.id, [
            mine.id,
            theirs.id,
            'missing',
          ]),
        ),
      ).toEqual([mine.id])
      expect(
        expectOk(await SdCustomerRepository.findExistingIds(workspace.id, [])),
      ).toEqual([])
    })
  })

  describe('options()', () => {
    it('lists active customers by kind and search, limited', async () => {
      const { workspace, user } = await setup()
      const a = await seedSdCustomer(workspace.id, user.id, {
        name: 'Alfa',
        kind: 'COMPANY',
      })
      await seedSdCustomer(workspace.id, user.id, { name: 'Alfa Cliente' })
      await seedSdCustomer(workspace.id, user.id, {
        name: 'Alfa Inativa',
        kind: 'COMPANY',
        active: false,
      })

      const rows = expectOk(
        await SdCustomerRepository.options(workspace.id, {
          q: 'alfa',
          kind: 'COMPANY',
          limit: 10,
        }),
      )
      expect(rows.map((r) => r.id)).toEqual([a.id])

      const limited = expectOk(
        await SdCustomerRepository.options(workspace.id, { limit: 1 }),
      )
      expect(limited).toHaveLength(1)
    })
  })

  describe('create() / update() / softDelete()', () => {
    it('creates, updates and soft-deletes', async () => {
      const { workspace, user } = await setup()
      const created = expectOk(
        await SdCustomerRepository.create({
          workspaceId: workspace.id,
          createdById: user.id,
          name: 'Nova',
          customFields: { segmento: 'varejo' },
        }),
      )
      expect(created._count).toEqual({ contacts: 0, configItems: 0 })
      expect(created.customFields).toEqual({ segmento: 'varejo' })

      const updated = expectOk(
        await SdCustomerRepository.update(created.id, { name: 'Renomeada' }),
      )
      expect(updated.name).toBe('Renomeada')

      expectOk(await SdCustomerRepository.softDelete(created.id))
      expectErr(
        await SdCustomerRepository.findById(created.id, workspace.id),
        'SD_CUSTOMER_NOT_FOUND',
      )
    })

    it('returns DATABASE_ERROR on invalid writes and reads', async () => {
      const user = await seedUser()
      expectErr(
        await SdCustomerRepository.create({
          workspaceId: 'missing',
          createdById: user.id,
          name: 'X',
        }),
        'DATABASE_ERROR',
      )
      expectErr(
        await SdCustomerRepository.update('missing', { name: 'X' }),
        'DATABASE_ERROR',
      )
      expectErr(
        await SdCustomerRepository.softDelete('missing'),
        'DATABASE_ERROR',
      )
      expectErr(
        await SdCustomerRepository.list(
          'ws',
          // Coluna de ordenação inexistente força erro do Prisma.
          { ...list(), sort: 'nope' as never },
        ),
        'DATABASE_ERROR',
      )
    })
  })

  describe('read failures', () => {
    afterEach(() => vi.restoreAllMocks())

    it('maps Prisma read errors to DATABASE_ERROR', async () => {
      const boom = () => Promise.reject(new Error('boom'))
      vi.spyOn(prisma.sdCustomer, 'findFirst').mockImplementation(boom as never)
      vi.spyOn(prisma.sdCustomer, 'findMany').mockImplementation(boom as never)
      vi.spyOn(prisma.sdTicket, 'findMany').mockImplementation(boom as never)

      expectErr(
        await SdCustomerRepository.findById('x', 'ws'),
        'DATABASE_ERROR',
      )
      expectErr(
        await SdCustomerRepository.findDetail('x', 'ws'),
        'DATABASE_ERROR',
      )
      expectErr(
        await SdCustomerRepository.findByDocument('ws', '52998224725'),
        'DATABASE_ERROR',
      )
      expectErr(
        await SdCustomerRepository.findExistingIds('ws', ['x']),
        'DATABASE_ERROR',
      )
      expectErr(
        await SdCustomerRepository.options('ws', { limit: 5 }),
        'DATABASE_ERROR',
      )
      expectErr(
        await SdCustomerRepository.listRecentTickets('ws', 'x'),
        'DATABASE_ERROR',
      )
    })
  })
})
