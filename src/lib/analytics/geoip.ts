import { access } from 'node:fs/promises'
import { isIP } from 'node:net'
import type { CityResponse } from 'maxmind'
import { logger } from '@/lib/axiom/logger'
import { GEOIP_DB_PATH } from '@/lib/env/server'

/**
 * País/cidade a partir do IP do cliente, com a base gratuita MaxMind
 * GeoLite2 City (`GEOIP_DB_PATH`). LGPD: o IP só é usado aqui, em memória,
 * durante o log — nunca é gravado nem exibido; o log leva só país/cidade.
 * Sem o arquivo (ou sem a variável), o enriquecimento é pulado em silêncio.
 */

export interface GeoLocation {
  country: string | null
  countryCode: string | null
  city: string | null
}

export interface GeoLookup {
  lookup(ip: string): GeoLocation | null
}

export type GeoOpener = (path: string) => Promise<GeoLookup>

interface Names {
  names?: { readonly [locale: string]: string | undefined } | object
}
interface CityRecord {
  country?: Names & { iso_code?: string }
  registered_country?: Names & { iso_code?: string }
  city?: Names
}

const pick = (record: Names | undefined): string | null => {
  const names = record?.names as Record<string, string | undefined> | undefined
  return names?.['pt-BR'] ?? names?.en ?? null
}

/** Converte um registro GeoLite2 City (formato MaxMind) em país/cidade. */
export function toGeoLocation(record: CityRecord | null): GeoLocation | null {
  if (!record) return null
  const country = record.country ?? record.registered_country
  const location = {
    country: pick(country),
    countryCode: country?.iso_code ?? null,
    city: pick(record.city),
  }
  return location.country || location.city ? location : null
}

const openMaxmind: GeoOpener = async (path) => {
  const maxmind = await import('maxmind')
  const reader = await maxmind.open<CityResponse>(path, {
    cache: { max: 5000 },
    // O geoipupdate troca o arquivo no lugar: recarrega sem reiniciar.
    watchForUpdates: true,
    watchForUpdatesNonPersistent: true,
  })
  return { lookup: (ip) => toGeoLocation(reader.get(ip)) }
}

let pending: Promise<GeoLookup | null> | null = null

/** Abre a base uma vez (lazy); `null` quando não configurada/ausente. */
export function getGeoLookup(
  path: string | undefined = GEOIP_DB_PATH,
  opener: GeoOpener = openMaxmind,
): Promise<GeoLookup | null> {
  if (pending) return pending
  pending = (async () => {
    if (!path) return null
    try {
      await access(path)
    } catch {
      return null
    }
    try {
      return await opener(path)
    } catch (cause) {
      logger.warn('analytics.geoip.open_failed', {
        message: cause instanceof Error ? cause.message : String(cause),
      })
      return null
    }
  })()
  return pending
}

/** Testes: esquece a base aberta. */
export function resetGeoLookup(): void {
  pending = null
}

const PRIVATE_V4 =
  /^(10\.|127\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/

export function isPublicIp(ip: string): boolean {
  const version = isIP(ip)
  if (version === 4) return !PRIVATE_V4.test(ip)
  if (version === 6) {
    const lower = ip.toLowerCase()
    return !(
      lower === '::1' ||
      lower === '::' ||
      lower.startsWith('fc') ||
      lower.startsWith('fd') ||
      lower.startsWith('fe80')
    )
  }
  return false
}

/**
 * IP real do cliente atrás do nginx: primeiro salto do `X-Forwarded-For`
 * (o nginx precisa repassá-lo — ver docs/admin-analytics.md), com
 * `X-Real-IP` de reserva. `null` se ausente ou inválido.
 */
export function clientIpFrom(headers: Headers): string | null {
  const forwarded = headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  const candidate = forwarded || headers.get('x-real-ip')?.trim() || ''
  const ip = candidate.replace(/^::ffff:(?=\d+\.\d+\.\d+\.\d+$)/i, '')
  return isIP(ip) ? ip : null
}

/** País/cidade do cliente da requisição (ou `null`). Nunca lança. */
export async function geolocateRequest(
  headers: Headers,
  lookup: Promise<GeoLookup | null> = getGeoLookup(),
): Promise<GeoLocation | null> {
  const ip = clientIpFrom(headers)
  if (!ip || !isPublicIp(ip)) return null
  try {
    return (await lookup)?.lookup(ip) ?? null
  } catch {
    return null
  }
}
