'use client'

import { SlidersHorizontalIcon } from '@hugeicons-pro/core-stroke-rounded'
import { useRouter } from 'next/navigation'
import { useShortcut } from '@/app/_components/shortcuts/shortcuts-provider'
import { SteelIcon } from '@/components/icon/icon'
import { useCreateWikiPage } from '@/src/hooks/use-wiki-page'
import { ContextPrimaryAction } from '../navigation/sidebar-context'

export function WikiCreatePageButton({
  workspaceId,
  workspaceSlug,
}: {
  workspaceId: string
  workspaceSlug: string
}) {
  const router = useRouter()
  const createWikiPage = useCreateWikiPage(workspaceId)

  function handleCreate() {
    createWikiPage.mutate(
      {},
      {
        onSuccess: (page) => {
          router.push(`/${workspaceSlug}/wiki/${page.id}`)
        },
      },
    )
  }

  useShortcut('wiki.new', handleCreate, {
    enabled: !createWikiPage.isPending,
  })

  return (
    <ContextPrimaryAction
      onClick={handleCreate}
      disabled={createWikiPage.isPending}
    >
      <SteelIcon icon={SlidersHorizontalIcon} />
      Nova Página
    </ContextPrimaryAction>
  )
}
