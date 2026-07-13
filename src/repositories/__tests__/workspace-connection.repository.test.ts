import { describe, expect, it } from 'vitest'
import { seedUser } from '@/src/__tests__/factories/user.factory'
import { seedWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { seedWorkspaceConnection } from '@/src/__tests__/factories/workspace-connection.factory'
import { expectOk } from '@/src/__tests__/helpers/result.helpers'
import { WorkspaceConnectionRepository } from '../workspace-connection.repository'

describe('WorkspaceConnectionRepository', () => {
  describe('findByWorkspaceAndModule()', () => {
    it('should return the connection when it exists', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      await seedWorkspaceConnection(workspace.id, user.id, { module: 'CRM' })

      const result =
        await WorkspaceConnectionRepository.findByWorkspaceAndModule(
          workspace.id,
          'CRM',
        )

      const connection = expectOk(result)
      expect(connection).not.toBeNull()
      expect(connection?.module).toBe('CRM')
    })

    it('should return null when no connection is configured for that module', async () => {
      const workspace = await seedWorkspace()

      const result =
        await WorkspaceConnectionRepository.findByWorkspaceAndModule(
          workspace.id,
          'CRM',
        )

      expect(expectOk(result)).toBeNull()
    })
  })

  describe('listByWorkspace()', () => {
    it('should list all module connections for a workspace', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      await seedWorkspaceConnection(workspace.id, user.id, { module: 'CRM' })
      await seedWorkspaceConnection(workspace.id, user.id, {
        module: 'SERVICE_DESK',
      })

      const result = await WorkspaceConnectionRepository.listByWorkspace(
        workspace.id,
      )

      const list = expectOk(result)
      expect(list).toHaveLength(2)
      expect(list.map((c) => c.module).sort()).toEqual(['CRM', 'SERVICE_DESK'])
    })

    it('should not list connections belonging to other workspaces', async () => {
      const [a, b, user] = await Promise.all([
        seedWorkspace(),
        seedWorkspace(),
        seedUser(),
      ])
      await seedWorkspaceConnection(a.id, user.id, { module: 'CRM' })
      await seedWorkspaceConnection(b.id, user.id, { module: 'CRM' })

      const result = await WorkspaceConnectionRepository.listByWorkspace(a.id)

      const list = expectOk(result)
      expect(list).toHaveLength(1)
      expect(list[0].workspaceId).toBe(a.id)
    })
  })

  describe('upsert()', () => {
    it('should create a connection when none exists for that module', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])

      const result = await WorkspaceConnectionRepository.upsert({
        workspaceId: workspace.id,
        module: 'CRM',
        host: 'db.example.com',
        port: 5432,
        username: 'app_user',
        encryptedPassword: 'enc:secret',
        database: 'crm_db',
        sslEnabled: true,
        createdById: user.id,
      })

      const connection = expectOk(result)
      expect(connection.host).toBe('db.example.com')
    })

    it('should replace the existing connection for the same workspace+module', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      const original = await seedWorkspaceConnection(workspace.id, user.id, {
        module: 'CRM',
        host: 'old-host.example.com',
      })

      const result = await WorkspaceConnectionRepository.upsert({
        workspaceId: workspace.id,
        module: 'CRM',
        host: 'new-host.example.com',
        port: 5432,
        username: 'app_user',
        encryptedPassword: 'enc:secret',
        database: 'crm_db',
        sslEnabled: true,
        createdById: user.id,
      })

      const connection = expectOk(result)
      expect(connection.id).toBe(original.id)
      expect(connection.host).toBe('new-host.example.com')

      const listed = expectOk(
        await WorkspaceConnectionRepository.listByWorkspace(workspace.id),
      )
      expect(listed).toHaveLength(1)
    })
  })

  describe('delete()', () => {
    it('should remove the connection', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      const seeded = await seedWorkspaceConnection(workspace.id, user.id, {
        module: 'CRM',
      })

      const result = await WorkspaceConnectionRepository.delete(seeded.id)
      expectOk(result)

      const remaining = expectOk(
        await WorkspaceConnectionRepository.findByWorkspaceAndModule(
          workspace.id,
          'CRM',
        ),
      )
      expect(remaining).toBeNull()
    })
  })
})
