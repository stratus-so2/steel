export type MemberRole = 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER'
export type MemberAccountStatus = 'ACTIVE' | 'UNVERIFIED' | 'PENDING_DELETION'
export type MemberAuthMethod = 'EMAIL_PASSWORD' | 'GOOGLE' | 'GITHUB'

/** Row of the member directory in Settings > Members. */
export interface MemberDTO {
  membershipId: string
  userId: string
  name: string
  username: string
  email: string
  image: string | null
  role: MemberRole
  accountStatus: MemberAccountStatus
  authMethods: MemberAuthMethod[]
  twoFactorEnabled: boolean
  joinedAt: string
}

/** Plan seats: members + pending invitations against the plan limit. */
export interface MemberSeatUsage {
  used: number
  /** `null` = unlimited plan. */
  limit: number | null
}

export interface ListMembersResult {
  members: MemberDTO[]
  total: number
  page: number
  pageSize: number
  seats: MemberSeatUsage
}

export interface MemberImportRowResult {
  row: number
  email: string
  status: 'invited' | 'skipped' | 'error'
  reason?: string
}

export interface MemberImportResult {
  invited: number
  skipped: number
  errors: number
  rows: MemberImportRowResult[]
}
