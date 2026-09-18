import type { CrmSocialConnection, Role, WorkspaceStatus } from '@prisma/client'
import { describe, expect, it, vi } from 'vitest'
import { createFakeCrmSocialConnection } from '@/src/__tests__/factories/crm-social.factory'
import { createFakeMembership } from '@/src/__tests__/factories/membership.factory'
import { expectErr } from '@/src/__tests__/helpers/result.helpers'
import { crmSocialConnectionNotFound } from '@/src/errors'
import type { PermissionAction } from '@/src/lib/permissions'
import { err, ok, type Result } from '@/src/lib/result'
import { MembershipRepository } from '@/src/repositories/membership.repository'
import { WorkspaceModuleAccessRepository } from '@/src/repositories/workspace-module-access.repository'
import { getFreshAccessToken } from '@/src/services/crm-social-token'

/*
 * Helpers dos testes dos services de plataforma social. Exigem que o arquivo
 * de teste faça `vi.mock('@/src/repositories/membership.repository')` e
 * `vi.mock('@/src/services/crm-social-token')` (ou o caminho relativo
 * equivalente) — aqui só configuramos os mocks já instalados.
 */

/** Membership ativa com o papel dado (padrão MEMBER). */
export function asMember(
  role: Role = 'MEMBER',
  workspaceStatus: WorkspaceStatus = 'ACTIVE',
): void {
  vi.mocked(MembershipRepository.findByUserAndWorkspace).mockResolvedValue(
    ok(createFakeMembership({ role, workspaceStatus })),
  )
}

/** Token fresco da conexão (decifrado), com escopo/conta configuráveis. */
export function withToken(
  connection: Partial<CrmSocialConnection> = {},
  accessToken = 'access-token',
): CrmSocialConnection {
  const conn = createFakeCrmSocialConnection({
    status: 'CONNECTED',
    ...connection,
  })
  vi.mocked(getFreshAccessToken).mockResolvedValue(
    ok({ accessToken, connection: conn }),
  )
  return conn
}

export type SocialAuthzCase = {
  /** Nome da operação (vira o `describe`). */
  name: string
  /** Ação exigida em `social` — define quem é barrado pela matriz. */
  action: PermissionAction
  /** Escopo que libera a operação (a conexão sem ele deve ser barrada). */
  scope: string
  /** `externalAccountId` válido para a plataforma. */
  externalAccountId?: string
  call: () => Promise<Result<unknown>>
}

/**
 * Contrato comum de autorização de todo service de plataforma: não-membro,
 * workspace suspensa, módulo CRM desligado, papel sem a permissão, conexão
 * ausente/expirada e escopo faltando — todos barram ANTES de qualquer `fetch`.
 */
export function describeSocialAuthz(
  cases: SocialAuthzCase[],
  fetchSpy: () => { mock: { calls: unknown[] } },
): void {
  for (const c of cases) {
    describe(`${c.name} — authz`, () => {
      it('should return FORBIDDEN for a non-member', async () => {
        vi.mocked(
          MembershipRepository.findByUserAndWorkspace,
        ).mockResolvedValue(ok(null))
        expectErr(await c.call(), 'FORBIDDEN')
        expect(getFreshAccessToken).not.toHaveBeenCalled()
        expect(fetchSpy().mock.calls).toHaveLength(0)
      })

      it('should return WORKSPACE_SUSPENDED for a suspended workspace', async () => {
        asMember('OWNER', 'SUSPENDED')
        expectErr(await c.call(), 'WORKSPACE_SUSPENDED')
        expect(getFreshAccessToken).not.toHaveBeenCalled()
      })

      it('should return MODULE_DISABLED when the CRM module is off', async () => {
        asMember('OWNER')
        vi.mocked(
          WorkspaceModuleAccessRepository.isEnabled,
        ).mockResolvedValueOnce(ok(false))
        expectErr(await c.call(), 'MODULE_DISABLED')
        expect(getFreshAccessToken).not.toHaveBeenCalled()
      })

      const deniedRole: Role | null =
        c.action === 'VIEW' ? null : c.action === 'DELETE' ? 'MEMBER' : 'VIEWER'
      if (deniedRole) {
        it(`should return FORBIDDEN for a ${deniedRole} (no ${c.action} on social)`, async () => {
          asMember(deniedRole)
          expectErr(await c.call(), 'FORBIDDEN')
          expect(getFreshAccessToken).not.toHaveBeenCalled()
        })
      }

      it('should propagate the token error when there is no usable connection', async () => {
        asMember('OWNER')
        vi.mocked(getFreshAccessToken).mockResolvedValue(
          err(crmSocialConnectionNotFound()),
        )
        expectErr(await c.call(), 'CRM_SOCIAL_CONNECTION_NOT_FOUND')
        expect(fetchSpy().mock.calls).toHaveLength(0)
      })

      it('should return CRM_SOCIAL_SCOPE_MISSING when the connection lacks the scope', async () => {
        asMember('OWNER')
        withToken({
          scope: 'some.other.scope',
          externalAccountId: c.externalAccountId ?? 'acc-1',
        })
        expectErr(await c.call(), 'CRM_SOCIAL_SCOPE_MISSING')
        expect(fetchSpy().mock.calls).toHaveLength(0)
      })

      it(`should accept a connection granted only "${c.scope}"`, async () => {
        asMember('OWNER')
        withToken({
          scope: c.scope,
          externalAccountId: c.externalAccountId ?? 'acc-1',
        })
        const result = await c.call()
        if (!result.ok) {
          expect(result.error.code).not.toBe('CRM_SOCIAL_SCOPE_MISSING')
        }
        expect(fetchSpy().mock.calls.length).toBeGreaterThan(0)
      })

      it('should treat a null scope as missing', async () => {
        asMember('OWNER')
        withToken({
          scope: null,
          externalAccountId: c.externalAccountId ?? 'acc-1',
        })
        expectErr(await c.call(), 'CRM_SOCIAL_SCOPE_MISSING')
      })
    })
  }
}
