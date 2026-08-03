import { describe, expect, it } from 'vitest'
import { seedUser } from '@/src/__tests__/factories/user.factory'
import { seedWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { expectOk } from '@/src/__tests__/helpers/result.helpers'
import { prisma } from '@/src/lib/prisma'
import { WhatsAppBroadcastRepository } from '../whatsapp-broadcast.repository'

let counter = 0
function suffix() {
  counter += 1
  return counter
}

async function seedFixtures() {
  const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
  const connection = await prisma.whatsAppConnection.create({
    data: {
      workspaceId: workspace.id,
      provider: 'META',
      label: 'Principal',
      phoneNumber: `55119999${suffix()}`,
      metaPhoneNumberId: `phone-${suffix()}`,
      metaWabaId: `waba-${suffix()}`,
      encryptedMetaAccessToken: 'enc:token',
      createdById: user.id,
    },
  })
  const template = await prisma.whatsAppTemplate.create({
    data: {
      workspaceId: workspace.id,
      connectionId: connection.id,
      name: `lembrete-${suffix()}`,
      language: 'pt_BR',
      category: 'UTILITY',
      status: 'APPROVED',
      components: [{ type: 'BODY', text: 'Olá {{1}}, seu horário é {{2}}' }],
    },
  })
  const contact = await prisma.whatsAppContact.create({
    data: { workspaceId: workspace.id, waId: `5511988887${suffix()}` },
  })
  return { workspace, user, connection, template, contact }
}

describe('WhatsAppBroadcastRepository', () => {
  describe('createScheduled()', () => {
    it('should create a QUEUED list with per-recipient variables and scheduledAt', async () => {
      const { workspace, connection, template, contact, user } =
        await seedFixtures()
      const scheduledAt = new Date('2026-08-14T09:00:00.000Z')

      const created = expectOk(
        await WhatsAppBroadcastRepository.createScheduled(
          {
            workspaceId: workspace.id,
            connectionId: connection.id,
            templateId: template.id,
            name: 'Lembrete de consulta',
            messageBody: template.name,
            createdById: user.id,
          },
          [
            {
              contactId: contact.id,
              variableValues: { body: { '1': 'Maria', '2': '15/08 às 09h' } },
              scheduledAt,
              appointmentAt: new Date('2026-08-15T09:00:00.000Z'),
            },
          ],
        ),
      )

      expect(created.status).toBe('QUEUED')
      expect(created.recipients).toHaveLength(1)
      expect(created.recipients[0].variableValues).toEqual({
        body: { '1': 'Maria', '2': '15/08 às 09h' },
      })
      expect(created.recipients[0].scheduledAt?.toISOString()).toBe(
        scheduledAt.toISOString(),
      )
    })
  })

  describe('listDueScheduledRecipients()', () => {
    it('should return only PENDING recipients past their scheduledAt in a QUEUED list', async () => {
      const { workspace, connection, template, contact, user } =
        await seedFixtures()
      const past = new Date(Date.now() - 60_000)
      const future = new Date(Date.now() + 60 * 60_000)

      const list = expectOk(
        await WhatsAppBroadcastRepository.createScheduled(
          {
            workspaceId: workspace.id,
            connectionId: connection.id,
            templateId: template.id,
            name: 'Lembretes',
            messageBody: template.name,
            createdById: user.id,
          },
          [
            {
              contactId: contact.id,
              variableValues: { body: { '1': 'Maria', '2': 'agora' } },
              scheduledAt: past,
              appointmentAt: future,
            },
          ],
        ),
      )

      // segundo contato, agendado no futuro — não deve aparecer no tick
      const futureContact = await prisma.whatsAppContact.create({
        data: { workspaceId: workspace.id, waId: `5511977776${suffix()}` },
      })
      await prisma.whatsAppBroadcastRecipient.create({
        data: {
          broadcastListId: list.id,
          contactId: futureContact.id,
          variableValues: { body: { '1': 'João', '2': 'depois' } },
          scheduledAt: future,
        },
      })

      const due = expectOk(
        await WhatsAppBroadcastRepository.listDueScheduledRecipients(
          new Date(),
        ),
      )

      expect(due).toHaveLength(1)
      expect(due[0].contact.waId).toBe(contact.waId)
      expect(due[0].broadcastList.id).toBe(list.id)
    })

    it('should not return recipients from a DRAFT (non-QUEUED) list', async () => {
      const { workspace, connection, template, contact, user } =
        await seedFixtures()
      const list = await prisma.whatsAppBroadcastList.create({
        data: {
          workspaceId: workspace.id,
          connectionId: connection.id,
          templateId: template.id,
          name: 'Rascunho',
          messageBody: template.name,
          status: 'DRAFT',
          createdById: user.id,
        },
      })
      await prisma.whatsAppBroadcastRecipient.create({
        data: {
          broadcastListId: list.id,
          contactId: contact.id,
          scheduledAt: new Date(Date.now() - 60_000),
        },
      })

      const due = expectOk(
        await WhatsAppBroadcastRepository.listDueScheduledRecipients(
          new Date(),
        ),
      )

      expect(due).toEqual([])
    })
  })

  describe('findUpcomingAppointmentByContact()', () => {
    it('should return the soonest future appointment for the contact', async () => {
      const { workspace, connection, template, contact, user } =
        await seedFixtures()
      const list = await prisma.whatsAppBroadcastList.create({
        data: {
          workspaceId: workspace.id,
          connectionId: connection.id,
          templateId: template.id,
          name: 'Confirmação de exames',
          messageBody: template.name,
          status: 'QUEUED',
          createdById: user.id,
        },
      })
      const soon = new Date(Date.now() + 24 * 60 * 60_000)
      const later = new Date(Date.now() + 72 * 60 * 60_000)
      await prisma.whatsAppBroadcastRecipient.createMany({
        data: [
          {
            broadcastListId: list.id,
            contactId: contact.id,
            appointmentAt: later,
          },
        ],
      })
      const secondList = await prisma.whatsAppBroadcastList.create({
        data: {
          workspaceId: workspace.id,
          connectionId: connection.id,
          templateId: template.id,
          name: 'Confirmação de exames 2',
          messageBody: template.name,
          status: 'QUEUED',
          createdById: user.id,
        },
      })
      await prisma.whatsAppBroadcastRecipient.create({
        data: {
          broadcastListId: secondList.id,
          contactId: contact.id,
          appointmentAt: soon,
        },
      })

      const result = expectOk(
        await WhatsAppBroadcastRepository.findUpcomingAppointmentByContact(
          contact.id,
        ),
      )

      expect(result?.appointmentAt?.toISOString()).toBe(soon.toISOString())
      expect(result?.broadcastList.name).toBe('Confirmação de exames 2')
    })

    it('should ignore past appointments', async () => {
      const { workspace, connection, template, contact, user } =
        await seedFixtures()
      const list = await prisma.whatsAppBroadcastList.create({
        data: {
          workspaceId: workspace.id,
          connectionId: connection.id,
          templateId: template.id,
          name: 'Confirmação de exames',
          messageBody: template.name,
          status: 'QUEUED',
          createdById: user.id,
        },
      })
      await prisma.whatsAppBroadcastRecipient.create({
        data: {
          broadcastListId: list.id,
          contactId: contact.id,
          appointmentAt: new Date(Date.now() - 60_000),
        },
      })

      const result = expectOk(
        await WhatsAppBroadcastRepository.findUpcomingAppointmentByContact(
          contact.id,
        ),
      )

      expect(result).toBeNull()
    })

    it('should return null when the contact has no appointment at all', async () => {
      const { contact } = await seedFixtures()

      const result = expectOk(
        await WhatsAppBroadcastRepository.findUpcomingAppointmentByContact(
          contact.id,
        ),
      )

      expect(result).toBeNull()
    })
  })
})
