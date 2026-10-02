import {
  ContextHeader,
  ContextSidebar,
} from '@/app/_components/navigation/sidebar-context'
import { SdKbCreateButton } from './sd-kb-create-button'
import { SdKbTree } from './sd-kb-tree'

/**
 * Knowledge base tree in the module context rail — the shape Nexo's Wiki
 * uses, with `ContextHeader` + create action + tree inside `ContextSidebar`.
 *
 * The tree used to be a 256px `aside` *inside* the page, next to the module
 * rail: two vertical bars, and an editor squeezed into whatever was left. With
 * the tree here, the article page gets the full width and only the standard
 * header.
 */
export function SdKbContextNav({
  workspaceId,
  slug,
  canEdit,
  canCreate,
  canDelete,
}: {
  workspaceId: string
  slug: string
  canEdit: boolean
  canCreate: boolean
  canDelete: boolean
}) {
  return (
    <ContextSidebar>
      <ContextHeader
        title='Base de conhecimento'
        primaryAction={
          canCreate ? (
            <SdKbCreateButton
              workspaceId={workspaceId}
              workspaceSlug={slug}
              className='w-full justify-start'
            />
          ) : null
        }
      />
      <SdKbTree
        workspaceId={workspaceId}
        workspaceSlug={slug}
        canEdit={canEdit}
        canCreate={canCreate}
        canDelete={canDelete}
      />
    </ContextSidebar>
  )
}
