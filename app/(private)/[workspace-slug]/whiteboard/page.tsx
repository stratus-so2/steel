import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { WhiteboardHome } from '@/app/_components/whiteboard/whiteboard-home'
import {
  getWhiteboardContext,
  getWhiteboards,
} from '@/src/lib/whiteboard-context'

export const metadata: Metadata = {
  title: 'Quadro-branco | Steel',
  description: 'Quadros do workspace para desenhar fluxos e ideias.',
}

/**
 * The rail's "Quadro-branco": back to the last board this browser opened,
 * else the gallery (`?all=1` always shows the gallery).
 */
export default async function WhiteboardIndexPage({
  params,
  searchParams,
}: {
  params: Promise<{ 'workspace-slug': string }>
  searchParams: Promise<{ all?: string }>
}) {
  const [{ 'workspace-slug': workspaceSlug }, { all }] = await Promise.all([
    params,
    searchParams,
  ])
  const context = await getWhiteboardContext(workspaceSlug)
  if (!context) notFound()
  const boards = await getWhiteboards(context)

  return <WhiteboardHome initialBoards={boards} showAll={all === '1'} />
}
