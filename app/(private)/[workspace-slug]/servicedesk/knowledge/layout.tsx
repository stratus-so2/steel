import { notFound } from 'next/navigation'
import type { ReactNode } from 'react'
import { getSdKbViewer } from '@/app/_components/servicedesk/knowledge/sd-kb-server-context'

/**
 * Knowledge base shell. Only the access gate and a full-height column: the
 * article tree and the create action moved to the module context rail
 * (`SdKbContextNav`, like Nexo's Wiki), and the header belongs to each page —
 * the article one needs the document name in the breadcrumb, which a layout
 * cannot know.
 */
export default async function SdKnowledgeLayout({
  children,
  params,
}: {
  children: ReactNode
  params: Promise<{ 'workspace-slug': string }>
}) {
  const { 'workspace-slug': slug } = await params
  const viewer = await getSdKbViewer(slug)
  if (!viewer) notFound()

  return <div className='flex h-full min-h-0 w-full flex-col'>{children}</div>
}
