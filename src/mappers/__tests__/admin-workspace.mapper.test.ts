import { describe, expect, it } from 'vitest'
import { createFakeWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { toAdminWorkspaceSummaryDTO } from '../admin-workspace.mapper'

describe('toAdminWorkspaceSummaryDTO()', () => {
  it('should map all fields correctly, including memberCount', () => {
    const workspace = {
      ...createFakeWorkspace({
        id: 'ws-1',
        name: 'Acme',
        slug: 'acme',
        activePlan: 'BUSINESS',
      }),
      memberCount: 5,
    }

    const dto = toAdminWorkspaceSummaryDTO(workspace)

    expect(dto).toEqual({
      id: 'ws-1',
      name: 'Acme',
      slug: 'acme',
      activePlan: 'BUSINESS',
      memberCount: 5,
      createdAt: workspace.createdAt.toISOString(),
    })
  })
})
