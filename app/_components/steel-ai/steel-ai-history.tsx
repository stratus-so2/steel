'use client'

import {
  Delete02Icon,
  MoreHorizontalIcon,
  PencilEdit02Icon,
  PinIcon,
  PinOffIcon,
  Search01Icon,
} from '@hugeicons-pro/core-stroke-rounded'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { SteelIcon } from '@/components/icon/icon'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@/components/ui/input-group'
import { Skeleton } from '@/components/ui/skeleton'
import { notify } from '@/lib/notify'
import { cn } from '@/lib/utils'
import {
  useDeleteSteelAiConversation,
  useSteelAiConversations,
  useUpdateSteelAiConversation,
} from '@/src/hooks/use-steel-ai'
import type { AiConversationDTO } from '@/types/steel-ai'
import { useSteelAiWorkspace } from './steel-ai-context'

export const STEEL_AI_UNTITLED = 'Nova conversa'

function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms)
    return () => clearTimeout(timer)
  }, [value, ms])
  return debounced
}

/**
 * Conversation history: search, pinned first, then recent; each row can be
 * pinned, renamed inline or deleted (with confirmation). Used in the
 * context sidebar and, on small screens, inside a Sheet.
 */
export function SteelAiHistory({ onNavigate }: { onNavigate?: () => void }) {
  const { workspaceId, slug } = useSteelAiWorkspace()
  const [search, setSearch] = useState('')
  const q = useDebounced(search, 300)
  const conversations = useSteelAiConversations(workspaceId, q)
  const [deleting, setDeleting] = useState<AiConversationDTO | null>(null)
  const deleteConversation = useDeleteSteelAiConversation(workspaceId)
  const router = useRouter()
  const pathname = usePathname()

  const list = conversations.data ?? []
  const pinned = list.filter((c) => c.pinnedAt !== null)
  const recent = list.filter((c) => c.pinnedAt === null)

  async function confirmDelete() {
    if (!deleting) return
    const target = deleting
    try {
      await deleteConversation.mutateAsync(target.id)
      setDeleting(null)
      notify.success('Conversa excluída.')
      if (pathname === `/${slug}/ai/${target.id}`) router.push(`/${slug}/ai`)
    } catch (error) {
      notify.error(error)
    }
  }

  return (
    <div className='flex flex-col gap-3'>
      <InputGroup className='h-8'>
        <InputGroupAddon>
          <SteelIcon icon={Search01Icon} strokeWidth={2} />
        </InputGroupAddon>
        <InputGroupInput
          type='search'
          aria-label='Buscar conversas'
          placeholder='Buscar conversas'
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className='h-8 text-sm'
        />
      </InputGroup>

      {conversations.isLoading ? (
        <div className='space-y-1.5' aria-hidden>
          {[0, 1, 2, 3, 4].map((key) => (
            <Skeleton key={key} className='h-7 rounded-md' />
          ))}
        </div>
      ) : conversations.isError ? (
        <p className='px-2 text-destructive text-xs'>
          Não foi possível carregar as conversas.
        </p>
      ) : list.length === 0 ? (
        <p className='px-2 text-muted-foreground text-xs'>
          {q.trim()
            ? 'Nenhuma conversa encontrada.'
            : 'Suas conversas com o Steel AI aparecem aqui.'}
        </p>
      ) : (
        <>
          {pinned.length > 0 ? (
            <HistoryGroup
              title='Fixadas'
              items={pinned}
              onNavigate={onNavigate}
              onDelete={setDeleting}
            />
          ) : null}
          {recent.length > 0 ? (
            <HistoryGroup
              title='Recentes'
              items={recent}
              onNavigate={onNavigate}
              onDelete={setDeleting}
            />
          ) : null}
        </>
      )}

      <AlertDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir conversa?</AlertDialogTitle>
            <AlertDialogDescription>
              “{deleting?.title || STEEL_AI_UNTITLED}” sai do seu histórico. As
              ações já executadas pelo Steel AI continuam valendo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <Button
              variant='destructive'
              disabled={deleteConversation.isPending}
              onClick={confirmDelete}
            >
              Excluir
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function HistoryGroup({
  title,
  items,
  onNavigate,
  onDelete,
}: {
  title: string
  items: AiConversationDTO[]
  onNavigate?: () => void
  onDelete: (conversation: AiConversationDTO) => void
}) {
  return (
    <section className='space-y-0.5'>
      <h4 className='px-2 pb-1 font-medium text-muted-foreground text-xs'>
        {title}
      </h4>
      <ul className='space-y-0.5'>
        {items.map((conversation) => (
          <HistoryItem
            key={conversation.id}
            conversation={conversation}
            onNavigate={onNavigate}
            onDelete={onDelete}
          />
        ))}
      </ul>
    </section>
  )
}

function HistoryItem({
  conversation,
  onNavigate,
  onDelete,
}: {
  conversation: AiConversationDTO
  onNavigate?: () => void
  onDelete: (conversation: AiConversationDTO) => void
}) {
  const { workspaceId, slug } = useSteelAiWorkspace()
  const pathname = usePathname()
  const update = useUpdateSteelAiConversation(workspaceId)
  const [renaming, setRenaming] = useState(false)
  const [title, setTitle] = useState('')
  const href = `/${slug}/ai/${conversation.id}`
  const active = pathname === href
  const label = conversation.title || STEEL_AI_UNTITLED
  const isPinned = conversation.pinnedAt !== null

  async function save() {
    const next = title.trim()
    setRenaming(false)
    if (!next || next === conversation.title) return
    try {
      await update.mutateAsync({
        conversationId: conversation.id,
        data: { title: next },
      })
    } catch (error) {
      notify.error(error)
    }
  }

  async function togglePin() {
    try {
      await update.mutateAsync({
        conversationId: conversation.id,
        data: { pinned: !isPinned },
      })
    } catch (error) {
      notify.error(error)
    }
  }

  if (renaming) {
    return (
      <li>
        <Input
          autoFocus
          aria-label='Novo título da conversa'
          value={title}
          maxLength={200}
          onChange={(event) => setTitle(event.target.value)}
          onBlur={save}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              save()
            }
            if (event.key === 'Escape') setRenaming(false)
          }}
          className='h-8 text-sm'
        />
      </li>
    )
  }

  return (
    <li
      className={cn(
        'group flex items-center gap-0.5 rounded-md pr-0.5 transition-colors hover:bg-muted',
        active && 'bg-secondary',
      )}
    >
      <Link
        href={href}
        onClick={onNavigate}
        aria-current={active ? 'page' : undefined}
        className='flex min-w-0 flex-1 items-center gap-1.5 px-2 py-1.5 text-sm'
      >
        {isPinned ? (
          <SteelIcon
            icon={PinIcon}
            strokeWidth={2}
            className='size-3.5 shrink-0 text-muted-foreground'
          />
        ) : null}
        <span className='truncate'>{label}</span>
      </Link>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant='ghost'
              size='icon-xs'
              aria-label={`Ações de ${label}`}
              className='shrink-0 opacity-100 md:opacity-0 md:group-hover:opacity-100 md:data-popup-open:opacity-100 md:focus-visible:opacity-100'
            >
              <SteelIcon icon={MoreHorizontalIcon} strokeWidth={2} />
            </Button>
          }
        />
        <DropdownMenuContent align='end' className='w-40'>
          <DropdownMenuItem onClick={togglePin}>
            <SteelIcon icon={isPinned ? PinOffIcon : PinIcon} strokeWidth={2} />
            {isPinned ? 'Desafixar' : 'Fixar'}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => {
              setTitle(conversation.title ?? '')
              setRenaming(true)
            }}
          >
            <SteelIcon icon={PencilEdit02Icon} strokeWidth={2} />
            Renomear
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant='destructive'
            onClick={() => onDelete(conversation)}
          >
            <SteelIcon icon={Delete02Icon} strokeWidth={2} />
            Excluir
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  )
}
