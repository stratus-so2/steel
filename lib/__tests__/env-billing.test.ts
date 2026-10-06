import { describe, expect, it } from 'vitest'
import { serverEnvSchema } from '@/lib/env/_server'

// Smallest server env the schema accepts. Values are fake, only shaped to
// pass each validator.
const BASE_ENV = {
  POSTGRES_USER: 'steel',
  POSTGRES_PASSWORD: 'not-a-real-password',
  POSTGRES_DB: 'steel',
  DATABASE_URL: 'postgresql://steel:secret@localhost:5433/steel',
  REDIS_URL: 'rediss://localhost:6380',
  REDIS_PASSWORD: 'not-a-real-password',
  MINIO_ENDPOINT: 'http://localhost:9002',
  MINIO_USER: 'minio',
  MINIO_PASSWORD: 'not-a-real-password',
  BETTER_AUTH_SECRET: 'ba_not-a-real-secret',
  BETTER_AUTH_URL: 'http://localhost:3001',
  GOOGLE_CLIENT_ID: '1234567890.apps.googleusercontent.com',
  GOOGLE_CLIENT_SECRET: 'GOCSPX-not-a-real-secret',
  GITHUB_CLIENT_ID: 'Iv1.fakeclient',
  GITHUB_CLIENT_SECRET: 'a'.repeat(40),
  RESEND_API_KEY: 're_fake',
  HUGEICONS_TOKEN: 'ABCDEF12-ABCDEF12-ABCDEF12-ABCDEF12',
  STATUS_COLLECTOR_SECRET: 's'.repeat(32),
  CONNECTION_SECRETS: `1:${'c'.repeat(32)}`,
}

function billingIssues(env: Record<string, unknown>) {
  const parsed = serverEnvSchema.safeParse({ ...BASE_ENV, ...env })
  if (parsed.success) return []
  return parsed.error.issues.map((issue) => issue.path.join('.'))
}

describe('server env schema — BILLING_ENABLED', () => {
  it('boots without any AbacatePay credential when the flag is unset', () => {
    const parsed = serverEnvSchema.safeParse(BASE_ENV)

    expect(parsed.success).toBe(true)
    expect(parsed.data?.BILLING_ENABLED).toBeUndefined()
    expect(parsed.data?.ABACATE_PAY).toBeUndefined()
  })

  it('boots with blank credentials when billing is off', () => {
    const parsed = serverEnvSchema.safeParse({
      ...BASE_ENV,
      BILLING_ENABLED: 'false',
      ABACATE_PAY: '',
      ABACATE_PAY_WEBHOOK_SECRET: '',
    })

    expect(parsed.success).toBe(true)
    expect(parsed.data?.BILLING_ENABLED).toBe('false')
    expect(parsed.data?.ABACATE_PAY_WEBHOOK_SECRET).toBeUndefined()
  })

  it('requires both credentials when billing is on', () => {
    expect(billingIssues({ BILLING_ENABLED: 'true' })).toEqual([
      'ABACATE_PAY',
      'ABACATE_PAY_WEBHOOK_SECRET',
    ])
  })

  it('treats blank credentials as missing when billing is on', () => {
    expect(
      billingIssues({
        BILLING_ENABLED: 'true',
        ABACATE_PAY: 'abc_live_key',
        ABACATE_PAY_WEBHOOK_SECRET: '',
      }),
    ).toEqual(['ABACATE_PAY_WEBHOOK_SECRET'])
  })

  it('accepts billing on with both credentials', () => {
    const parsed = serverEnvSchema.safeParse({
      ...BASE_ENV,
      BILLING_ENABLED: 'true',
      ABACATE_PAY: 'abc_live_key',
      ABACATE_PAY_WEBHOOK_SECRET: 'whsec',
    })

    expect(parsed.success).toBe(true)
    expect(parsed.data?.BILLING_ENABLED).toBe('true')
  })

  it('rejects a flag value other than "true"/"false"', () => {
    expect(billingIssues({ BILLING_ENABLED: 'yes' })).toEqual([
      'BILLING_ENABLED',
    ])
  })
})
