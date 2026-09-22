import { vi } from 'vitest'
import { createFakeMembership } from '@/src/__tests__/factories/membership.factory'
import { ok } from '@/src/lib/result'
import { MembershipRepository } from '@/src/repositories/membership.repository'
import { SdAccessRepository } from '@/src/repositories/sd-access.repository'
import { WorkspaceModuleAccessRepository } from '@/src/repositories/workspace-module-access.repository'

/**
 * Atores do ServiceDesk para os testes unitários dos services de
 * configuração. O arquivo de teste precisa mockar os módulos:
 *
 * ```ts
 * vi.mock('@/src/repositories/membership.repository')
 * vi.mock('@/src/repositories/sd-access.repository')
 * ```
 *
 * (o `WorkspaceModuleAccessRepository` já é mockado no setup unitário).
 * `SdAccess` roda de verdade — o teste exercita a cadeia real de autorização.
 */
export type SdActor =
  | 'owner'
  | 'admin'
  | 'agent'
  | 'lead'
  | 'requester'
  | 'viewer'
  | 'stranger'
  | 'disabled'

export function actAs(actor: SdActor, departmentId = 'dep-1'): void {
  const membership = vi.mocked(MembershipRepository.findByUserAndWorkspace)
  const links = vi.mocked(SdAccessRepository.listDepartmentLinks)
  const moduleEnabled = vi.mocked(WorkspaceModuleAccessRepository.isEnabled)

  moduleEnabled.mockResolvedValue(ok(actor !== 'disabled'))
  links.mockResolvedValue(ok([]))

  switch (actor) {
    case 'stranger':
      membership.mockResolvedValue(ok(null))
      return
    case 'owner':
    case 'disabled':
      membership.mockResolvedValue(ok(createFakeMembership({ role: 'OWNER' })))
      return
    case 'admin':
      membership.mockResolvedValue(ok(createFakeMembership({ role: 'ADMIN' })))
      return
    case 'viewer':
      membership.mockResolvedValue(ok(createFakeMembership({ role: 'VIEWER' })))
      return
    default:
      membership.mockResolvedValue(ok(createFakeMembership({ role: 'MEMBER' })))
      if (actor === 'agent' || actor === 'lead') {
        links.mockResolvedValue(
          ok([{ departmentId, parentId: null, isLead: actor === 'lead' }]),
        )
      }
  }
}
