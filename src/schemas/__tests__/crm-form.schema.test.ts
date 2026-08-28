import { describe, expect, it } from 'vitest'
import {
  CreateCrmFormSchema,
  groupFieldsByPhase,
  SubmitCrmFormSchema,
  UpdateCrmFormSchema,
} from '../crm-form.schema'

describe('CreateCrmFormSchema', () => {
  it('should default action to LEAD and fields to empty', () => {
    const result = CreateCrmFormSchema.safeParse({ name: 'Contato' })
    expect(result.success).toBe(true)
    expect(result.data?.action).toBe('LEAD')
    expect(result.data?.fields).toEqual([])
  })

  it('should accept a valid field definition with mapping', () => {
    const result = CreateCrmFormSchema.safeParse({
      name: 'Contato',
      fields: [
        {
          key: 'email',
          label: 'E-mail',
          type: 'email',
          mapping: { target: 'lead', attribute: 'email' },
        },
      ],
    })
    expect(result.success).toBe(true)
    expect(result.data?.fields[0].required).toBe(false)
  })

  it('should reject an invalid field type', () => {
    const result = CreateCrmFormSchema.safeParse({
      name: 'Contato',
      fields: [
        {
          key: 'x',
          label: 'X',
          type: 'invalid',
          mapping: { target: 'lead', attribute: 'name' },
        },
      ],
    })
    expect(result.success).toBe(false)
  })

  it('should reject a mapping attribute not valid for the target', () => {
    const result = CreateCrmFormSchema.safeParse({
      name: 'Contato',
      fields: [
        {
          key: 'x',
          label: 'X',
          type: 'text',
          mapping: { target: 'person', attribute: 'arr' },
        },
      ],
    })
    expect(result.success).toBe(false)
  })

  it('should reject duplicate field keys', () => {
    const result = CreateCrmFormSchema.safeParse({
      name: 'Contato',
      fields: [
        {
          key: 'name',
          label: 'Nome',
          type: 'text',
          mapping: { target: 'lead', attribute: 'name' },
        },
        {
          key: 'name',
          label: 'Nome 2',
          type: 'text',
          mapping: { target: 'lead', attribute: 'company' },
        },
      ],
    })
    expect(result.success).toBe(false)
  })

  it('should require at least one option for a select field', () => {
    const result = CreateCrmFormSchema.safeParse({
      name: 'Contato',
      fields: [
        {
          key: 'source',
          label: 'Origem',
          type: 'select',
          mapping: { target: 'lead', attribute: 'source' },
        },
      ],
    })
    expect(result.success).toBe(false)
  })

  it('should accept a select field with options', () => {
    const result = CreateCrmFormSchema.safeParse({
      name: 'Contato',
      fields: [
        {
          key: 'source',
          label: 'Origem',
          type: 'select',
          options: [{ label: 'Site', value: 'site' }],
          mapping: { target: 'lead', attribute: 'source' },
        },
      ],
    })
    expect(result.success).toBe(true)
  })
})

describe('UpdateCrmFormSchema', () => {
  it('should accept an empty payload', () => {
    expect(UpdateCrmFormSchema.safeParse({}).success).toBe(true)
  })

  it('should accept a status transition', () => {
    expect(UpdateCrmFormSchema.safeParse({ status: 'PUBLISHED' }).success).toBe(
      true,
    )
  })

  it('should skip cross-validation when only fields or only phases is sent', () => {
    expect(
      UpdateCrmFormSchema.safeParse({
        fields: [
          {
            key: 'x',
            label: 'X',
            type: 'text',
            mapping: { target: 'lead', attribute: 'name' },
            phaseId: 'ghost-phase',
          },
        ],
      }).success,
    ).toBe(true)
  })
})

describe('phases', () => {
  it('should accept a form with multiple phases and fields referencing them', () => {
    const result = CreateCrmFormSchema.safeParse({
      name: 'Contato',
      phases: [
        { id: 'p1', title: 'Sobre você' },
        { id: 'p2', title: 'Sobre a empresa' },
      ],
      fields: [
        {
          key: 'name',
          label: 'Nome',
          type: 'text',
          mapping: { target: 'lead', attribute: 'name' },
          phaseId: 'p1',
        },
        {
          key: 'company',
          label: 'Empresa',
          type: 'text',
          mapping: { target: 'lead', attribute: 'company' },
          phaseId: 'p2',
        },
      ],
    })
    expect(result.success).toBe(true)
  })

  it('should reject a duplicate phase id', () => {
    const result = CreateCrmFormSchema.safeParse({
      name: 'Contato',
      phases: [
        { id: 'p1', title: 'Fase 1' },
        { id: 'p1', title: 'Fase repetida' },
      ],
    })
    expect(result.success).toBe(false)
  })

  it('should reject a field referencing an unknown phaseId', () => {
    const result = CreateCrmFormSchema.safeParse({
      name: 'Contato',
      phases: [{ id: 'p1', title: 'Fase 1' }],
      fields: [
        {
          key: 'name',
          label: 'Nome',
          type: 'text',
          mapping: { target: 'lead', attribute: 'name' },
          phaseId: 'inexistente',
        },
      ],
    })
    expect(result.success).toBe(false)
  })

  it('should reject more than 10 phases', () => {
    const phases = Array.from({ length: 11 }, (_, i) => ({
      id: `p${i}`,
      title: `Fase ${i}`,
    }))
    expect(
      CreateCrmFormSchema.safeParse({ name: 'Contato', phases }).success,
    ).toBe(false)
  })
})

describe('groupFieldsByPhase()', () => {
  const phases = [
    { id: 'p1', title: 'Fase 1' },
    { id: 'p2', title: 'Fase 2' },
  ]
  const mapping = { target: 'lead' as const, attribute: 'name' }

  it('should return an empty array when there are no phases', () => {
    expect(groupFieldsByPhase([], [])).toEqual([])
  })

  it('should group fields under their referenced phase, preserving order', () => {
    const fields = [
      {
        key: 'a',
        label: 'A',
        type: 'text' as const,
        required: false,
        mapping,
        phaseId: 'p2',
      },
      {
        key: 'b',
        label: 'B',
        type: 'text' as const,
        required: false,
        mapping,
        phaseId: 'p1',
      },
    ]
    const grouped = groupFieldsByPhase(fields, phases)
    expect(grouped[0].fields.map((f) => f.key)).toEqual(['b'])
    expect(grouped[1].fields.map((f) => f.key)).toEqual(['a'])
  })

  it('should fall back orphaned/missing phaseId fields to the first phase', () => {
    const fields = [
      { key: 'a', label: 'A', type: 'text' as const, required: false, mapping },
      {
        key: 'b',
        label: 'B',
        type: 'text' as const,
        required: false,
        mapping,
        phaseId: 'phase-that-no-longer-exists',
      },
    ]
    const grouped = groupFieldsByPhase(fields, phases)
    expect(grouped[0].fields.map((f) => f.key)).toEqual(['a', 'b'])
    expect(grouped[1].fields).toEqual([])
  })
})

describe('SubmitCrmFormSchema', () => {
  it('should accept a record of string and boolean values', () => {
    expect(
      SubmitCrmFormSchema.safeParse({
        values: { name: 'Jane', subscribe: true },
      }).success,
    ).toBe(true)
  })
})
