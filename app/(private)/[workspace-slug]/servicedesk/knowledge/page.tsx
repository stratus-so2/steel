import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { SdKbHome } from '@/app/_components/servicedesk/knowledge/sd-kb-home'
import { getSdKbViewer } from '@/app/_components/servicedesk/knowledge/sd-kb-server-context'

export const metadata: Metadata = {
  title: 'Base de conhecimento | ServiceDesk | Steel',
  description: 'Artigos e soluções da base de conhecimento do ServiceDesk.',
}

export default async function SdKnowledgePage({
  params,
}: {
  params: Promise<{ 'workspace-slug': string }>
}) {
  const { 'workspace-slug': slug } = await params
  const viewer = await getSdKbViewer(slug)
  if (!viewer) notFound()

  return (
    <SdKbHome
      workspaceId={viewer.workspaceId}
      workspaceSlug={slug}
      isAgent={viewer.isAgent}
    />
  )
}
