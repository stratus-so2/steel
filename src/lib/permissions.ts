/**
 * Catálogo de permissões do RBAC. Um perfil tem um mapa `recurso → [ações]`.
 * Perfis de sistema (OWNER/ADMIN/MEMBER) têm matrizes padrão que preservam o
 * comportamento anterior aos perfis customizados.
 */

export const PERMISSION_ACTIONS = ['VIEW', 'CREATE', 'EDIT', 'DELETE'] as const
export type PermissionAction = (typeof PERMISSION_ACTIONS)[number]

/** Recursos protegidos. Cada service de mutação referencia um destes. */
export const PERMISSION_RESOURCES = [
  'companies',
  'people',
  'opportunities',
  'products',
  'pipelines',
  'quotas',
  'custom-fields',
  'tasks',
  'notes',
  'documents',
  'forms',
  'landing-pages',
  'email',
  'dashboards',
  'workflows',
  'social',
  'integrations',
  'members',
  'settings',
  'audit-logs',
  'leads',
  'reports',
] as const
export type PermissionResource = (typeof PERMISSION_RESOURCES)[number]

export type PermissionMap = Partial<Record<string, PermissionAction[]>>

const ALL: PermissionAction[] = ['VIEW', 'CREATE', 'EDIT', 'DELETE']
const RWC: PermissionAction[] = ['VIEW', 'CREATE', 'EDIT']
const READ: PermissionAction[] = ['VIEW']

/** Recursos que um Membro pode criar/editar (mas não excluir). */
const MEMBER_ENTITIES = new Set<PermissionResource>([
  'companies',
  'people',
  'opportunities',
  'products',
  'tasks',
  'notes',
  'documents',
  'forms',
  'landing-pages',
  'email',
  'dashboards',
  'workflows',
  'social',
  'leads',
  'reports',
])

/** Recursos de configuração que o Membro só pode visualizar. */
const MEMBER_READONLY = new Set<PermissionResource>([
  'pipelines',
  'quotas',
  'custom-fields',
  'audit-logs',
])

function fullMatrix(): PermissionMap {
  const map: PermissionMap = {}
  for (const r of PERMISSION_RESOURCES) map[r] = [...ALL]
  return map
}

function memberMatrix(): PermissionMap {
  const map: PermissionMap = {}
  for (const r of PERMISSION_RESOURCES) {
    if (MEMBER_ENTITIES.has(r)) map[r] = [...RWC]
    else if (MEMBER_READONLY.has(r)) map[r] = [...READ]
    else map[r] = [] // members, settings, integrations: sem acesso
  }
  return map
}

/** Matrizes padrão dos perfis de sistema, por `systemKey`. */
export const SYSTEM_PROFILE_PERMISSIONS: Record<string, PermissionMap> = {
  OWNER: fullMatrix(),
  ADMIN: fullMatrix(),
  MEMBER: memberMatrix(),
}

/** Definição dos perfis de sistema semeados em toda workspace. */
export const SYSTEM_PROFILES = [
  { systemKey: 'OWNER', name: 'Proprietário' },
  { systemKey: 'ADMIN', name: 'Administrador' },
  { systemKey: 'MEMBER', name: 'Membro' },
] as const

/** Mapa `role` (enum legado) → `systemKey` do perfil. */
export const ROLE_TO_SYSTEM_KEY: Record<string, string> = {
  OWNER: 'OWNER',
  ADMIN: 'ADMIN',
  MEMBER: 'MEMBER',
}

/** O perfil concede a ação no recurso? */
export function can(
  permissions: PermissionMap,
  resource: string,
  action: PermissionAction,
): boolean {
  const actions = permissions[resource]
  return Array.isArray(actions) && actions.includes(action)
}

/** Mantém só pares recurso/ação válidos (saneia entrada de perfis custom). */
export function sanitizePermissions(input: unknown): PermissionMap {
  const out: PermissionMap = {}
  if (!input || typeof input !== 'object') return out
  for (const [resource, actions] of Object.entries(
    input as Record<string, unknown>,
  )) {
    if (!(PERMISSION_RESOURCES as readonly string[]).includes(resource))
      continue
    if (!Array.isArray(actions)) continue
    const valid = actions.filter((a): a is PermissionAction =>
      (PERMISSION_ACTIONS as readonly string[]).includes(a),
    )
    out[resource] = [...new Set(valid)]
  }
  return out
}
