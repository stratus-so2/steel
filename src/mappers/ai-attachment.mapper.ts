import type { AiAttachment } from '@prisma/client'
import type { AiAttachmentDTO } from '@/types/steel-ai'

/** Same-origin route that serves the file (checks ownership every time). */
export function aiAttachmentUrl(
  workspaceId: string,
  row: Pick<AiAttachment, 'id' | 'conversationId'>,
): string {
  return `/api/workspaces/${workspaceId}/ai/conversations/${row.conversationId}/attachments/${row.id}`
}

export function toAiAttachmentDTO(
  row: AiAttachment,
  workspaceId: string,
): AiAttachmentDTO {
  return {
    id: row.id,
    conversationId: row.conversationId,
    messageId: row.messageId,
    kind: row.kind,
    filename: row.filename,
    contentType: row.contentType,
    sizeBytes: row.sizeBytes,
    url: aiAttachmentUrl(workspaceId, row),
    createdAt: row.createdAt.toISOString(),
  }
}
