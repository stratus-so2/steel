import { describe, expect, it } from 'vitest'
import {
  AddCrmMailingListMemberSchema,
  CreateCrmMailingListSchema,
  UpdateCrmMailingListSchema,
} from '../crm-mailing-list.schema'

describe('CreateCrmMailingListSchema', () => {
  it('should reject when name is missing', () => {
    expect(CreateCrmMailingListSchema.safeParse({}).success).toBe(false)
  })
})

describe('UpdateCrmMailingListSchema', () => {
  it('should accept an empty payload', () => {
    expect(UpdateCrmMailingListSchema.safeParse({}).success).toBe(true)
  })
})

describe('AddCrmMailingListMemberSchema', () => {
  it('should reject an invalid email', () => {
    expect(
      AddCrmMailingListMemberSchema.safeParse({ email: 'invalid' }).success,
    ).toBe(false)
  })

  it('should accept a valid email', () => {
    expect(
      AddCrmMailingListMemberSchema.safeParse({ email: 'jane@acme.com' })
        .success,
    ).toBe(true)
  })
})
