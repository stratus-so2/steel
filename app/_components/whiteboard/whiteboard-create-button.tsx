'use client'

import { PlusSignIcon } from '@hugeicons-pro/core-stroke-rounded'
import { useRouter } from 'next/navigation'
import { SteelIcon } from '@/components/icon/icon'
import { Button } from '@/components/ui/button'
import { notify } from '@/lib/notify'
import { useCreateWhiteboard } from '@/src/hooks/use-whiteboard'
import { ContextPrimaryAction } from '../navigation/sidebar-context'
import { useWhiteboardSession } from './whiteboard-session'

function useCreateAndOpen() {
  const router = useRouter()
  const { workspaceId, workspaceSlug } = useWhiteboardSession()
  const create = useCreateWhiteboard(workspaceId)

  function handleCreate() {
    create.mutate(
      {},
      {
        onSuccess: (board) =>
          router.push(`/${workspaceSlug}/whiteboard/${board.id}`),
        onError: (error) => notify.error(error, 'Não foi possível criar'),
      },
    )
  }

  return { handleCreate, pending: create.isPending }
}

/** "Novo quadro" at the top of the sidebar (hidden for VIEWERs). */
export function WhiteboardCreateButton() {
  const { canEdit } = useWhiteboardSession()
  const { handleCreate, pending } = useCreateAndOpen()
  if (!canEdit) return null

  return (
    <ContextPrimaryAction onClick={handleCreate} disabled={pending}>
      <SteelIcon icon={PlusSignIcon} />
      Novo quadro
    </ContextPrimaryAction>
  )
}

/** Main call to action of the empty gallery. */
export function WhiteboardCreateFirstButton() {
  const { canEdit } = useWhiteboardSession()
  const { handleCreate, pending } = useCreateAndOpen()
  if (!canEdit) return null

  return (
    <Button onClick={handleCreate} disabled={pending}>
      <SteelIcon icon={PlusSignIcon} strokeWidth={2} />
      {pending ? 'Criando…' : 'Criar primeiro quadro'}
    </Button>
  )
}
