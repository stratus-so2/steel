import type { MemberRole } from '@/types/member'

/** pt-BR labels of workspace roles (Settings > Members). */
export const MEMBER_ROLE_LABEL: Record<MemberRole, string> = {
  OWNER: 'Dono',
  ADMIN: 'Administrador',
  MEMBER: 'Membro',
  VIEWER: 'Visualizador',
}

export function memberRoleLabel(role: string): string {
  return MEMBER_ROLE_LABEL[role as MemberRole] ?? role
}
