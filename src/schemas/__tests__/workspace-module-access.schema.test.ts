import { describe, expect, it } from 'vitest'
import { SetWorkspaceModuleAccessSchema } from '../workspace-module-access.schema'

describe('SetWorkspaceModuleAccessSchema', () => {
  it('should accept a valid module and enabled flag', () => {
    const result = SetWorkspaceModuleAccessSchema.safeParse({
      module: 'CRM',
      enabled: true,
    })

    expect(result.success).toBe(true)
  })

  it('should accept enabled: false', () => {
    const result = SetWorkspaceModuleAccessSchema.safeParse({
      module: 'COMMUNICATION',
      enabled: false,
    })

    expect(result.success).toBe(true)
  })

  it('should reject an unknown module', () => {
    const result = SetWorkspaceModuleAccessSchema.safeParse({
      module: 'BILLING',
      enabled: true,
    })

    expect(result.success).toBe(false)
  })

  it('should reject a missing enabled flag', () => {
    const result = SetWorkspaceModuleAccessSchema.safeParse({ module: 'CRM' })

    expect(result.success).toBe(false)
  })

  it('should reject a non-boolean enabled flag', () => {
    const result = SetWorkspaceModuleAccessSchema.safeParse({
      module: 'CRM',
      enabled: 'true',
    })

    expect(result.success).toBe(false)
  })
})
