import { deleteObjects, listObjectKeys } from './s3'

/**
 * Buckets cujas chaves começam por `<workspaceId>/` — dá para apagar tudo
 * do workspace por prefixo. Mantenha em sincronia com quem grava:
 * - `projects-covers` — src/services/media/project-media.service.ts
 * - `crm-scheduled-posts` — src/services/crm-social.service.ts
 * - `crm-social-publish-tmp` — app/api/workspaces/[id]/crm/social/[platform]/publish
 * - `whatsapp-media` — src/lib/whatsapp/media.ts
 * - `whatsapp-ai-knowledge` — src/services/whatsapp-ai-knowledge-document.service.ts
 */
export const WORKSPACE_PREFIXED_BUCKETS = [
  'projects-covers',
  'crm-scheduled-posts',
  'crm-social-publish-tmp',
  'whatsapp-media',
  'whatsapp-ai-knowledge',
] as const

/** Anexos do assistente de IA: chave `<conversationId>/...`, lida da linha. */
export const CRM_AI_ATTACHMENT_BUCKET = 'crm-ai-attachments'

export interface WorkspaceFilesPurgeResult {
  deleted: number
  byBucket: Record<string, number>
}

/**
 * Apaga os arquivos de um workspace no MinIO. As chaves dos anexos de IA
 * precisam ser coletadas ANTES de apagar as linhas do banco (a chave não
 * carrega o workspace).
 *
 * Fica de fora (sem como atribuir a um workspace): imagens/vídeos de landing
 * pages e propostas, que usam chave aleatória referenciada só no conteúdo.
 */
export async function purgeWorkspaceFiles(
  workspaceId: string,
  aiAttachmentKeys: string[],
): Promise<WorkspaceFilesPurgeResult> {
  const byBucket: Record<string, number> = {}

  for (const bucket of WORKSPACE_PREFIXED_BUCKETS) {
    const keys = await listObjectKeys(bucket, `${workspaceId}/`)
    byBucket[bucket] = keys.length > 0 ? await deleteObjects(bucket, keys) : 0
  }

  byBucket[CRM_AI_ATTACHMENT_BUCKET] =
    aiAttachmentKeys.length > 0
      ? await deleteObjects(CRM_AI_ATTACHMENT_BUCKET, aiAttachmentKeys)
      : 0

  const deleted = Object.values(byBucket).reduce((sum, n) => sum + n, 0)
  return { deleted, byBucket }
}
