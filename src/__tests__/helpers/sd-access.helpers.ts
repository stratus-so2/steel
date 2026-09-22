import type { Role } from '@prisma/client'
import { vi } from 'vitest'
import { createFakeMembership } from '@/src/__tests__/factories/membership.factory'
import { ok } from '@/src/lib/result'
import { MembershipRepository } from '@/src/repositories/membership.repository'
import { SdAccessRepository } from '@/src/repositories/sd-access.repository'

/**
 * Papéis do ServiceDesk para os testes da KB. Exige, no arquivo de teste,
 * `vi.mock` de `membership.repository` e `sd-access.repository`.
 */
export function actAs(
  kind: 'admin' | 'agent' | 'requester' | 'viewer-agent' | 'non-member',
  role: Role = 'MEMBER',
) {
  const membership = vi.mocked(MembershipRepository)
  const access = vi.mocked(SdAccessRepository)
  if (kind === 'non-member') {
    membership.findByUserAndWorkspace.mockResolvedValue(ok(null))
    return
  }
  const effectiveRole: Role =
    kind === 'admin' ? 'OWNER' : kind === 'viewer-agent' ? 'VIEWER' : role
  membership.findByUserAndWorkspace.mockResolvedValue(
    ok(createFakeMembership({ role: effectiveRole })),
  )
  access.listDepartmentLinks.mockResolvedValue(
    ok(
      kind === 'requester'
        ? []
        : [{ departmentId: 'd1', parentId: null, isLead: false }],
    ),
  )
}
