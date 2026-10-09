import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { WhiteboardEditor } from '@/app/_components/whiteboard/whiteboard-editor'
import {
  getWhiteboard,
  getWhiteboardContext,
} from '@/src/lib/whiteboard-context'

export const metadata: Metadata = {
  title: 'Quadro-branco | Steel',
  description: 'Quadro do workspace.',
}

export default async function WhiteboardBoardPage({
  params,
}: {
  params: Promise<{ 'workspace-slug': string; 'board-id': string }>
}) {
  const { 'workspace-slug': workspaceSlug, 'board-id': boardId } = await params
  const context = await getWhiteboardContext(workspaceSlug)
  if (!context) notFound()
  const board = await getWhiteboard(context, boardId)
  if (!board) notFound()

  // Keyed by board: switching boards remounts the canvas with its own scene.
  return <WhiteboardEditor key={board.id} initialBoard={board} />
}
