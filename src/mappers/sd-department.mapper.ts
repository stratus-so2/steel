import type {
  SdDepartmentMemberWithUser,
  SdDepartmentWithMembers,
} from '@/src/repositories/sd-department.repository'
import type {
  SdDepartmentDTO,
  SdDepartmentMemberDTO,
  SdDepartmentTreeDTO,
} from '@/types/sd-config'

export function toSdDepartmentMemberDTO(
  member: SdDepartmentMemberWithUser,
): SdDepartmentMemberDTO {
  return {
    userId: member.userId,
    name: member.user.name,
    email: member.user.email,
    image: member.user.image,
    isLead: member.isLead,
    lastAssignedAt: member.lastAssignedAt?.toISOString() ?? null,
  }
}

export function toSdDepartmentDTO(
  department: SdDepartmentWithMembers,
): SdDepartmentDTO {
  return {
    id: department.id,
    parentId: department.parentId,
    name: department.name,
    description: department.description,
    email: department.email,
    color: department.color,
    calendarId: department.calendarId,
    active: department.active,
    position: department.position,
    members: department.members.map(toSdDepartmentMemberDTO),
    createdAt: department.createdAt.toISOString(),
    updatedAt: department.updatedAt.toISOString(),
  }
}

/**
 * Lista plana → árvore de dois níveis (raízes com `children`). Sub-
 * departamentos cujo pai não está na lista (inativo) viram raízes.
 */
export function toSdDepartmentTree(
  departments: SdDepartmentDTO[],
): SdDepartmentTreeDTO[] {
  const ids = new Set(departments.map((d) => d.id))
  const roots = departments.filter((d) => !d.parentId || !ids.has(d.parentId))
  return roots.map((root) => ({
    ...root,
    children: departments.filter((d) => d.parentId === root.id),
  }))
}
