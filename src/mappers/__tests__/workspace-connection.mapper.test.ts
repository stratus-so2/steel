import { describe, expect, it } from 'vitest'
import { createFakeWorkspaceConnection } from '@/src/__tests__/factories/workspace-connection.factory'
import { toWorkspaceConnectionDTO } from '../workspace-connection.mapper'

describe('toWorkspaceConnectionDTO()', () => {
  it('should map all fields and never leak the encrypted password', () => {
    const connection = createFakeWorkspaceConnection({
      id: 'wmc-1',
      workspaceId: 'ws-1',
      module: 'CRM',
      host: 'db.example.com',
      port: 5432,
      username: 'app_user',
      database: 'crm_db',
      sslEnabled: true,
      createdById: 'user-1',
    })

    const dto = toWorkspaceConnectionDTO(connection)

    expect(dto).toEqual({
      id: 'wmc-1',
      workspaceId: 'ws-1',
      module: 'CRM',
      host: 'db.example.com',
      port: 5432,
      username: 'app_user',
      database: 'crm_db',
      sslEnabled: true,
      createdById: 'user-1',
      createdAt: connection.createdAt.toISOString(),
      updatedAt: connection.updatedAt.toISOString(),
    })
    expect(dto).not.toHaveProperty('encryptedPassword')
    expect(dto).not.toHaveProperty('password')
  })
})
