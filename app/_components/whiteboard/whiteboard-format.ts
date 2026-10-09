import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { WhiteboardVersionKind } from '@/types/whiteboard'

export const UNTITLED_BOARD = 'Quadro sem título'

export function boardTitle(title: string | null | undefined): string {
  return title?.trim() || UNTITLED_BOARD
}

/** "há 5 minutos" — relative, so it never depends on the viewer's zone. */
export function relativeTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return formatDistanceToNow(date, { addSuffix: true, locale: ptBR })
}

export function editedLine(board: {
  editedAt: string
  updatedBy: { name: string } | null
}): string {
  const when = relativeTime(board.editedAt)
  return board.updatedBy
    ? `Editado ${when} por ${board.updatedBy.name}`
    : `Editado ${when}`
}

export const VERSION_KIND_LABEL: Record<WhiteboardVersionKind, string> = {
  AUTO: 'Automática',
  MANUAL: 'Salva',
  RESTORE: 'Restauração',
}
