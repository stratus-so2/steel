import { describe, expect, it } from 'vitest'
import {
  formatCnpj,
  isCompleteCnpj,
  isValidCnpj,
  normalizeCnpj,
} from '../crm-cnpj'

describe('normalizeCnpj', () => {
  it('mantém apenas os dígitos (máx. 14)', () => {
    expect(normalizeCnpj('11.222.333/0001-81')).toBe('11222333000181')
    expect(normalizeCnpj('11222333000181999')).toBe('11222333000181')
  })
})

describe('formatCnpj', () => {
  it('formata completo e parcial', () => {
    expect(formatCnpj('11222333000181')).toBe('11.222.333/0001-81')
    expect(formatCnpj('112223')).toBe('11.222.3')
    expect(formatCnpj('')).toBe('')
  })
})

describe('isCompleteCnpj', () => {
  it('exige 14 dígitos', () => {
    expect(isCompleteCnpj('11.222.333/0001-81')).toBe(true)
    expect(isCompleteCnpj('112223330001')).toBe(false)
  })
})

describe('isValidCnpj', () => {
  it('aceita um CNPJ com dígitos verificadores válidos', () => {
    expect(isValidCnpj('11.222.333/0001-81')).toBe(true)
  })

  it('rejeita dígitos verificadores incorretos', () => {
    expect(isValidCnpj('11222333000180')).toBe(false)
  })

  it('rejeita sequências repetidas e tamanhos errados', () => {
    expect(isValidCnpj('00000000000000')).toBe(false)
    expect(isValidCnpj('123')).toBe(false)
  })
})
