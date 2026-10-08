import { describe, expect, it } from 'vitest'
import {
  CreateWorkspaceSchema,
  DeleteWorkspaceRequestSchema,
  isReservedWorkspaceSlug,
  RESERVED_WORKSPACE_SLUGS,
  UpdateWorkspaceSchema,
  WorkspaceSlugAvailabilityQuerySchema,
  WorkspaceSlugSchema,
} from '@/src/schemas/workspace.schema'

describe('CreateWorkspaceSchema', () => {
  it('should accept valid name and slug', () => {
    const result = CreateWorkspaceSchema.safeParse({
      name: 'Acme',
      slug: 'acme-co',
    })

    expect(result.success).toBe(true)
    expect(result.data).toEqual({ name: 'Acme', slug: 'acme-co' })
  })

  it('should accept slug with digits and hyphens', () => {
    const result = CreateWorkspaceSchema.safeParse({
      name: 'Acme',
      slug: 'acme-2025',
    })

    expect(result.success).toBe(true)
  })

  it('should reject slug with uppercase letters', () => {
    const result = CreateWorkspaceSchema.safeParse({
      name: 'Acme',
      slug: 'Acme',
    })

    expect(result.success).toBe(false)
  })

  it('should reject slug with spaces', () => {
    const result = CreateWorkspaceSchema.safeParse({
      name: 'Acme',
      slug: 'acme co',
    })

    expect(result.success).toBe(false)
  })

  it('should reject slug with underscores', () => {
    const result = CreateWorkspaceSchema.safeParse({
      name: 'Acme',
      slug: 'acme_co',
    })

    expect(result.success).toBe(false)
  })

  it('should reject name shorter than 2 chars', () => {
    const result = CreateWorkspaceSchema.safeParse({ name: 'A', slug: 'acme' })

    expect(result.success).toBe(false)
  })

  it('should reject slug shorter than 2 chars', () => {
    const result = CreateWorkspaceSchema.safeParse({ name: 'Acme', slug: 'a' })

    expect(result.success).toBe(false)
  })

  it('should reject slug longer than 50 chars', () => {
    const result = CreateWorkspaceSchema.safeParse({
      name: 'Acme',
      slug: 'a'.repeat(51),
    })

    expect(result.success).toBe(false)
  })

  it('should reject name longer than 100 chars', () => {
    const result = CreateWorkspaceSchema.safeParse({
      name: 'A'.repeat(101),
      slug: 'acme',
    })

    expect(result.success).toBe(false)
  })

  it('should reject when name or slug is missing', () => {
    expect(CreateWorkspaceSchema.safeParse({ name: 'Acme' }).success).toBe(
      false,
    )
    expect(CreateWorkspaceSchema.safeParse({ slug: 'acme' }).success).toBe(
      false,
    )
  })
})

describe('UpdateWorkspaceSchema', () => {
  it('should accept empty object (all optional)', () => {
    const result = UpdateWorkspaceSchema.safeParse({})

    expect(result.success).toBe(true)
  })

  it('should accept name only', () => {
    const result = UpdateWorkspaceSchema.safeParse({ name: 'New' })

    expect(result.success).toBe(true)
  })

  it('should accept slug only', () => {
    const result = UpdateWorkspaceSchema.safeParse({ slug: 'new-slug' })

    expect(result.success).toBe(true)
  })

  it('should reject invalid slug pattern', () => {
    const result = UpdateWorkspaceSchema.safeParse({ slug: 'INVALID' })

    expect(result.success).toBe(false)
  })
})

describe('UpdateWorkspaceSchema — Ajustes > Geral', () => {
  it('accepts every company size range and null to clear it', () => {
    for (const companySize of [
      'SIZE_1_10',
      'SIZE_11_50',
      'SIZE_51_200',
      'SIZE_201_1000',
      'SIZE_1000_PLUS',
      null,
    ]) {
      expect(UpdateWorkspaceSchema.safeParse({ companySize }).success).toBe(
        true,
      )
    }
  })

  it('rejects an unknown company size', () => {
    expect(
      UpdateWorkspaceSchema.safeParse({ companySize: '10-20' }).success,
    ).toBe(false)
  })

  it('trims the name', () => {
    expect(UpdateWorkspaceSchema.parse({ name: '  Acme  ' })).toEqual({
      name: 'Acme',
    })
  })

  it('rejects reserved slugs on update and create', () => {
    const update = UpdateWorkspaceSchema.safeParse({ slug: 'admin' })
    expect(update.success).toBe(false)
    expect(update.error?.issues[0]?.message).toBe(
      'Este endereço é reservado. Escolha outro.',
    )
    expect(
      CreateWorkspaceSchema.safeParse({ name: 'Acme', slug: 'settings' })
        .success,
    ).toBe(false)
  })
})

describe('WorkspaceSlugSchema / reserved words', () => {
  it('reserves the top-level routes of the app', () => {
    for (const slug of [
      'admin',
      'api',
      'onboarding',
      'sign-in',
      'status',
      'pricing',
      'suporte',
      'create-workspace',
      'ingest',
    ]) {
      expect(isReservedWorkspaceSlug(slug)).toBe(true)
      expect(WorkspaceSlugSchema.safeParse(slug).success).toBe(false)
    }
  })

  it('keeps every reserved word valid in format (so the message is the reserved one)', () => {
    for (const slug of RESERVED_WORKSPACE_SLUGS) {
      expect(slug).toMatch(/^[a-z0-9-]{2,50}$/)
    }
  })

  it('accepts a normal slug', () => {
    expect(isReservedWorkspaceSlug('stratus-telecom')).toBe(false)
    expect(WorkspaceSlugSchema.safeParse('stratus-telecom').success).toBe(true)
  })
})

describe('WorkspaceSlugAvailabilityQuerySchema', () => {
  it('normalizes the slug', () => {
    expect(
      WorkspaceSlugAvailabilityQuerySchema.parse({ slug: '  Acme ' }),
    ).toEqual({ slug: 'acme' })
  })

  it('requires a slug', () => {
    expect(WorkspaceSlugAvailabilityQuerySchema.safeParse({}).success).toBe(
      false,
    )
    expect(
      WorkspaceSlugAvailabilityQuerySchema.safeParse({ slug: ' ' }).success,
    ).toBe(false)
  })
})

describe('DeleteWorkspaceRequestSchema', () => {
  it('requires the typed confirmation', () => {
    expect(
      DeleteWorkspaceRequestSchema.parse({ confirmation: ' acme ' }),
    ).toEqual({ confirmation: 'acme' })
    const empty = DeleteWorkspaceRequestSchema.safeParse({ confirmation: '' })
    expect(empty.success).toBe(false)
    expect(empty.error?.issues[0]?.message).toBe(
      'Digite o endereço do workspace para confirmar',
    )
    expect(DeleteWorkspaceRequestSchema.safeParse({}).success).toBe(false)
  })
})
