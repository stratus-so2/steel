import { describe, expect, it } from 'vitest'
import { UpdateInvitationRoleSchema } from '../invitation.schema'
import {
  ListMembersQuerySchema,
  MemberImportRowSchema,
  UpdateMemberRoleSchema,
} from '../member.schema'

describe('ListMembersQuerySchema', () => {
  it('applies the directory defaults', () => {
    expect(ListMembersQuerySchema.parse({})).toEqual({
      sortBy: 'joinedAt',
      sortOrder: 'desc',
      page: 1,
      pageSize: 20,
    })
  })

  it('splits the comma separated roles and coerces numbers', () => {
    expect(
      ListMembersQuerySchema.parse({
        search: '  ana ',
        roles: 'OWNER,,VIEWER',
        sortBy: 'role',
        sortOrder: 'asc',
        page: '3',
        pageSize: '50',
      }),
    ).toEqual({
      search: 'ana',
      roles: ['OWNER', 'VIEWER'],
      sortBy: 'role',
      sortOrder: 'asc',
      page: 3,
      pageSize: 50,
    })
  })

  it('rejects unknown roles, sort keys and out-of-range pages', () => {
    expect(ListMembersQuerySchema.safeParse({ roles: 'GUEST' }).success).toBe(
      false,
    )
    expect(ListMembersQuerySchema.safeParse({ sortBy: 'id' }).success).toBe(
      false,
    )
    expect(ListMembersQuerySchema.safeParse({ page: '0' }).success).toBe(false)
    expect(ListMembersQuerySchema.safeParse({ pageSize: '101' }).success).toBe(
      false,
    )
    expect(
      ListMembersQuerySchema.safeParse({ search: 'x'.repeat(101) }).success,
    ).toBe(false)
  })
})

describe('UpdateMemberRoleSchema / UpdateInvitationRoleSchema', () => {
  it.each([UpdateMemberRoleSchema, UpdateInvitationRoleSchema])(
    'accepts invitable roles and never OWNER',
    (schema) => {
      expect(schema.parse({ role: 'ADMIN' })).toEqual({ role: 'ADMIN' })
      expect(schema.safeParse({ role: 'OWNER' }).success).toBe(false)
      expect(schema.safeParse({}).success).toBe(false)
    },
  )
})

describe('MemberImportRowSchema', () => {
  it('defaults the role to MEMBER', () => {
    expect(MemberImportRowSchema.parse({ email: 'a@b.com' })).toEqual({
      email: 'a@b.com',
      role: 'MEMBER',
    })
  })

  it('explains invalid e-mails and roles in pt-BR', () => {
    const email = MemberImportRowSchema.safeParse({ email: 'nope' })
    expect(email.success).toBe(false)
    expect(email.error?.issues[0]?.message).toBe('E-mail inválido')

    const role = MemberImportRowSchema.safeParse({
      email: 'a@b.com',
      role: 'OWNER',
    })
    expect(role.success).toBe(false)
    expect(role.error?.issues[0]?.message).toBe(
      'Cargo inválido: use ADMIN, MEMBER ou VIEWER',
    )
  })
})
