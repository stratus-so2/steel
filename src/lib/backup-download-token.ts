import { createHmac, timingSafeEqual } from 'node:crypto'
import { BETTER_AUTH_SECRET } from '@/lib/env/server'

/** Validade do link de download de backup gerado no painel admin. */
export const BACKUP_DOWNLOAD_TTL_SECONDS = 5 * 60

function sign(backupId: string, actorId: string, exp: number): string {
  return createHmac('sha256', BETTER_AUTH_SECRET)
    .update(`backup-download:${backupId}:${actorId}:${exp}`)
    .digest('hex')
}

/**
 * Link assinado e curto para baixar um backup. A assinatura amarra backup,
 * admin e validade: vazar a URL não basta (a rota também exige a sessão do
 * mesmo admin). O MinIO não é público, então o app faz o stream — URL
 * pré-assinada do S3 apontaria para um host interno.
 */
export function createBackupDownloadToken(
  backupId: string,
  actorId: string,
  now: number = Date.now(),
): { exp: number; sig: string } {
  const exp = Math.floor(now / 1000) + BACKUP_DOWNLOAD_TTL_SECONDS
  return { exp, sig: sign(backupId, actorId, exp) }
}

export function verifyBackupDownloadToken(
  params: { backupId: string; actorId: string; exp: number; sig: string },
  now: number = Date.now(),
): boolean {
  if (params.exp < Math.floor(now / 1000)) return false
  const expected = Buffer.from(
    sign(params.backupId, params.actorId, params.exp),
    'hex',
  )
  const given = Buffer.from(params.sig, 'hex')
  return given.length === expected.length && timingSafeEqual(given, expected)
}
