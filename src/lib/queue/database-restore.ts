import { createHash } from 'node:crypto'
import { decryptConnectionSecret } from '@/src/lib/crypto'
import { prisma } from '@/src/lib/prisma'
import {
  getOffsiteConfig,
  getOffsiteObject,
  sha256,
} from '@/src/lib/storage/offsite-backup'
import { getObject } from '@/src/lib/storage/s3'
import { BACKUP_BUCKET } from './processors/database-backup'

export async function fetchAndDecryptBackup(backupId: string): Promise<{
  buffer: Buffer
  backup: {
    id: string
    scope: string
    workspaceId: string | null
    storageKey: string
  }
}> {
  const backup = await prisma.backup.findUnique({ where: { id: backupId } })
  if (!backup) throw new Error(`Backup "${backupId}" não encontrado.`)
  if (backup.status !== 'COMPLETED' || !backup.storageKey) {
    throw new Error(
      `Backup "${backupId}" não está COMPLETED (status atual: ${backup.status}).`,
    )
  }

  const encrypted = await getObject({
    bucket: BACKUP_BUCKET,
    key: backup.storageKey,
  })
  const decryptedBase64 = await decryptConnectionSecret(
    encrypted.toString('utf-8'),
  )
  const buffer = Buffer.from(decryptedBase64, 'base64')

  if (backup.checksum) {
    const checksum = createHash('sha256').update(buffer).digest('hex')
    if (checksum !== backup.checksum) {
      throw new Error(
        `Checksum não bate para o backup "${backupId}" (esperado ${backup.checksum}, obtido ${checksum}).`,
      )
    }
  }

  return {
    buffer,
    backup: {
      id: backup.id,
      scope: backup.scope,
      workspaceId: backup.workspaceId,
      storageKey: backup.storageKey,
    },
  }
}

/**
 * Busca um backup FULL direto da cópia offsite, sem consultar a tabela
 * `backups` (num desastre ela some junto com o banco). Precisa só das
 * variáveis `BACKUP_OFFSITE_*` e do mesmo `CONNECTION_SECRETS` que cifrou o
 * backup. Valida os SHA-256 (cifrado e em claro) gravados nos metadados.
 */
export async function fetchAndDecryptOffsiteBackup(
  backupId: string,
): Promise<{ buffer: Buffer; key: string }> {
  const config = getOffsiteConfig()
  if (!config) {
    throw new Error(
      'Cópia offsite não configurada (BACKUP_OFFSITE_ENDPOINT/BUCKET/ACCESS_KEY_ID/SECRET_ACCESS_KEY).',
    )
  }

  const key = `full/${backupId}.dump.enc`
  const object = await getOffsiteObject(config, key)

  if (
    object.encryptedChecksum &&
    sha256(object.body) !== object.encryptedChecksum
  ) {
    throw new Error(`Cópia offsite "${key}" corrompida (SHA-256 cifrado).`)
  }

  const decryptedBase64 = await decryptConnectionSecret(
    object.body.toString('utf-8'),
  )
  const buffer = Buffer.from(decryptedBase64, 'base64')

  if (object.plainChecksum && sha256(buffer) !== object.plainChecksum) {
    throw new Error(
      `Checksum não bate para a cópia offsite "${key}" (esperado ${object.plainChecksum}).`,
    )
  }

  return { buffer, key }
}
