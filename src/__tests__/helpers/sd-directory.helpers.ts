import type { Role } from '@prisma/client'
import { vi } from 'vitest'
import { createFakeMembership } from '@/src/__tests__/factories/membership.factory'
import { ok } from '@/src/lib/result'
import { MembershipRepository } from '@/src/repositories/membership.repository'
import { SdAccessRepository } from '@/src/repositories/sd-access.repository'

/**
 * Configura o `SdAccess` real (associação + departamentos) para os testes de
 * service dos cadastros. O arquivo de teste precisa de
 * `vi.mock('@/src/repositories/membership.repository')` e
 * `vi.mock('@/src/repositories/sd-access.repository')`.
 *
 * - `agent: true` → membro de um departamento (agente);
 * - `agent: false` → solicitante (sem departamento). OWNER/ADMIN contam
 *   como agentes de qualquer forma.
 */
export function asSdMember(role: Role, opts: { agent?: boolean } = {}) {
  const { agent = true } = opts
  vi.mocked(MembershipRepository.findByUserAndWorkspace).mockResolvedValue(
    ok(createFakeMembership({ role })),
  )
  vi.mocked(SdAccessRepository.listDepartmentLinks).mockResolvedValue(
    ok(agent ? [{ departmentId: 'dep1', parentId: null, isLead: false }] : []),
  )
}

/** Não é membro da workspace. */
export function asSdStranger() {
  vi.mocked(MembershipRepository.findByUserAndWorkspace).mockResolvedValue(
    ok(null),
  )
}
