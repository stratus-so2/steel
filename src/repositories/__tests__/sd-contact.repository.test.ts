import { afterEach, describe, expect, it, vi } from 'vitest'
import { seedSdContact } from '@/src/__tests__/factories/sd-contact.factory'
import { seedSdCustomer } from '@/src/__tests__/factories/sd-customer.factory'
import { seedUser } from '@/src/__tests__/factories/user.factory'
import { seedWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { prisma } from '@/src/lib/prisma'
import { ListSdContactsSchema } from '@/src/schemas/sd-contact.schema'
import { SdContactRepository } from '../sd-contact.repository'

const list = (input: Record<string, unknown> = {}) =>
  ListSdContactsSchema.parse(input)

async function setup() {
  const [workspace, other, user] = await Promise.all([
    seedWorkspace(),
    seedWorkspace(),
    seedUser(),
  ])
  return { workspace, other, user }
}

describe('SdContactRepository', () => {
  describe('list()', () => {
    it('scopes, hides deleted, filters by customer/active and searches phones by digits', async () => {
      const { workspace, other, user } = await setup()
      const acme = await seedSdCustomer(workspace.id, user.id, { name: 'Acme' })
      const ana = await seedSdContact(
        workspace.id,
        user.id,
        { name: 'Ana', whatsapp: '5511987654321', jobTitle: 'Gerente' },
        [acme.id],
      )
      const bia = await seedSdContact(workspace.id, user.id, {
        name: 'Bia',
        email: 'bia@example.com',
        active: false,
      })
      await seedSdContact(workspace.id, user.id, {
        name: 'Removida',
        deletedAt: new Date(),
      })
      await seedSdContact(other.id, user.id, { name: 'Outra' })

      const all = expectOk(await SdContactRepository.list(workspace.id, list()))
      expect(all.total).toBe(2)
      expect(all.items.map((c) => c.id)).toEqual([ana.id, bia.id])
      expect(all.items[0].customers).toEqual([
        {
          contactId: ana.id,
          customerId: acme.id,
          isPrimary: true,
          customer: { id: acme.id, name: 'Acme', kind: 'CLIENT' },
        },
      ])

      const ids = async (input: Record<string, unknown>) =>
        expectOk(
          await SdContactRepository.list(workspace.id, list(input)),
        ).items.map((c) => c.id)

      expect(await ids({ customerId: acme.id })).toEqual([ana.id])
      expect(await ids({ active: 'false' })).toEqual([bia.id])
      expect(await ids({ q: '(11) 98765' })).toEqual([ana.id])
      expect(await ids({ q: 'gerente' })).toEqual([ana.id])
      expect(await ids({ q: 'EXAMPLE' })).toEqual([bia.id])
      expect(
        await ids({ page: 2, pageSize: 1, sort: 'name', order: 'asc' }),
      ).toEqual([bia.id])
    })

    it('hides links to soft-deleted customers', async () => {
      const { workspace, user } = await setup()
      const gone = await seedSdCustomer(workspace.id, user.id, {
        deletedAt: new Date(),
      })
      const c = await seedSdContact(workspace.id, user.id, {}, [gone.id])
      const row = expectOk(
        await SdContactRepository.findById(c.id, workspace.id),
      )
      expect(row.customers).toEqual([])
    })
  })

  describe('findById()', () => {
    it('returns SD_CONTACT_NOT_FOUND across workspaces', async () => {
      const { workspace, other, user } = await setup()
      const c = await seedSdContact(workspace.id, user.id, { userId: user.id })
      const row = expectOk(
        await SdContactRepository.findById(c.id, workspace.id),
      )
      expect(row.user?.id).toBe(user.id)
      expectErr(
        await SdContactRepository.findById(c.id, other.id),
        'SD_CONTACT_NOT_FOUND',
      )
    })
  })

  describe('listRecentTickets()', () => {
    it('returns the contact tickets newest first', async () => {
      const { workspace, user } = await setup()
      const c = await seedSdContact(workspace.id, user.id)
      const phase = await prisma.sdPhase.create({
        data: {
          workspaceId: workspace.id,
          ticketType: 'SERVICE_REQUEST',
          name: 'Aberto',
          category: 'NEW',
        },
      })
      await prisma.sdTicket.createMany({
        data: [1, 2, 3].map((n) => ({
          workspaceId: workspace.id,
          number: n,
          type: 'SERVICE_REQUEST' as const,
          title: `T${n}`,
          phaseId: phase.id,
          contactId: n === 3 ? null : c.id,
          createdAt: new Date(2026, 0, n),
        })),
      })
      const tickets = expectOk(
        await SdContactRepository.listRecentTickets(workspace.id, c.id),
      )
      expect(tickets.map((t) => t.title)).toEqual(['T2', 'T1'])
    })
  })

  describe('findByChannel()', () => {
    it('matches active contacts by whatsapp/phone candidates or email', async () => {
      const { workspace, user } = await setup()
      const byWa = await seedSdContact(workspace.id, user.id, {
        whatsapp: '5511987654321',
      })
      const byPhone = await seedSdContact(workspace.id, user.id, {
        phone: '551133334444',
      })
      const byMail = await seedSdContact(workspace.id, user.id, {
        email: 'Ana@Acme.com',
      })
      await seedSdContact(workspace.id, user.id, {
        whatsapp: '5521999999999',
        active: false,
      })

      const find = async (channel: { whatsapp: string[]; email?: string }) =>
        expectOk(await SdContactRepository.findByChannel(workspace.id, channel))
          ?.id ?? null

      expect(await find({ whatsapp: ['551187654321', '5511987654321'] })).toBe(
        byWa.id,
      )
      expect(await find({ whatsapp: ['551133334444'] })).toBe(byPhone.id)
      expect(await find({ whatsapp: [], email: 'ana@acme.com' })).toBe(
        byMail.id,
      )
      expect(await find({ whatsapp: ['5521999999999'] })).toBeNull()
      expect(await find({ whatsapp: [] })).toBeNull()
    })
  })

  describe('options()', () => {
    it('returns active contacts with their primary customer, filtered by customer', async () => {
      const { workspace, user } = await setup()
      const acme = await seedSdCustomer(workspace.id, user.id, { name: 'Acme' })
      const ana = await seedSdContact(workspace.id, user.id, { name: 'Ana' }, [
        acme.id,
      ])
      await seedSdContact(workspace.id, user.id, { name: 'Bia' })
      await seedSdContact(
        workspace.id,
        user.id,
        { name: 'Ana Inativa', active: false },
        [acme.id],
      )

      const rows = expectOk(
        await SdContactRepository.options(workspace.id, {
          q: 'ana',
          customerId: acme.id,
          limit: 10,
        }),
      )
      expect(rows.map((r) => r.id)).toEqual([ana.id])
      expect(rows[0].customers).toEqual([{ customer: { name: 'Acme' } }])
    })
  })

  describe('listMemberOptions()', () => {
    it('lists workspace members filtered by name/email', async () => {
      const { workspace, other, user } = await setup()
      const bob = await seedUser({ name: 'Bob Agente' })
      await prisma.membership.createMany({
        data: [
          { workspaceId: workspace.id, userId: user.id, role: 'OWNER' },
          { workspaceId: workspace.id, userId: bob.id, role: 'MEMBER' },
          { workspaceId: other.id, userId: user.id, role: 'OWNER' },
        ],
      })
      const all = expectOk(
        await SdContactRepository.listMemberOptions(workspace.id, {
          limit: 10,
        }),
      )
      expect(all.map((u) => u.id).sort()).toEqual([bob.id, user.id].sort())
      const filtered = expectOk(
        // With a space: seeded e-mails carry a random cuid, which once
        // contained "bob" and matched the other member too.
        await SdContactRepository.listMemberOptions(workspace.id, {
          q: 'bob agente',
          limit: 10,
        }),
      )
      expect(filtered).toEqual([
        { id: bob.id, name: 'Bob Agente', email: bob.email, image: bob.image },
      ])
    })
  })

  describe('isWorkspaceMember()', () => {
    it('checks the membership', async () => {
      const { workspace, user } = await setup()
      expect(
        expectOk(
          await SdContactRepository.isWorkspaceMember(workspace.id, user.id),
        ),
      ).toBe(false)
      await prisma.membership.create({
        data: { workspaceId: workspace.id, userId: user.id, role: 'MEMBER' },
      })
      expect(
        expectOk(
          await SdContactRepository.isWorkspaceMember(workspace.id, user.id),
        ),
      ).toBe(true)
    })
  })

  describe('create() / update() / softDelete()', () => {
    it('creates with links, replaces links on update and soft-deletes', async () => {
      const { workspace, user } = await setup()
      const [a, b] = await Promise.all([
        seedSdCustomer(workspace.id, user.id, { name: 'A' }),
        seedSdCustomer(workspace.id, user.id, { name: 'B' }),
      ])
      const created = expectOk(
        await SdContactRepository.create(
          { workspaceId: workspace.id, createdById: user.id, name: 'Nova' },
          [{ customerId: a.id, isPrimary: true }],
        ),
      )
      expect(created.customers.map((l) => l.customerId)).toEqual([a.id])

      const kept = expectOk(
        await SdContactRepository.update(created.id, { jobTitle: 'TI' }),
      )
      expect(kept.customers.map((l) => l.customerId)).toEqual([a.id])

      const replaced = expectOk(
        await SdContactRepository.update(created.id, {}, [
          { customerId: b.id, isPrimary: true },
        ]),
      )
      expect(replaced.customers.map((l) => l.customerId)).toEqual([b.id])

      expectOk(await SdContactRepository.softDelete(created.id))
      expectErr(
        await SdContactRepository.findById(created.id, workspace.id),
        'SD_CONTACT_NOT_FOUND',
      )
    })

    it('returns DATABASE_ERROR on invalid writes', async () => {
      const user = await seedUser()
      expectErr(
        await SdContactRepository.create(
          { workspaceId: 'missing', createdById: user.id, name: 'X' },
          [],
        ),
        'DATABASE_ERROR',
      )
      expectErr(
        await SdContactRepository.update('missing', { name: 'X' }),
        'DATABASE_ERROR',
      )
      expectErr(
        await SdContactRepository.softDelete('missing'),
        'DATABASE_ERROR',
      )
      expectErr(
        await SdContactRepository.list('ws', {
          ...list(),
          sort: 'nope' as never,
        }),
        'DATABASE_ERROR',
      )
    })
  })

  describe('read failures', () => {
    afterEach(() => vi.restoreAllMocks())

    it('maps Prisma read errors to DATABASE_ERROR', async () => {
      const boom = () => Promise.reject(new Error('boom'))
      vi.spyOn(prisma.sdContact, 'findFirst').mockImplementation(boom as never)
      vi.spyOn(prisma.sdContact, 'findMany').mockImplementation(boom as never)
      vi.spyOn(prisma.sdTicket, 'findMany').mockImplementation(boom as never)
      vi.spyOn(prisma.membership, 'findFirst').mockImplementation(boom as never)
      vi.spyOn(prisma.membership, 'findMany').mockImplementation(boom as never)
      expectErr(
        await SdContactRepository.listMemberOptions('ws', { limit: 1 }),
        'DATABASE_ERROR',
      )

      expectErr(await SdContactRepository.findById('x', 'ws'), 'DATABASE_ERROR')
      expectErr(
        await SdContactRepository.listRecentTickets('ws', 'x'),
        'DATABASE_ERROR',
      )
      expectErr(
        await SdContactRepository.findByChannel('ws', {
          whatsapp: ['1'],
          email: 'a@b.c',
        }),
        'DATABASE_ERROR',
      )
      expectErr(
        await SdContactRepository.options('ws', { limit: 1 }),
        'DATABASE_ERROR',
      )
      expectErr(
        await SdContactRepository.isWorkspaceMember('ws', 'u'),
        'DATABASE_ERROR',
      )
    })
  })
})
