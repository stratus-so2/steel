/**
 * Consulta de CEP (client-side) via ViaCEP. Usado para preencher o endereço
 * de uma CrmCompany a partir do CEP digitado.
 */

export type CepLookup = {
  cep: string
  street?: string
  neighborhood?: string
  city?: string
  state?: string
}

/** Mantém apenas os dígitos do CEP. */
export function normalizeCep(value: string): string {
  return value.replace(/\D/g, '').slice(0, 8)
}

/** Formata o CEP como `00000-000` (parcial enquanto digita). */
export function formatCep(value: string): string {
  const digits = normalizeCep(value)
  if (digits.length <= 5) return digits
  return `${digits.slice(0, 5)}-${digits.slice(5)}`
}

/** `true` quando o CEP tem os 8 dígitos. */
export function isCompleteCep(value: string): boolean {
  return normalizeCep(value).length === 8
}

type ViaCepResponse = {
  cep?: string
  logradouro?: string
  bairro?: string
  localidade?: string
  uf?: string
  erro?: boolean | string
}

export class CepNotFoundError extends Error {
  constructor() {
    super('CEP não encontrado')
    this.name = 'CepNotFoundError'
  }
}

/**
 * Resolve um CEP em endereço. Lança `CepNotFoundError` quando o CEP não
 * existe e `Error` genérico em falha de rede.
 */
export async function lookupCep(
  rawCep: string,
  signal?: AbortSignal,
): Promise<CepLookup> {
  const cep = normalizeCep(rawCep)
  if (cep.length !== 8) throw new CepNotFoundError()

  const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`, { signal })
  if (!res.ok) throw new Error('Falha ao consultar o CEP')

  const data = (await res.json()) as ViaCepResponse
  if (data.erro) throw new CepNotFoundError()

  return {
    cep: formatCep(cep),
    street: data.logradouro || undefined,
    neighborhood: data.bairro || undefined,
    city: data.localidade || undefined,
    state: data.uf || undefined,
  }
}
