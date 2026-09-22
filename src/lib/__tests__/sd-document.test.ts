import { describe, expect, it } from 'vitest'
import {
  detectDocumentKind,
  detectPersonType,
  formatDocument,
  formatPhone,
  isValidCnpj,
  isValidCpf,
  normalizeDocument,
  normalizePhone,
  validateDocument,
  whatsappLink,
} from '@/src/lib/servicedesk/document'

describe('servicedesk/document', () => {
  describe('normalizeDocument()', () => {
    it('strips the mask, uppercases and caps at 14 chars', () => {
      expect(normalizeDocument('529.982.247-25')).toBe('52998224725')
      expect(normalizeDocument('12.abc.345/01de-35')).toBe('12ABC34501DE35')
      expect(normalizeDocument('11.222.333/0001-81999')).toBe('11222333000181')
    })
  })

  describe('isValidCpf()', () => {
    it('accepts a valid CPF with or without mask', () => {
      expect(isValidCpf('529.982.247-25')).toBe(true)
      expect(isValidCpf('52998224725')).toBe(true)
    })

    it('rejects wrong check digits, repeated sequences and bad lengths', () => {
      expect(isValidCpf('529.982.247-24')).toBe(false)
      expect(isValidCpf('529.982.247-15')).toBe(false)
      expect(isValidCpf('111.111.111-11')).toBe(false)
      expect(isValidCpf('5299822472')).toBe(false)
    })

    it('handles the "remainder 10 → 0" rule', () => {
      // Primeiro DV: (210 × 10) mod 11 = 10 → 0.
      expect(isValidCpf('123.456.789-09')).toBe(true)
    })
  })

  describe('isValidCnpj()', () => {
    it('accepts a valid numeric CNPJ', () => {
      expect(isValidCnpj('11.222.333/0001-81')).toBe(true)
    })

    it('accepts the 2026 alphanumeric CNPJ (ASCII − 48 rule)', () => {
      expect(isValidCnpj('12.ABC.345/01DE-35')).toBe(true)
      expect(isValidCnpj('12abc34501de35')).toBe(true)
    })

    it('rejects wrong check digits, repeated digits, letters in the DV and bad lengths', () => {
      expect(isValidCnpj('11.222.333/0001-82')).toBe(false)
      expect(isValidCnpj('11.222.333/0001-91')).toBe(false)
      expect(isValidCnpj('12ABC34501DE36')).toBe(false)
      expect(isValidCnpj('00000000000000')).toBe(false)
      expect(isValidCnpj('12ABC34501DE3A')).toBe(false)
      expect(isValidCnpj('1122233300018')).toBe(false)
    })

    it('handles check digits whose remainder is below 2', () => {
      // 33.000.167/0001-01: o primeiro DV tem resto < 2 → 0.
      expect(isValidCnpj('33.000.167/0001-01')).toBe(true)
    })
  })

  describe('detectDocumentKind() / detectPersonType()', () => {
    it('detects CPF (11 digits) and CNPJ (14 chars)', () => {
      expect(detectDocumentKind('529.982.247-25')).toBe('CPF')
      expect(detectDocumentKind('11.222.333/0001-81')).toBe('CNPJ')
      expect(detectDocumentKind('12ABC34501DE35')).toBe('CNPJ')
      expect(detectDocumentKind('1234')).toBeNull()
      expect(detectDocumentKind('12ABC345012')).toBeNull()
    })

    it('maps to INDIVIDUAL / LEGAL / null', () => {
      expect(detectPersonType('52998224725')).toBe('INDIVIDUAL')
      expect(detectPersonType('11222333000181')).toBe('LEGAL')
      expect(detectPersonType('')).toBeNull()
    })
  })

  describe('validateDocument()', () => {
    it('returns the normalized value and kind for valid documents', () => {
      expect(validateDocument('529.982.247-25')).toEqual({
        valid: true,
        kind: 'CPF',
        normalized: '52998224725',
      })
      expect(validateDocument('11.222.333/0001-81')).toEqual({
        valid: true,
        kind: 'CNPJ',
        normalized: '11222333000181',
      })
    })

    it('flags invalid documents keeping the detected kind', () => {
      expect(validateDocument('529.982.247-00')).toEqual({
        valid: false,
        kind: 'CPF',
        normalized: '52998224700',
      })
      expect(validateDocument('11.222.333/0001-00').valid).toBe(false)
      expect(validateDocument('123')).toEqual({
        valid: false,
        kind: null,
        normalized: '123',
      })
    })
  })

  describe('formatDocument()', () => {
    it('masks CPF progressively', () => {
      expect(formatDocument('529')).toBe('529')
      expect(formatDocument('5299')).toBe('529.9')
      expect(formatDocument('5299822')).toBe('529.982.2')
      expect(formatDocument('52998224725')).toBe('529.982.247-25')
    })

    it('masks CNPJ progressively (numeric and alphanumeric)', () => {
      expect(formatDocument('112223330001')).toBe('11.222.333/0001')
      expect(formatDocument('11222333000181')).toBe('11.222.333/0001-81')
      expect(formatDocument('12A')).toBe('12.A')
      expect(formatDocument('12ABC3')).toBe('12.ABC.3')
      expect(formatDocument('12ABC34501DE35')).toBe('12.ABC.345/01DE-35')
    })
  })

  describe('phones', () => {
    it('normalizes BR numbers to digits with the 55 country code', () => {
      expect(normalizePhone('(11) 98765-4321')).toBe('5511987654321')
      expect(normalizePhone('(11) 3333-4444')).toBe('551133334444')
      expect(normalizePhone('+55 11 98765-4321')).toBe('5511987654321')
      expect(normalizePhone('+44 20 7946 0958')).toBe('442079460958')
      expect(normalizePhone('')).toBeNull()
      expect(normalizePhone('abc')).toBeNull()
      expect(normalizePhone(null)).toBeNull()
      expect(normalizePhone(undefined)).toBeNull()
    })

    it('formats phones for display', () => {
      expect(formatPhone('5511987654321')).toBe('+55 (11) 98765-4321')
      expect(formatPhone('551133334444')).toBe('+55 (11) 3333-4444')
      expect(formatPhone('11987654321')).toBe('+55 (11) 98765-4321')
      expect(formatPhone('442079460958')).toBe('+442079460958')
      expect(formatPhone(null)).toBe('')
    })

    it('builds the wa.me link', () => {
      expect(whatsappLink('(11) 98765-4321')).toBe(
        'https://wa.me/5511987654321',
      )
      expect(whatsappLink('')).toBeNull()
    })
  })
})
