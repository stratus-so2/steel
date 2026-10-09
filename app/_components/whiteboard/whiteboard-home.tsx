'use client'

import { WhiteboardIcon } from '@hugeicons-pro/core-stroke-rounded'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { SteelIcon } from '@/components/icon/icon'
import { useWhiteboards } from '@/src/hooks/use-whiteboard'
import type { WhiteboardSummaryDTO } from '@/types/whiteboard'
import { WhiteboardCreateFirstButton } from './whiteboard-create-button'
import { boardTitle, editedLine } from './whiteboard-format'
import { readLastBoard, useWhiteboardSession } from './whiteboard-session'

/**
 * `/whiteboard`: reopens the last board this browser had open (so the rail
 * entry lands back on the canvas), else shows the gallery of boards.
 * `?all=1` (the sidebar's "Todos os quadros") always shows the gallery.
 */
export function WhiteboardHome({
  initialBoards,
  showAll,
}: {
  initialBoards?: WhiteboardSummaryDTO[] | null
  showAll: boolean
}) {
  const router = useRouter()
  const { workspaceId, workspaceSlug } = useWhiteboardSession()
  const { data: boards } = useWhiteboards(workspaceId, {}, initialBoards)
  const [checkedLast, setCheckedLast] = useState(showAll)

  useEffect(() => {
    if (showAll || !boards) return
    const last = readLastBoard(workspaceId)
    if (last && boards.some((board) => board.id === last)) {
      router.replace(`/${workspaceSlug}/whiteboard/${last}`)
      return
    }
    setCheckedLast(true)
  }, [boards, showAll, workspaceId, workspaceSlug, router])

  if (!checkedLast || !boards) {
    return <div aria-busy='true' className='flex-1' />
  }

  if (boards.length === 0) {
    return (
      <div className='flex h-full flex-1 flex-col items-center justify-center gap-4 p-6 text-center'>
        <div className='flex size-12 items-center justify-center rounded-lg bg-muted text-muted-foreground'>
          <SteelIcon icon={WhiteboardIcon} size={24} strokeWidth={2} />
        </div>
        <div className='max-w-sm space-y-1.5'>
          <h2 className='font-semibold text-base'>Nenhum quadro ainda</h2>
          <p className='text-muted-foreground text-sm'>
            Desenhe fluxos, mapas mentais e rascunhos de tela. Cada quadro salva
            sozinho e guarda um histórico de versões.
          </p>
        </div>
        <WhiteboardCreateFirstButton />
      </div>
    )
  }

  return (
    <div className='h-full w-full overflow-y-auto'>
      <div className='mx-auto w-full max-w-6xl space-y-4 p-4 md:p-6'>
        <div>
          <h2 className='font-semibold text-lg'>Quadros</h2>
          <p className='text-muted-foreground text-sm'>
            {boards.length === 1
              ? '1 quadro no workspace'
              : `${boards.length} quadros no workspace`}
          </p>
        </div>
        <ul className='grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3'>
          {boards.map((board) => (
            <li key={board.id}>
              <Link
                href={`/${workspaceSlug}/whiteboard/${board.id}`}
                className='group block overflow-hidden rounded-lg border bg-card transition-colors hover:border-ring focus-visible:outline-2 focus-visible:outline-ring'
              >
                <div className='flex aspect-video items-center justify-center border-b bg-background'>
                  {board.thumbnailUrl ? (
                    <img
                      src={board.thumbnailUrl}
                      alt=''
                      className='size-full object-contain p-2'
                      loading='lazy'
                    />
                  ) : (
                    <SteelIcon
                      icon={WhiteboardIcon}
                      size={32}
                      className='text-muted-foreground'
                    />
                  )}
                </div>
                <div className='space-y-0.5 p-3'>
                  <p className='truncate font-medium text-sm'>
                    {boardTitle(board.title)}
                  </p>
                  <p className='truncate text-muted-foreground text-xs'>
                    {editedLine(board)}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
