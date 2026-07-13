import { describe, expect, it } from 'vitest'
import {
  ModuleKindSchema,
  SaveWorkspaceConnectionSchema,
  TestWorkspaceConnectionSchema,
} from '../workspace-connection.schema'

const validConnection = {
  host: 'db.example.com',
  port: 5432,
  username: 'app_user',
  password: 'super-secret',
  database: 'crm_db',
}

describe('ModuleKindSchema', () => {
  it('should accept the three known modules', () => {
    expect(ModuleKindSchema.safeParse('SERVICE_DESK').success).toBe(true)
    expect(ModuleKindSchema.safeParse('CRM').success).toBe(true)
    expect(ModuleKindSchema.safeParse('COMMUNICATION').success).toBe(true)
  })

  it('should reject unknown modules', () => {
    expect(ModuleKindSchema.safeParse('WIKI').success).toBe(false)
  })
})

describe('SaveWorkspaceConnectionSchema', () => {
  it('should accept a valid connection and default sslEnabled to true', () => {
    const result = SaveWorkspaceConnectionSchema.safeParse(validConnection)

    expect(result.success).toBe(true)
    expect(result.data?.sslEnabled).toBe(true)
  })

  it('should accept sslEnabled explicitly set to false', () => {
    const result = SaveWorkspaceConnectionSchema.safeParse({
      ...validConnection,
      sslEnabled: false,
    })

    expect(result.success).toBe(true)
    expect(result.data?.sslEnabled).toBe(false)
  })

  it('should reject a port outside the valid range', () => {
    expect(
      SaveWorkspaceConnectionSchema.safeParse({ ...validConnection, port: 0 })
        .success,
    ).toBe(false)
    expect(
      SaveWorkspaceConnectionSchema.safeParse({
        ...validConnection,
        port: 70000,
      }).success,
    ).toBe(false)
  })

  it('should reject missing required fields', () => {
    const { host: _host, ...withoutHost } = validConnection
    expect(SaveWorkspaceConnectionSchema.safeParse(withoutHost).success).toBe(
      false,
    )
  })

  it('should reject empty password', () => {
    expect(
      SaveWorkspaceConnectionSchema.safeParse({
        ...validConnection,
        password: '',
      }).success,
    ).toBe(false)
  })
})

describe('TestWorkspaceConnectionSchema', () => {
  it('should require a module in addition to connection fields', () => {
    const withoutModule =
      SaveWorkspaceConnectionSchema.safeParse(validConnection)
    expect(withoutModule.success).toBe(true)

    const asTest = TestWorkspaceConnectionSchema.safeParse(validConnection)
    expect(asTest.success).toBe(false)

    const withModule = TestWorkspaceConnectionSchema.safeParse({
      ...validConnection,
      module: 'SERVICE_DESK',
    })
    expect(withModule.success).toBe(true)
  })
})
