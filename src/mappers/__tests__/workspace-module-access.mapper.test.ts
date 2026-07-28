import { describe, expect, it } from 'vitest'
import { createFakeWorkspaceModuleAccess } from '@/src/__tests__/factories/workspace-module-access.factory'
import { toWorkspaceModuleAccessDTO } from '../workspace-module-access.mapper'

describe('toWorkspaceModuleAccessDTO()', () => {
  it('should map all fields correctly', () => {
    const access = createFakeWorkspaceModuleAccess({
      id: 'wma-1',
      workspaceId: 'ws-1',
      module: 'COMMUNICATION',
      enabled: true,
      grantedById: 'u-1',
    })

    const dto = toWorkspaceModuleAccessDTO(access)

    expect(dto).toEqual({
      id: 'wma-1',
      workspaceId: 'ws-1',
      module: 'COMMUNICATION',
      enabled: true,
      grantedById: 'u-1',
      createdAt: access.createdAt.toISOString(),
      updatedAt: access.updatedAt.toISOString(),
    })
  })

  it('should serialize createdAt/updatedAt as ISO strings', () => {
    const created = new Date('2026-01-15T10:30:00.000Z')
    const updated = new Date('2026-01-15T08:00:00.000Z')
    const access = createFakeWorkspaceModuleAccess({
      createdAt: created,
      updatedAt: updated,
    })

    const dto = toWorkspaceModuleAccessDTO(access)

    expect(dto.createdAt).toBe('2026-01-15T10:30:00.000Z')
    expect(dto.updatedAt).toBe('2026-01-15T08:00:00.000Z')
  })

  it('should preserve enabled: false', () => {
    const access = createFakeWorkspaceModuleAccess({ enabled: false })

    const dto = toWorkspaceModuleAccessDTO(access)

    expect(dto.enabled).toBe(false)
  })
})
