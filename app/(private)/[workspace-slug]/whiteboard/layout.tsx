import { notFound } from 'next/navigation'
import type { ReactNode } from 'react'
import {
  ContextHeader,
  ContextSidebar,
} from '@/app/_components/navigation/sidebar-context'
import { WhiteboardCreateButton } from '@/app/_components/whiteboard/whiteboard-create-button'
import { WhiteboardSessionProvider } from '@/app/_components/whiteboard/whiteboard-session'
import { WhiteboardSidebar } from '@/app/_components/whiteboard/whiteboard-sidebar'
import { ButtonLink } from '@/components/button-link'
import {
  getWhiteboardContext,
  getWhiteboards,
} from '@/src/lib/whiteboard-context'
import { isPrivilegedRole } from '@/src/services/authz'

export default async function WhiteboardLayout({
  children,
  params,
}: {
  children: ReactNode
  params: Promise<{ 'workspace-slug': string }>
}) {
  const { 'workspace-slug': workspaceSlug } = await params
  const context = await getWhiteboardContext(workspaceSlug)
  // Ajustes › Quadro-branco off (or not a member): 404, like the wiki.
  if (!context) notFound()
  const boards = await getWhiteboards(context)

  return (
    <WhiteboardSessionProvider
      value={{
        workspaceId: context.workspaceId,
        workspaceSlug,
        userId: context.userId,
        canEdit: context.role !== 'VIEWER',
        isPrivileged: isPrivilegedRole(context.role),
      }}
    >
      <ContextSidebar>
        <ContextHeader
          title='Quadro-branco'
          actions={
            <ButtonLink
              href={`/${workspaceSlug}/whiteboard?all=1`}
              variant='ghost'
              size='sm'
            >
              Todos
            </ButtonLink>
          }
          primaryAction={<WhiteboardCreateButton />}
        />
        <WhiteboardSidebar initialBoards={boards} />
      </ContextSidebar>
      <div className='flex h-full min-h-0 min-w-0 flex-1 flex-col'>
        {children}
      </div>
    </WhiteboardSessionProvider>
  )
}
