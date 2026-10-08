import { describe, expect, it } from 'vitest'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { parseMemberImportCsv } from '@/src/lib/members/member-import-csv'
import { MEMBER_IMPORT_MAX_ROWS } from '@/src/schemas/member.schema'

describe('parseMemberImportCsv()', () => {
  it('reads email and role, defaulting the role to MEMBER', () => {
    const rows = expectOk(
      parseMemberImportCsv(
        'email,role\nAna@Empresa.com,ADMIN\nbruno@empresa.com,\n',
      ),
    )
    expect(rows).toEqual([
      { email: 'ana@empresa.com', role: 'ADMIN' },
      { email: 'bruno@empresa.com', role: 'MEMBER' },
    ])
  })

  it('accepts the Excel pt-BR layout: ";", "E-mail" and "Cargo" in Portuguese', () => {
    const rows = expectOk(
      parseMemberImportCsv(
        '﻿E-mail;Cargo;Nome\r\nana@x.com;Administrador;Ana\r\nbia@x.com; visualizador ;Bia\r\ncid@x.com;membro;Cid\r\n',
      ),
    )
    expect(rows).toEqual([
      { email: 'ana@x.com', role: 'ADMIN' },
      { email: 'bia@x.com', role: 'VIEWER' },
      { email: 'cid@x.com', role: 'MEMBER' },
    ])
  })

  it('requires an e-mail column', () => {
    const error = expectErr(
      parseMemberImportCsv('nome\nAna\n'),
      'VALIDATION_ERROR',
    )
    expect(error.message).toBe('A planilha precisa de uma coluna "email"')
  })

  it('rejects a spreadsheet without data rows', () => {
    const error = expectErr(parseMemberImportCsv('email\n'), 'VALIDATION_ERROR')
    expect(error.message).toBe('A planilha não tem nenhuma linha de dados')
  })

  it('caps the number of rows', () => {
    const body = Array.from(
      { length: MEMBER_IMPORT_MAX_ROWS + 1 },
      (_, i) => `u${i}@x.com`,
    ).join('\n')
    const error = expectErr(
      parseMemberImportCsv(`email\n${body}`),
      'VALIDATION_ERROR',
    )
    expect(error.message).toContain(String(MEMBER_IMPORT_MAX_ROWS))
  })

  it('points at the file line of the first invalid row', () => {
    const badEmail = expectErr(
      parseMemberImportCsv('email\nok@x.com\nnot-an-email\n'),
      'VALIDATION_ERROR',
    )
    expect(badEmail.message).toBe('Linha 3 inválida: E-mail inválido')

    const badRole = expectErr(
      parseMemberImportCsv('email,role\nok@x.com,OWNER\n'),
      'VALIDATION_ERROR',
    )
    expect(badRole.message).toBe(
      'Linha 2 inválida: Cargo inválido: use ADMIN, MEMBER ou VIEWER',
    )
  })

  it('reports a row with an empty e-mail', () => {
    const error = expectErr(
      parseMemberImportCsv('email,role\n,ADMIN\n'),
      'VALIDATION_ERROR',
    )
    expect(error.message).toMatch(/^Linha 2 inválida: /)
  })
})
