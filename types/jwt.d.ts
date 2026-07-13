export interface AccessTokenPayload {
  sub: string
  role: string
  workspaceId: string | null
  iat: number
  exp: number
}

export interface RefreshTokenPayload {
  sub: string
  iat: number
  exp: number
}
