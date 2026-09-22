import type { SdCannedResponseWithAuthor } from '@/src/repositories/sd-canned-response.repository'
import type { SdCannedResponseDTO } from '@/types/sd-config'

export function toSdCannedResponseDTO(
  response: SdCannedResponseWithAuthor,
): SdCannedResponseDTO {
  return {
    id: response.id,
    title: response.title,
    shortcut: response.shortcut,
    body: response.body,
    departmentId: response.departmentId,
    createdById: response.createdById,
    createdByName: response.createdBy?.name ?? null,
    createdAt: response.createdAt.toISOString(),
    updatedAt: response.updatedAt.toISOString(),
  }
}
