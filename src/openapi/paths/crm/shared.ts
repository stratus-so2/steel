import type {
  PermissionAction,
  PermissionResource,
} from '@/src/lib/permissions'
import type { ErrorEntry, ErrorSpec } from '../../registry'

/**
 * Peças comuns às rotas do CRM interno (`/workspaces/{id}/crm/**`). Toda rota
 * passa por `assertModuleMember` (membro ativo → módulo CRM habilitado →
 * permissão recurso × ação); OWNER/ADMIN sempre passam na permissão.
 */

/** Membro + módulo CRM habilitado (+ permissão, quando houver). */
export const CRM_ERRORS: ErrorEntry[] = [
  {
    code: 'FORBIDDEN',
    when: 'Não é membro do workspace ou o perfil não concede a permissão',
  },
  'WORKSPACE_SUSPENDED',
  { code: 'MODULE_DISABLED', when: 'Módulo CRM desabilitado no workspace' },
]

/** Ações restritas a OWNER/ADMIN (`assertModulePrivileged`). */
export const CRM_PRIVILEGED_ERRORS: ErrorEntry[] = [
  {
    code: 'FORBIDDEN',
    when: 'Não é membro do workspace ou não é OWNER/ADMIN',
  },
  'WORKSPACE_SUSPENDED',
  { code: 'MODULE_DISABLED', when: 'Módulo CRM desabilitado no workspace' },
]

/** `RESOURCE_NOT_FOUND` com a mensagem de `notFound('<Resource>')`. */
export function notFoundError(resource: string, when?: string): ErrorSpec {
  return {
    code: 'RESOURCE_NOT_FOUND',
    message: `${resource} not found`,
    ...(when && { when }),
  }
}

/**
 * Parágrafo padrão de acesso para a descrição da operação.
 * - `crmAccess('leads', 'VIEW')` → permissão recurso × ação;
 * - `crmAccess(null)` → só membro + módulo (leituras de apoio);
 * - `crmAccess('privileged')` → OWNER/ADMIN.
 */
export function crmAccess(
  resource: PermissionResource | null | 'privileged',
  action?: PermissionAction,
): string {
  if (resource === 'privileged') {
    return 'Acesso: sessão + membro do workspace com o módulo **CRM** habilitado; restrito a **OWNER/ADMIN**.'
  }
  if (resource === null) {
    return 'Acesso: sessão + membro do workspace com o módulo **CRM** habilitado (sem permissão específica).'
  }
  return `Acesso: sessão + membro do workspace com o módulo **CRM** habilitado e a permissão \`${resource}\` × \`${action}\` no perfil (OWNER/ADMIN sempre passam).`
}

/** Junta parágrafos da descrição (ignora vazios). */
export function describe(...parts: (string | undefined | false)[]): string {
  return parts.filter(Boolean).join('\n\n')
}
