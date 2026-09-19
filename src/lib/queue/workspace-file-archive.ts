import { createHash } from 'node:crypto'
import type { PrismaClient } from '@prisma/client'
import { logger } from '@/lib/axiom/logger'
import {
  decryptConnectionSecret,
  encryptConnectionSecret,
} from '@/src/lib/crypto'
import {
  deleteObjects,
  ensureBucket,
  ensurePublicBucket,
  getObject,
  getObjectWithContentType,
  listObjectKeys,
  putObject,
} from '@/src/lib/storage/s3'
import {
  collectWorkspaceFileRefs,
  isPublicBucket,
} from '@/src/lib/storage/workspace-files'
import { BACKUP_BUCKET } from './backup-bucket'

export const WORKSPACE_FILES_MANIFEST_VERSION = 1

export interface WorkspaceFileEntry {
  /** Posição no arquivo: o objeto cifrado é `<prefixo>/<index>.enc`. */
  index: number
  bucket: string
  key: string
  sizeBytes: number
  contentType: string
  /** SHA-256 do conteúdo em claro, conferido no restore. */
  checksum: string
  /** Achado por varredura de referência (mídia legada sem prefixo). */
  legacy: boolean
}

export interface WorkspaceFilesManifest {
  version: typeof WORKSPACE_FILES_MANIFEST_VERSION
  workspaceId: string
  backupId: string
  files: WorkspaceFileEntry[]
  /** Chaves citadas no conteúdo que já não existiam no MinIO. */
  missingLegacyKeys: number
}

/** Prefixo dos objetos do arquivo de arquivos, dentro do bucket de backups. */
export function workspaceFilesPrefix(
  workspaceId: string,
  backupId: string,
): string {
  return `workspace/${workspaceId}/${backupId}.files/`
}

export function workspaceFilesManifestKey(
  workspaceId: string,
  backupId: string,
): string {
  return `${workspaceFilesPrefix(workspaceId, backupId)}manifest.json.enc`
}

async function putEncrypted(key: string, body: Buffer): Promise<void> {
  const envelope = await encryptConnectionSecret(body.toString('base64'))
  await putObject({
    bucket: BACKUP_BUCKET,
    key,
    body: envelope,
    contentType: 'application/octet-stream',
  })
}

async function getDecrypted(key: string): Promise<Buffer> {
  const envelope = await getObject({ bucket: BACKUP_BUCKET, key })
  const base64 = await decryptConnectionSecret(envelope.toString('utf-8'))
  return Buffer.from(base64, 'base64')
}

export interface ArchiveResult {
  manifestKey: string
  fileCount: number
  fileBytes: number
  missingLegacyKeys: number
}

/**
 * Copia os arquivos do workspace pro bucket de backups, **um objeto por vez**
 * e cada um cifrado com a mesma `CONNECTION_SECRETS` do dump: nunca há mais
 * de um arquivo na memória, então um workspace com gigabytes de mídia não
 * derruba o worker. O manifesto (também cifrado) amarra índice → bucket/chave.
 *
 * Idempotente: repetir com o mesmo `backupId` regrava as mesmas chaves.
 */
