import { createHash } from 'node:crypto'
import { decryptConnectionSecret } from '@/src/lib/crypto'
import { prisma } from '@/src/lib/prisma'
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
