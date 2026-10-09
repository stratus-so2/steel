'use client'

import {
  BookOpen01Icon,
  PlusSignIcon,
} from '@hugeicons-pro/core-stroke-rounded'
import { useRouter } from 'next/navigation'
import { SteelIcon } from '@/components/icon/icon'
import { Button } from '@/components/ui/button'
import { notify } from '@/lib/notify'
import { useCreateWikiPage } from '@/src/hooks/use-wiki-page'

/** `/wiki` of a workspace with no page yet: one button to the first one. */
export function WikiEmptyState({
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
      { title: 'Primeira página' },
      {
        onSuccess: (page) => router.push(`/${workspaceSlug}/wiki/${page.id}`),
        onError: (error) => notify.error(error, 'Não foi possível criar'),
      },
    )
  }

  return (
    <div className='flex h-full flex-1 flex-col items-center justify-center gap-4 p-6 text-center'>
      <div className='flex size-12 items-center justify-center rounded-lg bg-muted text-muted-foreground'>
        <SteelIcon icon={BookOpen01Icon} size={24} strokeWidth={2} />
      </div>
      <div className='max-w-sm space-y-1.5'>
        <h2 className='font-semibold text-base'>A wiki ainda está vazia</h2>
        <p className='text-muted-foreground text-sm'>
          Documente processos, políticas e o que o time precisa saber. Cada
          página é editada em tempo real por quem estiver nela.
        </p>
      </div>
      <Button onClick={handleCreate} disabled={createWikiPage.isPending}>
        <SteelIcon icon={PlusSignIcon} strokeWidth={2} />
        {createWikiPage.isPending ? 'Criando…' : 'Criar primeira página'}
      </Button>
    </div>
  )
}