export async function archiveWorkspaceFiles(params: {
  client: PrismaClient
  workspaceId: string
  backupId: string
  jobId?: string
}): Promise<ArchiveResult> {
  const { client, workspaceId, backupId } = params
  const prefix = workspaceFilesPrefix(workspaceId, backupId)

  await ensureBucket(BACKUP_BUCKET)
  const refs = await collectWorkspaceFileRefs(client, workspaceId)

  const files: WorkspaceFileEntry[] = []
  let fileBytes = 0

  for (const [index, ref] of refs.files.entries()) {
    let object: { body: Buffer; contentType: string }
    try {
      object = await getObjectWithContentType({
        bucket: ref.bucket,
        key: ref.key,
      })
    } catch (error) {
      // Objeto sumiu entre a listagem e a cópia (upload concorrente sendo
      // desfeito, prune): não vale derrubar o backup inteiro por isso.
      logger.warn('queue.database_backup.workspace_file_skipped', {
        component: 'Worker',
        jobId: params.jobId,
        backupId,
        workspaceId,
        bucket: ref.bucket,
        key: ref.key,
        message: error instanceof Error ? error.message : String(error),
      })
      continue
    }

    const { body } = object
    await putEncrypted(`${prefix}${index}.enc`, body)
    files.push({
      index,
      bucket: ref.bucket,
      key: ref.key,
      sizeBytes: body.byteLength,
      contentType: object.contentType,
      checksum: createHash('sha256').update(body).digest('hex'),
      legacy: ref.legacy,
    })
    fileBytes += body.byteLength
  }

  const manifest: WorkspaceFilesManifest = {
    version: WORKSPACE_FILES_MANIFEST_VERSION,
    workspaceId,
    backupId,
    files,
    missingLegacyKeys: refs.missingLegacyKeys,
  }
  const manifestKey = workspaceFilesManifestKey(workspaceId, backupId)
  await putEncrypted(
    manifestKey,
    Buffer.from(JSON.stringify(manifest), 'utf-8'),
  )

  return {
    manifestKey,
    fileCount: files.length,
    fileBytes,
    missingLegacyKeys: refs.missingLegacyKeys,
  }
}

export async function readWorkspaceFilesManifest(
  manifestKey: string,
): Promise<WorkspaceFilesManifest> {
  const buffer = await getDecrypted(manifestKey)
  const manifest = JSON.parse(
    buffer.toString('utf-8'),
  ) as WorkspaceFilesManifest
  if (manifest.version !== WORKSPACE_FILES_MANIFEST_VERSION) {
    throw new Error(
      `Manifesto de arquivos em versão não suportada (${manifest.version}).`,
    )
  }
  return manifest
}

export interface RestoreFilesResult {
  /** Objetos gravados (0 num dry-run). */
  restored: number
  /** Objetos que o dry-run/restore contabilizou como candidatos. */
  planned: number
  bytes: number
  byBucket: Record<string, { files: number; bytes: number }>
  dryRun: boolean
}

/**
 * Regrava os arquivos do manifesto nos buckets de origem. Só escreve as
 * chaves do manifesto — nunca apaga nem toca em objeto que não veio do
 * backup, então rodar duas vezes dá o mesmo resultado (o `putObject`
 * sobrescreve a chave com o mesmo conteúdo).
 */
export async function restoreWorkspaceFiles(params: {
  manifest: WorkspaceFilesManifest
  dryRun?: boolean
}): Promise<RestoreFilesResult> {
  const { manifest } = params
  const dryRun = params.dryRun === true
  const prefix = workspaceFilesPrefix(manifest.workspaceId, manifest.backupId)

  const byBucket: Record<string, { files: number; bytes: number }> = {}
  let bytes = 0
  let restored = 0

  for (const entry of manifest.files) {
    const bucketStats = (byBucket[entry.bucket] ??= { files: 0, bytes: 0 })
    bucketStats.files += 1
    bucketStats.bytes += entry.sizeBytes
    bytes += entry.sizeBytes
    if (dryRun) continue

    const body = await getDecrypted(`${prefix}${entry.index}.enc`)
    const checksum = createHash('sha256').update(body).digest('hex')
    if (checksum !== entry.checksum) {
      throw new Error(
        `Checksum não bate para ${entry.bucket}/${entry.key} (esperado ${entry.checksum}).`,
      )
    }

    if (isPublicBucket(entry.bucket)) {
      await ensurePublicBucket(entry.bucket)
    } else {
      await ensureBucket(entry.bucket)
    }
    await putObject({
      bucket: entry.bucket,
      key: entry.key,
      body,
      contentType: entry.contentType,
    })
    restored += 1
  }

  return {
    restored,
    planned: manifest.files.length,
    bytes,
    byBucket,
    dryRun,
  }
}

/** Apaga os objetos do arquivo de arquivos (prune de retenção). */
export async function deleteWorkspaceFileArchive(
  workspaceId: string,
  backupId: string,
): Promise<number> {
  const prefix = workspaceFilesPrefix(workspaceId, backupId)
  const keys = await listObjectKeys(BACKUP_BUCKET, prefix)
  if (keys.length === 0) return 0
  return deleteObjects(BACKUP_BUCKET, keys)
}
