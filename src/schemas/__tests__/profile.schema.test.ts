import { describe, expect, it } from 'vitest'
import { CreateProfileSchema, UpdateProfileSchema } from '../profile.schema'

describe('CreateProfileSchema', () => {
  it('should reject an empty name', () => {
    expect(
      CreateProfileSchema.safeParse({ name: '', permissions: {} }).success,
    ).toBe(false)
  })

  it('should accept a valid permission map', () => {
    const result = CreateProfileSchema.safeParse({
      name: 'Vendedor',
      permissions: { companies: ['VIEW', 'CREATE'] },
    })
    expect(result.success).toBe(true)
  })

  it('should reject an invalid action in the permission map', () => {
    const result = CreateProfileSchema.safeParse({
      name: 'Vendedor',
      permissions: { companies: ['FLY'] },
    })
    expect(result.success).toBe(false)
  })
})

describe('UpdateProfileSchema', () => {
  it('should reject an empty payload', () => {
    expect(UpdateProfileSchema.safeParse({}).success).toBe(false)
  })

  it('should accept a partial payload with only name', () => {
    expect(UpdateProfileSchema.safeParse({ name: 'Novo nome' }).success).toBe(
      true,
    )
  })
})
