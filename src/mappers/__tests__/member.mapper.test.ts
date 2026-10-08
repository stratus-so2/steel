import { describe, expect, it } from 'vitest'
import type { MembershipWithUser } from '@/src/repositories/membership.repository'
import { toMemberDTO } from '../member.mapper'

function membership(
  user: Partial<MembershipWithUser['user']> = {},
): MembershipWithUser {
  return {
    id: 'mem1',
    userId: 'u1',
    workspaceId: 'ws1',
    role: 'ADMIN',
    profileId: null,
    createdAt: new Date('2026-09-01T10:00:00.000Z'),
    updatedAt: new Date('2026-09-02T10:00:00.000Z'),
    user: {
      id: 'u1',
      name: 'Ana Castro',
      username: 'ana',
      email: 'ana@x.com',
      image: 'https://cdn/a.png',
      emailVerified: true,
      twoFactorEnabled: true,
      deletionScheduledAt: null,
      accounts: [],
      ...user,
    },
  }
}

describe('toMemberDTO()', () => {
  it('maps the directory row', () => {
    expect(
      toMemberDTO(
        membership({
          accounts: [
            { providerId: 'credential' },
            { providerId: 'google' },
            { providerId: 'github' },
          ],
        }),
      ),
    ).toEqual({
      membershipId: 'mem1',
      userId: 'u1',
      name: 'Ana Castro',
      username: 'ana',
      email: 'ana@x.com',
      image: 'https://cdn/a.png',
      role: 'ADMIN',
      accountStatus: 'ACTIVE',
      authMethods: ['EMAIL_PASSWORD', 'GOOGLE', 'GITHUB'],
      twoFactorEnabled: true,
      joinedAt: '2026-09-01T10:00:00.000Z',
    })
  })

  it('dedupes auth methods and drops unknown providers', () => {
    const dto = toMemberDTO(
      membership({
        accounts: [
          { providerId: 'google' },
          { providerId: 'google' },
          { providerId: 'email-otp' },
        ],
      }),
    )
    expect(dto.authMethods).toEqual(['GOOGLE'])
  })

  it('derives the account status (deletion wins over verification)', () => {
    expect(
      toMemberDTO(membership({ emailVerified: false })).accountStatus,
    ).toBe('UNVERIFIED')
    expect(
      toMemberDTO(
        membership({
          emailVerified: false,
          deletionScheduledAt: new Date('2026-10-30T00:00:00Z'),
        }),
      ).accountStatus,
    ).toBe('PENDING_DELETION')
  })
})
