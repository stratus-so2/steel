import { logger } from '@/lib/axiom/logger'
import { SdCepCache } from '@/src/cache/sd-cep.cache'
import { sdCepLookupFailed, sdCepNotFound, validationError } from '@/src/errors'
import { err, ok, type Result } from '@/src/lib/result'
import type { SdCepAddress } from '@/types/sd-cep'

/**
 * Consulta de CEP no ViaCEP (servidor), com cache de 30 dias no Redis.
 * Usado pelo endereço de clientes/empresas do ServiceDesk
 * (`GET /api/workspaces/{id}/servicedesk/cep/{cep}`).
 */

export const VIACEP_TIMEOUT_MS = 4000

/** Mantém só os dígitos (máx. 8). */
export function normalizeCep(value: string): string {
  return value.replace(/\D/g, '').slice(0, 8)
}

/** `00000-000` (parcial enquanto digita). */
export function formatCep(value: string): string {
  const digits = normalizeCep(value)
  if (digits.length <= 5) return digits
  return `${digits.slice(0, 5)}-${digits.slice(5)}`
}

type ViaCepResponse = {
  cep?: string
  logradouro?: string
  complemento?: string
  bairro?: string
  localidade?: string
  uf?: string
  ibge?: string
  erro?: boolean | string
}

function text(value: string | undefined): string | null {
  const t = value?.trim()
  return t ? t : null
}

function toAddress(zipCode: string, data: ViaCepResponse): SdCepAddress {
  return {
    zipCode,
    street: text(data.logradouro),
    complement: text(data.complemento),
    district: text(data.bairro),
    city: text(data.localidade),
    state: text(data.uf)?.toUpperCase() ?? null,
    ibgeCode: text(data.ibge),
  }
}

export async function lookupCep(
  rawCep: string,
  options: { timeoutMs?: number } = {},
): Promise<Result<SdCepAddress>> {
  // Um CEP com letras ou tamanho errado nem chega ao ViaCEP.
  const cep = rawCep.replace(/[\s.-]/g, '')
  if (!/^\d{8}$/.test(cep)) {
    return err(validationError('CEP inválido: informe os 8 dígitos'))
  }

  const cached = await SdCepCache.get(cep)
  if (cached) return ok(cached)

  let data: ViaCepResponse
  try {
    const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`, {
      signal: AbortSignal.timeout(options.timeoutMs ?? VIACEP_TIMEOUT_MS),
      headers: { Accept: 'application/json' },
    })
    // ViaCEP responde 400 para formato inválido; 5xx/429 = indisponível.
    if (res.status === 400) return err(sdCepNotFound())
    if (!res.ok) {
      logger.warn('servicedesk.cep.lookup_failed', { status: res.status })
      return err(sdCepLookupFailed())
    }
    data = (await res.json()) as ViaCepResponse
  } catch (cause) {
    logger.warn('servicedesk.cep.lookup_failed', {
      message: cause instanceof Error ? cause.message : String(cause),
    })
    return err(sdCepLookupFailed())
  }

  if (data.erro) return err(sdCepNotFound())

  const address = toAddress(cep, data)
  await SdCepCache.set(cep, address)
  return ok(address)
}
