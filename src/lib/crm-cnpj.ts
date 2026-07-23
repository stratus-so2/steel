/**
 * Consulta de CNPJ (client-side) via BrasilAPI (`/api/cnpj/v1/{cnpj}`), que
 * espelha a base pública da Receita Federal. Usado para preencher os dados
 * de uma CrmCompany (razão social, nome fantasia, endereço) a partir do
 * CNPJ digitado.
 */

import { formatCep } from '@/src/lib/crm-cep'

/** Mantém apenas os dígitos do CNPJ (máx. 14). */
export function normalizeCnpj(value: string): string {
  return value.replace(/\D/g, '').slice(0, 14)
}

/** Formata como `00.000.000/0000-00` (parcial enquanto digita). */
export function formatCnpj(value: string): string {
  const d = normalizeCnpj(value)
  let out = d.slice(0, 2)
  if (d.length > 2) out += `.${d.slice(2, 5)}`
  if (d.length > 5) out += `.${d.slice(5, 8)}`
  if (d.length > 8) out += `/${d.slice(8, 12)}`
  if (d.length > 12) out += `-${d.slice(12, 14)}`
  return out
}

/** `true` quando o CNPJ tem os 14 dígitos. */
export function isCompleteCnpj(value: string): boolean {
  return normalizeCnpj(value).length === 14
}

/** Valida os dois dígitos verificadores do CNPJ. */
export function isValidCnpj(value: string): boolean {
  const d = normalizeCnpj(value)
  if (d.length !== 14) return false
  // Rejeita sequências repetidas (ex.: 00000000000000), que passam no cálculo.
  if (/^(\d)\1{13}$/.test(d)) return false

  const digit = (slice: string, start: number): number => {
    let sum = 0
    let weight = start
    for (const char of slice) {
      sum += Number(char) * weight
      weight = weight === 2 ? 9 : weight - 1
    }
    const mod = sum % 11
    return mod < 2 ? 0 : 11 - mod
  }

  const dv1 = digit(d.slice(0, 12), 5)
  const dv2 = digit(d.slice(0, 13), 6)
  return dv1 === Number(d[12]) && dv2 === Number(d[13])
}

export type CrmCompanyAddressInput = {
  street?: string
  number?: string
  complement?: string
  neighborhood?: string
  city?: string
  state?: string
  zipCode?: string
}

/** Resultado da consulta: campos prontos para preencher a grade da empresa. */
export type CnpjLookup = {
  cnpj: string
  razaoSocial?: string
  nomeFantasia?: string
  /** Melhor nome de exibição: nome fantasia, ou razão social como fallback. */
  name?: string
  address: CrmCompanyAddressInput | null
}

/** Subconjunto da resposta da BrasilAPI que consumimos. */
type BrasilApiCnpjResponse = {
  razao_social?: string
  nome_fantasia?: string
  cep?: string
  logradouro?: string
  numero?: string
  complemento?: string
  bairro?: string
  municipio?: string
  uf?: string
  message?: string
}

export class CnpjNotFoundError extends Error {
  constructor() {
    super('CNPJ não encontrado')
    this.name = 'CnpjNotFoundError'
  }
}

/** Normaliza um texto da Receita (pode vir vazio) em campo opcional. */
function text(value: string | undefined): string | undefined {
  const t = value?.trim()
  return t ? t : undefined
}

/** Monta o endereço a partir da resposta; `null` se nada útil veio. */
function toAddress(data: BrasilApiCnpjResponse): CrmCompanyAddressInput | null {
  const address: CrmCompanyAddressInput = {
    zipCode: data.cep ? formatCep(data.cep) : undefined,
    street: text(data.logradouro),
    number: text(data.numero),
    complement: text(data.complemento),
    neighborhood: text(data.bairro),
    city: text(data.municipio),
    state: text(data.uf)?.toUpperCase(),
  }
  const hasValue = Object.values(address).some((v) => v !== undefined)
  return hasValue ? address : null
}

/**
 * Resolve um CNPJ nos dados da empresa. Lança `CnpjNotFoundError` quando o
 * CNPJ não existe na base e `Error` genérico em falha de rede.
 */
export async function lookupCnpj(
  rawCnpj: string,
  signal?: AbortSignal,
): Promise<CnpjLookup> {
  const cnpj = normalizeCnpj(rawCnpj)
  if (cnpj.length !== 14) throw new CnpjNotFoundError()

  const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, {
    signal,
  })
  if (res.status === 404) throw new CnpjNotFoundError()
  if (!res.ok) throw new Error('Falha ao consultar o CNPJ')

  const data = (await res.json()) as BrasilApiCnpjResponse
  const razaoSocial = text(data.razao_social)
  const nomeFantasia = text(data.nome_fantasia)

  return {
    cnpj: formatCnpj(cnpj),
    razaoSocial,
    nomeFantasia,
    name: nomeFantasia ?? razaoSocial,
    address: toAddress(data),
  }
}
