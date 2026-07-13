import 'server-only'
import {
  type SecretConfig,
  symmetricDecrypt,
  symmetricEncrypt,
} from 'better-auth/crypto'
import { CONNECTION_SECRETS } from '@/lib/env/server'

function parseConnectionSecrets(value: string): SecretConfig {
  const keys = new Map<number, string>()
  let currentVersion: number | undefined

  for (const entry of value.split(',')) {
    const trimmed = entry.trim()
    const colonIdx = trimmed.indexOf(':')
    if (colonIdx === -1) {
      throw new Error(
        `Invalid CONNECTION_SECRETS entry: "${trimmed}". Expected format: "<version>:<secret>"`,
      )
    }

    const version = Number.parseInt(trimmed.slice(0, colonIdx), 10)
    const secret = trimmed.slice(colonIdx + 1).trim()
    if (!Number.isInteger(version) || version < 0 || !secret) {
      throw new Error(`Invalid CONNECTION_SECRETS entry: "${trimmed}"`)
    }

    keys.set(version, secret)
    if (currentVersion === undefined) currentVersion = version
  }

  if (currentVersion === undefined) {
    throw new Error(
      'CONNECTION_SECRETS must contain at least one "<version>:<secret>" entry',
    )
  }

  return { keys, currentVersion }
}

const secretConfig = parseConnectionSecrets(CONNECTION_SECRETS)

export function encryptConnectionSecret(plain: string): Promise<string> {
  return symmetricEncrypt({ key: secretConfig, data: plain })
}

export function decryptConnectionSecret(envelope: string): Promise<string> {
  return symmetricDecrypt({ key: secretConfig, data: envelope })
}
