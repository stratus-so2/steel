'use client'

import {
  Archive01Icon,
  ArrowTurnBackwardIcon,
  Copy01Icon,
  MoreHorizontalIcon,
  PencilEdit01Icon,
  Search01Icon,
  WhiteboardIcon,
} from '@hugeicons-pro/core-stroke-rounded'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import { ButtonLink } from '@/components/button-link'
import { SteelIcon } from '@/components/icon/icon'
import { Muted } from '@/components/typography/text/muted'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { notify } from '@/lib/notify'
import { cn } from '@/lib/utils'
import {
  useArchiveWhiteboard,
  useDuplicateWhiteboard,
  useWhiteboards,
} from '@/src/hooks/use-whiteboard'
import type { WhiteboardSummaryDTO } from '@/types/whiteboard'
import { boardTitle, editedLine } from './whiteboard-format'
import { WhiteboardRenameDialog } from './whiteboard-rename-dialog'
import { useWhiteboardSession, writeLastBoard } from './whiteboard-session'

/**
 * The board list of the context sidebar: search, live/archived switch and
 * one row per board. Clicking a row opens it (the canvas remounts with that
 * board's own saved scene and viewport).
 */
export function WhiteboardSidebar({
  initialBoards,
}: {
  /** Server-rendered live boards, so the list is there on first paint. */
  initialBoards?: WhiteboardSummaryDTO[] | null
}) {
  const { workspaceId } = useWhiteboardSession()
  const [q, setQ] = useState('')
  const [archived, setArchived] = useState(false)
  const [renaming, setRenaming] = useState<WhiteboardSummaryDTO | null>(null)
  const { data: boards, isLoading } = useWhiteboards(
    workspaceId,
    { q, archived },
    initialBoards,
  )

  return (
    <div className='space-y-2'>
      <div className='relative'>
        <SteelIcon
          icon={Search01Icon}
          size={16}
          className='pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-muted-foreground'
        />
        <Input
          type='search'
          value={q}
          onChange={(event) => setQ(event.target.value)}
          placeholder='Buscar quadros'
          aria-label='Buscar quadros'
          className='pl-8'
        />
      </div>
      <div
        role='tablist'
        aria-label='Quadros exibidos'
        className='grid grid-cols-2 gap-1 rounded-md bg-muted p-0.5'
      >
        {[
          { value: false, label: 'Ativos' },
          { value: true, label: 'Arquivados' },
        ].map((tab) => (
          <button
            key={tab.label}
            type='button'
            role='tab'
            aria-selected={archived === tab.value}
            onClick={() => setArchived(tab.value)}
            className={cn(
              'rounded-sm px-2 py-1 text-xs font-medium text-muted-foreground transition-colors',
              archived === tab.value &&
                'bg-background text-foreground shadow-xs',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {isLoading ? (
        <div
          role='status'
          aria-label='Carregando quadros'
          className='space-y-1.5 px-1'
        >
          {[0, 1, 2].map((row) => (
            <Skeleton key={row} className='h-10 w-full' />
          ))}
        </div>
      ) : !boards?.length ? (
        <Muted className='px-2.5 text-sm'>
          {q
            ? 'Nenhum quadro encontrado.'
            : archived
              ? 'Nenhum quadro arquivado.'
              : 'Nenhum quadro ainda.'}
        </Muted>
      ) : (
        <nav aria-label='Quadros' className='space-y-0.5'>
          {boards.map((board) => (
            <WhiteboardSidebarItem
              key={board.id}
              board={board}
              onRename={() => setRenaming(board)}
            />
          ))}
        </nav>
      )}
      <WhiteboardRenameDialog
        workspaceId={workspaceId}
        board={renaming}
        onOpenChange={(open) => {
          if (!open) setRenaming(null)
        }}
      />
    </div>
  )
}

function WhiteboardSidebarItem({
  board,
  onRename,
}: {
  board: WhiteboardSummaryDTO
  onRename: () => void
}) {
  const router = useRouter()
  const pathname = usePathname()
  const { workspaceId, workspaceSlug, userId, canEdit, isPrivileged } =
    useWhiteboardSession()
  const duplicate = useDuplicateWhiteboard(workspaceId)
  const archive = useArchiveWhiteboard(workspaceId)
  const href = `/${workspaceSlug}/whiteboard/${board.id}`
  const isActive = pathname === href
  const title = boardTitle(board.title)
  const canArchive = canEdit && (isPrivileged || board.createdBy?.id === userId)
  const isArchived = board.archivedAt !== null

  function handleDuplicate() {
    duplicate.mutate(board.id, {
      onSuccess: (copy) => {
        notify.success('Quadro duplicado')
        router.push(`/${workspaceSlug}/whiteboard/${copy.id}`)
      },
      onError: notify.error,
    })
  }

  function handleArchive() {
    archive.mutate(
      { id: board.id, archived: !isArchived },
      {
        onSuccess: () => {
          notify.success(isArchived ? 'Quadro restaurado' : 'Quadro arquivado')
          if (!isArchived) {
            writeLastBoard(workspaceId, null)
            if (isActive) router.push(`/${workspaceSlug}/whiteboard?all=1`)
          }
        },
        onError: notify.error,
      },
    )
  }

  return (
    <div className='group flex items-center'>
      <ButtonLink
        href={href}
        variant={isActive ? 'secondary' : 'ghost'}
        aria-current={isActive ? 'page' : undefined}
        className='h-auto min-w-0 flex-1 justify-start gap-2.5 px-2 py-1.5'
      >
        <span className='flex size-8 shrink-0 items-center justify-center overflow-hidden rounded border bg-background'>
          {board.thumbnailUrl ? (
            <img
              src={board.thumbnailUrl}
              alt=''
              className='size-full object-contain'
              loading='lazy'
            />
          ) : (
            <SteelIcon
              icon={WhiteboardIcon}
              size={16}
              className='text-muted-foreground'
            />
          )}
        </span>
        <span className='flex min-w-0 flex-col items-start text-left'>
          <span className='w-full truncate'>{title}</span>
          <span className='w-full truncate text-xs font-normal text-muted-foreground'>
            {editedLine(board)}
          </span>
        </span>
      </ButtonLink>
      {canEdit && (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant='ghost'
                size='icon-sm'
                aria-label={`Ações de ${title}`}
                className='shrink-0 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 data-popup-open:opacity-100 max-md:opacity-100'
              >
                <SteelIcon icon={MoreHorizontalIcon} strokeWidth={2} />
              </Button>
            }
          />
          <DropdownMenuContent align='end'>
            {!isArchived && (
              <DropdownMenuItem onClick={onRename}>
                <SteelIcon icon={PencilEdit01Icon} strokeWidth={2} />
                Renomear
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={handleDuplicate}>
              <SteelIcon icon={Copy01Icon} strokeWidth={2} />
              Duplicar
            </DropdownMenuItem>
            {canArchive && (
              <DropdownMenuItem onClick={handleArchive}>
                <SteelIcon
                  icon={isArchived ? ArrowTurnBackwardIcon : Archive01Icon}
                  strokeWidth={2}
                />
                {isArchived ? 'Restaurar' : 'Arquivar'}
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  )
}
