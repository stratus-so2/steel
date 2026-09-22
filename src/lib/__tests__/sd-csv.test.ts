import { describe, expect, it } from 'vitest'
import {
  csvToRecords,
  detectCsvDelimiter,
  normalizeCsvHeader,
  parseCsv,
  pickCsvValue,
} from '@/src/lib/servicedesk/csv'

describe('servicedesk/csv', () => {
  it('detects ; (Excel pt-BR) or , from the first line', () => {
    expect(detectCsvDelimiter('nome;cnpj\nA;1')).toBe(';')
    expect(detectCsvDelimiter('nome,cnpj\nA,1')).toBe(',')
    expect(detectCsvDelimiter('')).toBe(',')
  })

  it('parses quotes, escaped quotes, embedded newlines, CRLF and BOM', () => {
    const text =
      '﻿nome,obs\r\n"Acme, Ltda","disse ""oi""\nna linha 2"\r\nBeta,\r\n\r\n'
    expect(parseCsv(text)).toEqual([
      ['nome', 'obs'],
      ['Acme, Ltda', 'disse "oi"\nna linha 2'],
      ['Beta', ''],
    ])
  })

  it('handles a lone CR as line break and a trailing row without newline', () => {
    expect(parseCsv('a;b\r1;2', ';')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ])
  })

  it('normalizes headers', () => {
    expect(normalizeCsvHeader(' Razão Social ')).toBe('razao_social')
    expect(normalizeCsvHeader('E-mail')).toBe('e_mail')
    expect(normalizeCsvHeader('CPF/CNPJ')).toBe('cpf_cnpj')
  })

  it('maps rows to records by normalized header, trimming values', () => {
    expect(csvToRecords('Nome;CNPJ;;\n Acme ;112\nSó nome')).toEqual({
      headers: ['nome', 'cnpj', '', ''],
      records: [
        { nome: 'Acme', cnpj: '112' },
        { nome: 'Só nome', cnpj: '' },
      ],
    })
    expect(csvToRecords('')).toEqual({ headers: [], records: [] })
  })

  it('picks the first non-empty alias', () => {
    const record = { cpf: '', cnpj: '112', documento: '999' }
    expect(pickCsvValue(record, ['cpf', 'cnpj', 'documento'])).toBe('112')
    expect(pickCsvValue(record, ['x'])).toBeUndefined()
  })
})
