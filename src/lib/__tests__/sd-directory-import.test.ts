import { describe, expect, it } from 'vitest'
import {
  mapSdContactImportRecord,
  mapSdCustomerImportRecord,
} from '@/src/lib/servicedesk/directory-import'

describe('servicedesk/directory-import', () => {
  it('maps customer columns by their pt-BR/en aliases', () => {
    expect(
      mapSdCustomerImportRecord({
        razao_social: 'Acme Ltda',
        nome_fantasia: 'Acme',
        cnpj: '11.222.333/0001-81',
        e_mail: 'a@acme.com',
        celular: '11987654321',
        cep: '01001-000',
        uf: 'SP',
        ignorada: 'x',
        obs: '',
      }),
    ).toEqual({
      name: 'Acme Ltda',
      tradeName: 'Acme',
      document: '11.222.333/0001-81',
      email: 'a@acme.com',
      whatsapp: '11987654321',
      zipCode: '01001-000',
      state: 'SP',
    })
  })

  it('maps contact columns including the customer document', () => {
    expect(
      mapSdContactImportRecord({
        nome: 'Ana',
        cargo: 'TI',
        cnpj_cliente: '11222333000181',
      }),
    ).toEqual({
      name: 'Ana',
      jobTitle: 'TI',
      customerDocument: '11222333000181',
    })
    expect(mapSdContactImportRecord({})).toEqual({})
  })
})
