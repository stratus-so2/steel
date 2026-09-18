import { describe, expect, it, vi } from 'vitest'
import { seedUser } from '@/src/__tests__/factories/user.factory'
import { seedWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { prisma } from '@/src/lib/prisma'
import { WhatsAppTemplateRepository } from '../whatsapp-template.repository'

let counter = 0

async function seedConnection() {
  const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
  counter += 1
  const connection = await prisma.whatsAppConnection.create({
    data: {
      workspaceId: workspace.id,
      provider: 'META',
      label: 'Meta',
      phoneNumber: '5511999999999',
      metaPhoneNumberId: `phone-${counter}`,
      createdById: user.id,
    },
  })
  return { workspace, connection }
}

function syncInput(
  workspaceId: string,
  connectionId: string,
  overrides: Partial<{
    name: string
    language: string
    status: 'APPROVED' | 'PENDING' | 'REJECTED'
    category: string
  }> = {},
) {
  return {
    workspaceId,
    connectionId,
    name: 'boas_vindas',
    language: 'pt_BR',
    category: 'MARKETING',
    status: 'PENDING' as const,
    components: [{ type: 'BODY', text: 'Olá!' }],
    ...overrides,
  }
}

describe('WhatsAppTemplateRepository', () => {
  describe('upsertSynced()', () => {
    it('should create a template and update it on re-sync', async () => {
      const { workspace, connection } = await seedConnection()

      const created = expectOk(
        await WhatsAppTemplateRepository.upsertSynced(
          syncInput(workspace.id, connection.id),
        ),
      )
      expect(created.status).toBe('PENDING')

      const updated = expectOk(
        await WhatsAppTemplateRepository.upsertSynced(
          syncInput(workspace.id, connection.id, {
            status: 'APPROVED',
            category: 'UTILITY',
          }),
        ),
      )
      expect(updated.id).toBe(created.id)
      expect(updated.status).toBe('APPROVED')
      expect(updated.category).toBe('UTILITY')
    })

    it('should return DATABASE_ERROR when the connection does not exist', async () => {
      const workspace = await seedWorkspace()
      expectErr(
        await WhatsAppTemplateRepository.upsertSynced(
          syncInput(workspace.id, 'missing-connection'),
        ),
        'DATABASE_ERROR',
      )
    })
  })

  describe('listByWorkspace()', () => {
    it('should list only the workspace templates ordered by name', async () => {
      const { workspace, connection } = await seedConnection()
      const other = await seedConnection()
      for (const name of ['zeta', 'alfa']) {
        expectOk(
          await WhatsAppTemplateRepository.upsertSynced(
            syncInput(workspace.id, connection.id, { name }),
          ),
        )
      }
      expectOk(
        await WhatsAppTemplateRepository.upsertSynced(
          syncInput(other.workspace.id, other.connection.id, { name: 'beta' }),
        ),
      )

      const list = expectOk(
        await WhatsAppTemplateRepository.listByWorkspace(workspace.id),
      )
      expect(list.map((t) => t.name)).toEqual(['alfa', 'zeta'])
    })

    it('should return DATABASE_ERROR when the query throws', async () => {
      vi.spyOn(prisma.whatsAppTemplate, 'findMany').mockRejectedValueOnce(
        new Error('boom'),
      )
      expectErr(
        await WhatsAppTemplateRepository.listByWorkspace('w'),
        'DATABASE_ERROR',
      )
    })
  })

  describe('findById()', () => {
    it('should not leak a template from another workspace', async () => {
      const { workspace, connection } = await seedConnection()
      const other = await seedConnection()
      const template = expectOk(
        await WhatsAppTemplateRepository.upsertSynced(
          syncInput(workspace.id, connection.id),
        ),
      )

      expect(
        expectOk(
          await WhatsAppTemplateRepository.findById(template.id, workspace.id),
        )?.id,
      ).toBe(template.id)
      expect(
        expectOk(
          await WhatsAppTemplateRepository.findById(
            template.id,
            other.workspace.id,
          ),
        ),
      ).toBeNull()
    })

    it('should return DATABASE_ERROR when the query throws', async () => {
      vi.spyOn(prisma.whatsAppTemplate, 'findFirst').mockRejectedValueOnce(
        new Error('boom'),
      )
      expectErr(
        await WhatsAppTemplateRepository.findById('t', 'w'),
        'DATABASE_ERROR',
      )
    })
  })

  describe('findByConnectionAndName()', () => {
    it('should match by connection, name and language', async () => {
      const { workspace, connection } = await seedConnection()
      const template = expectOk(
        await WhatsAppTemplateRepository.upsertSynced(
          syncInput(workspace.id, connection.id),
        ),
      )

      expect(
        expectOk(
          await WhatsAppTemplateRepository.findByConnectionAndName(
            connection.id,
            'boas_vindas',
            'pt_BR',
          ),
        )?.id,
      ).toBe(template.id)
      expect(
        expectOk(
          await WhatsAppTemplateRepository.findByConnectionAndName(
            connection.id,
            'boas_vindas',
            'en_US',
          ),
        ),
      ).toBeNull()
    })

    it('should return DATABASE_ERROR when the query throws', async () => {
      vi.spyOn(prisma.whatsAppTemplate, 'findUnique').mockRejectedValueOnce(
        new Error('boom'),
      )
      expectErr(
        await WhatsAppTemplateRepository.findByConnectionAndName('c', 'n', 'l'),
        'DATABASE_ERROR',
      )
    })
  })
})
