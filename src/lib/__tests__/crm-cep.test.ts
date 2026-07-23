import { describe, expect, it } from 'vitest'
import { formatCep, isCompleteCep, normalizeCep } from '../crm-cep'

describe('normalizeCep', () => {
  it('mantém apenas os dígitos (máx. 8)', () => {
    expect(normalizeCep('01310-100')).toBe('01310100')
    expect(normalizeCep('013101009999')).toBe('01310100')
  })
})

describe('formatCep', () => {
  it('formata completo e parcial', () => {
    expect(formatCep('01310100')).toBe('01310-100')
    expect(formatCep('0131')).toBe('0131')
    expect(formatCep('')).toBe('')
  })
})

describe('isCompleteCep', () => {
  it('exige 8 dígitos', () => {
    expect(isCompleteCep('01310-100')).toBe(true)
    expect(isCompleteCep('01310')).toBe(false)
  })
})
