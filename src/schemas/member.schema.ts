import z from 'zod'
import { InvitableRoleValues } from './invitation.schema'

export const MemberSortByValues = [
  'name',
  'username',
  'email',
  'role',
  'joinedAt',
] as const

export const MemberSortOrderValues = ['asc', 'desc'] as const

export const MemberRoleFilterValues = [
  'OWNER',
  'ADMIN',
  'MEMBER',
  'VIEWER',
] as const

/** Query string of the paginated member directory (Settings > Members). */
export const ListMembersQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  roles: z
    .string()
    .transform((value) => value.split(',').filter(Boolean))
    .pipe(z.array(z.enum(MemberRoleFilterValues)))
    .optional(),
  sortBy: z.enum(MemberSortByValues).default('joinedAt'),
  sortOrder: z.enum(MemberSortOrderValues).default('desc'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

/** Ownership is never granted here: OWNER is not an assignable role. */
export const UpdateMemberRoleSchema = z.object({
  role: z.enum(InvitableRoleValues),
})

/** Upper bound of rows in one CSV import (each row sends an e-mail). */
export const MEMBER_IMPORT_MAX_ROWS = 500

export const MemberImportRowSchema = z.object({
  email: z.email('E-mail inválido'),
  role: z
    .enum(InvitableRoleValues, {
      error: 'Cargo inválido: use ADMIN, MEMBER ou VIEWER',
    })
    .default('MEMBER'),
})

export type ListMembersQuery = z.infer<typeof ListMembersQuerySchema>

export type UpdateMemberRoleDTO = z.infer<typeof UpdateMemberRoleSchema>

export type MemberImportRowDTO = z.infer<typeof MemberImportRowSchema>
