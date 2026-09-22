import type { SdSavedView } from '@prisma/client'
import type { SdSavedViewDTO } from '@/types/sd-ticket'

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function list<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : []
}

export function toSdSavedViewDTO(
  view: SdSavedView,
  editable: boolean,
): SdSavedViewDTO {
  return {
    id: view.id,
    workspaceId: view.workspaceId,
    userId: view.userId,
    name: view.name,
    ticketType: view.ticketType,
    mode: view.mode,
    filters: record(view.filters),
    sort: list(view.sort),
    columns: list(view.columns),
    shared: view.shared,
    position: view.position,
    editable,
    createdAt: view.createdAt.toISOString(),
    updatedAt: view.updatedAt.toISOString(),
  }
}
