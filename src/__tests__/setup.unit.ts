import { afterEach, vi } from 'vitest'
import { ok } from '@/src/lib/result'

// Services de módulo (CRM, Comunicação) passam por `assertModuleMember`, que
// consulta se o módulo está habilitado. Nos testes unitários o padrão é
// "habilitado" — testes que exercitam o bloqueio sobrescrevem `isEnabled`
// (ou re-mockam o módulo no próprio arquivo).
vi.mock('@/src/repositories/workspace-module-access.repository', () => ({
  WorkspaceModuleAccessRepository: {
    listByWorkspace: vi.fn(async () => ok([])),
    upsert: vi.fn(),
    isEnabled: vi.fn(async () => ok(true)),
  },
}))

afterEach(() => {
  vi.restoreAllMocks()
  vi.clearAllMocks()
})
