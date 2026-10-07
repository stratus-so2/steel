'use client'

import {
  Archive02Icon,
  ArchiveRestoreIcon,
  Delete02Icon,
  KeyboardIcon,
  MailOpen01Icon,
  Search01Icon,
} from '@hugeicons-pro/core-stroke-rounded'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { SteelIcon } from '@/components/icon/icon'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { notify } from '@/lib/notify'
import { cn } from '@/lib/utils'
import {
  useMarkNotificationsRead,
  useNotificationAction,
  useNotificationInbox,
  useNotificationStream,
} from '@/src/hooks/use-notifications'
import {
  NOTIFICATION_MODULE_LABELS,
  type NotificationModule,
  notificationKindCatalog,
} from '@/src/lib/notification-kind'
import type { NotificationAction } from '@/src/schemas/notification.schema'
import type { NotificationDTO } from '@/types/notification'
import { NotificationList } from './notification-list'
import { NotificationReadingPanel } from './notification-reading-panel'
import { NotificationShortcutsDialog } from './notification-shortcuts-dialog'

type Folder = 'all' | 'unread' | 'archived'

const FOLDERS: { value: Folder; label: string }[] = [
  { value: 'all', label: 'Tudo' },
  { value: 'unread', label: 'Não lidas' },
  { value: 'archived', label: 'Arquivadas' },
]

/** Módulos oferecidos no filtro, na ordem do produto. */
const FILTER_MODULES: NotificationModule[] = [
  'SERVICE_DESK',
  'COMMUNICATION',
  'CRM',
  'OTHER',
]

const ALL = '__all__'

const UNDOABLE: Partial<Record<NotificationAction, NotificationAction>> = {
  archive: 'unarchive',
  unarchive: 'archive',
  delete: 'restore',
  read: 'unread',
  unread: 'read',
}

const ACTION_DONE: Record<NotificationAction, string> = {
  read: 'Marcada como lida',
  unread: 'Marcada como não lida',
  archive: 'Arquivada',
  unarchive: 'Desarquivada',
  delete: 'Excluída',
  restore: 'Restaurada',
  unsnooze: 'Adiamento desfeito',
}

const ACTION_DONE_MANY: Record<NotificationAction, string> = {
  read: 'Marcadas como lidas',
  unread: 'Marcadas como não lidas',
  archive: 'Arquivadas',
  unarchive: 'Desarquivadas',
  delete: 'Excluídas',
  restore: 'Restauradas',
  unsnooze: 'Adiamento desfeito',
}

/** Só dispara atalho quando o foco não está num campo de texto. */
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    target.isContentEditable
  )
}

/**
 * Caixa de entrada das notificações do workspace no formato de cliente de
 * e-mail: pastas, filtros, busca, lista à esquerda, leitura à direita,
 * seleção múltipla com ações em lote, desfazer e atalhos de teclado. No
 * celular vira coluna única (lista → detalhe).
 */
export function NotificationInbox({ workspaceId }: { workspaceId: string }) {
  const router = useRouter()

  const [folder, setFolder] = useState<Folder>('all')
  const [moduleFilter, setModuleFilter] = useState<string>(ALL)
  const [kindFilter, setKindFilter] = useState<string>(ALL)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [activeId, setActiveId] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const searchRef = useRef<HTMLInputElement | null>(null)

  useNotificationStream(workspaceId)

  // Busca com pequeno atraso: a tecla "/" foca o campo e cada letra não
  // dispara uma consulta.
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim()), 350)
    return () => clearTimeout(timer)
  }, [searchInput])

  const filters = useMemo(
    () => ({
      folder,
      module:
        moduleFilter === ALL ? undefined : (moduleFilter as NotificationModule),
      kind: kindFilter === ALL ? undefined : kindFilter,
      search: search || undefined,
    }),
    [folder, moduleFilter, kindFilter, search],
  )

  const inbox = useNotificationInbox(workspaceId, filters)
  const action = useNotificationAction(workspaceId)
  const markRead = useMarkNotificationsRead(workspaceId)

  const items = useMemo(
    () => inbox.data?.pages.flatMap((page) => page.items) ?? [],
    [inbox.data],
  )
  const counts = inbox.data?.pages[0]?.counts ?? {
    all: 0,
    unread: 0,
    archived: 0,
  }

  const active = items.find((item) => item.id === activeId) ?? null

  const kindOptions = useMemo(() => {
    const catalog = notificationKindCatalog()
    return moduleFilter === ALL
      ? catalog
      : catalog.filter((info) => info.module === moduleFilter)
  }, [moduleFilter])

  /** Põe o foco na linha (os atalhos `j`/`k` movem o foco de verdade). */
  const focusRow = useCallback((id: string) => {
    const node = document.querySelector<HTMLElement>(
      `[data-notification-row="${id}"]`,
    )
    node?.focus()
  }, [])

  const run = useCallback(
    (
      verb: NotificationAction,
      ids: string[],
      { undoable = true }: { undoable?: boolean } = {},
    ) => {
      if (ids.length === 0) return
      action.mutate(
        { action: verb, ids },
        {
          onSuccess: () => {
            setSelectedIds(new Set())
            if (
              ids.includes(activeId ?? '') &&
              verb !== 'read' &&
              verb !== 'unread'
            ) {
              setActiveId(null)
            }
            const label =
              ids.length === 1 ? ACTION_DONE[verb] : ACTION_DONE_MANY[verb]
            const message =
              ids.length === 1 ? label : `${ids.length} notificações · ${label}`
            const undo = undoable ? UNDOABLE[verb] : undefined
            if (undo) {
              toast.success(message, {
                action: {
                  label: 'Desfazer',
                  onClick: () => run(undo, ids, { undoable: false }),
                },
              })
            } else {
              notify.success(message)
            }
          },
          onError: (error) =>
            notify.error(error, 'Não foi possível atualizar as notificações'),
        },
      )
    },
    [action, activeId],
  )

  const open = useCallback(
    (notification: NotificationDTO) => {
      setActiveId(notification.id)
      if (!notification.read) {
        action.mutate({ action: 'read', ids: [notification.id] })
      }
    },
    [action],
  )

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const archiveOf = useCallback(
    (notification: NotificationDTO) =>
      run(notification.archived ? 'unarchive' : 'archive', [notification.id]),
    [run],
  )

  // Atalhos de cliente de e-mail. `j`/`k` movem o foco pela lista; as ações
  // usam a linha em foco (ou a aberta no painel).
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return

      if (isTypingTarget(event.target)) {
        if (event.key === 'Escape') {
          ;(event.target as HTMLElement).blur()
        }
        return
      }

      const focusedId =
        document.activeElement instanceof HTMLElement
          ? document.activeElement.dataset.notificationRow
          : undefined
      const currentId = focusedId ?? activeId
      const index = items.findIndex((item) => item.id === currentId)
      const current = index >= 0 ? items[index] : null

      switch (event.key) {
        case 'j': {
          event.preventDefault()
          const next = items[index + 1] ?? items[0]
          if (next) focusRow(next.id)
          break
        }
        case 'k': {
          event.preventDefault()
          const previous =
            index > 0 ? items[index - 1] : items[items.length - 1]
          if (previous) focusRow(previous.id)
          break
        }
        case 'Enter': {
          if (!current || focusedId) return
          event.preventDefault()
          open(current)
          break
        }
        case 'u': {
          event.preventDefault()
          setActiveId(null)
          if (current) focusRow(current.id)
          break
        }
        case 'e': {
          if (!current) return
          event.preventDefault()
          archiveOf(current)
          break
        }
        case '#': {
          if (!current) return
          event.preventDefault()
          run('delete', [current.id])
          break
        }
        case 'x': {
          if (!current) return
          event.preventDefault()
          toggleSelect(current.id)
          break
        }
        case '/': {
          event.preventDefault()
          searchRef.current?.focus()
          break
        }
        case '?': {
          event.preventDefault()
          setShortcutsOpen(true)
          break
        }
        case 'Escape': {
          if (selectedIds.size > 0) setSelectedIds(new Set())
          break
        }
        default:
          break
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [
    items,
    activeId,
    selectedIds,
    focusRow,
    open,
    archiveOf,
    run,
    toggleSelect,
  ])

  const selectedList = Array.from(selectedIds)
  const emptyLabel =
    search || moduleFilter !== ALL || kindFilter !== ALL
      ? 'Nada encontrado com esses filtros.'
      : folder === 'archived'
        ? 'Nenhuma notificação arquivada.'
        : folder === 'unread'
          ? 'Tudo em dia: nenhuma não lida.'
          : 'Nenhuma notificação por aqui.'

  return (
    <div className='flex h-full min-h-0 flex-col'>
      <div className='flex flex-wrap items-center gap-2 border-b px-4 py-3'>
        <Tabs
          value={folder}
          onValueChange={(value) => {
            setFolder(value as Folder)
            setActiveId(null)
            setSelectedIds(new Set())
          }}
        >
          <TabsList aria-label='Pastas'>
            {FOLDERS.map((item) => (
              <TabsTrigger key={item.value} value={item.value}>
                {item.label}
                {item.value === 'unread' && counts.unread > 0 ? (
                  <Badge variant='secondary'>{counts.unread}</Badge>
                ) : null}
                {item.value === 'archived' && counts.archived > 0 ? (
                  <Badge variant='ghost'>{counts.archived}</Badge>
                ) : null}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className='relative ml-auto w-full max-w-xs'>
          <SteelIcon
            icon={Search01Icon}
            size={16}
            strokeWidth={2}
            className='-translate-y-1/2 absolute top-1/2 left-2.5 text-muted-foreground'
          />
          <Input
            ref={searchRef}
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder='Buscar nas notificações…'
            aria-label='Buscar nas notificações'
            className='pl-8'
          />
        </div>

        <Select
          items={[
            { value: ALL, label: 'Todos os módulos' },
            ...FILTER_MODULES.map((module) => ({
              value: module,
              label: NOTIFICATION_MODULE_LABELS[module],
            })),
          ]}
          value={moduleFilter}
          onValueChange={(value) => {
            setModuleFilter(value as string)
            setKindFilter(ALL)
          }}
        >
          <SelectTrigger className='w-40' aria-label='Filtrar por módulo'>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value={ALL}>Todos os módulos</SelectItem>
              {FILTER_MODULES.map((module) => (
                <SelectItem key={module} value={module}>
                  {NOTIFICATION_MODULE_LABELS[module]}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>

        <Select
          items={[
            { value: ALL, label: 'Todos os tipos' },
            ...kindOptions.map((info) => ({
              value: info.kind,
              label: info.label,
            })),
          ]}
          value={kindFilter}
          onValueChange={(value) => setKindFilter(value as string)}
        >
          <SelectTrigger className='w-44' aria-label='Filtrar por tipo'>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value={ALL}>Todos os tipos</SelectItem>
              {kindOptions.map((info) => (
                <SelectItem key={info.kind} value={info.kind}>
                  {info.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>

        <Button
          size='xs'
          variant='outline'
          disabled={counts.unread === 0 || markRead.isPending}
          onClick={() =>
            markRead.mutate(undefined, {
              onSuccess: () => notify.success('Tudo marcado como lido'),
              onError: (error) =>
                notify.error(error, 'Não foi possível marcar como lidas'),
            })
          }
        >
          Marcar todas como lidas
        </Button>

        <Button
          size='icon-sm'
          variant='ghost'
          aria-label='Atalhos do teclado'
          onClick={() => setShortcutsOpen(true)}
        >
          <SteelIcon icon={KeyboardIcon} size={18} strokeWidth={2} />
        </Button>
      </div>

      {selectedList.length > 0 ? (
        <div
          role='toolbar'
          aria-label='Ações da seleção'
          className='flex flex-wrap items-center gap-2 border-b bg-muted/40 px-4 py-2'
        >
          <span className='text-sm'>
            {selectedList.length === 1
              ? '1 selecionada'
              : `${selectedList.length} selecionadas`}
          </span>
          <Button
            size='xs'
            variant='outline'
            onClick={() => run('read', selectedList)}
          >
            <SteelIcon icon={MailOpen01Icon} size={16} strokeWidth={2} />
            Marcar como lida
          </Button>
          <Button
            size='xs'
            variant='outline'
            onClick={() =>
              run(folder === 'archived' ? 'unarchive' : 'archive', selectedList)
            }
          >
            <SteelIcon
              icon={folder === 'archived' ? ArchiveRestoreIcon : Archive02Icon}
              size={16}
              strokeWidth={2}
            />
            {folder === 'archived' ? 'Desarquivar' : 'Arquivar'}
          </Button>
          <Button
            size='xs'
            variant='outline'
            onClick={() => run('delete', selectedList)}
          >
            <SteelIcon icon={Delete02Icon} size={16} strokeWidth={2} />
            Excluir
          </Button>
          <Button
            size='xs'
            variant='ghost'
            className='ml-auto'
            onClick={() => setSelectedIds(new Set())}
          >
            Limpar seleção
          </Button>
        </div>
      ) : null}

      <div className='grid min-h-0 flex-1 lg:grid-cols-[minmax(20rem,26rem)_1fr]'>
        <div
          className={cn(
            'min-h-0 overflow-y-auto lg:border-r',
            // Coluna única no celular: com uma notificação aberta, a lista
            // sai de cena e o painel ocupa a tela.
            active ? 'hidden lg:block' : 'block',
          )}
        >
          <NotificationList
            items={items}
            activeId={activeId}
            selectedIds={selectedIds}
            loading={inbox.isLoading}
            hasNextPage={Boolean(inbox.hasNextPage)}
            loadingMore={inbox.isFetchingNextPage}
            onOpen={open}
            onToggleSelect={toggleSelect}
            onLoadMore={() => {
              if (inbox.hasNextPage && !inbox.isFetchingNextPage) {
                inbox.fetchNextPage()
              }
            }}
            emptyLabel={emptyLabel}
          />
        </div>

        <div className={cn('min-h-0', active ? 'block' : 'hidden lg:block')}>
          <NotificationReadingPanel
            workspaceId={workspaceId}
            notification={active}
            onBack={() => setActiveId(null)}
            onToggleRead={(notification) =>
              run(notification.read ? 'unread' : 'read', [notification.id])
            }
            onArchive={archiveOf}
            onDelete={(notification) => run('delete', [notification.id])}
            onOpenHref={(notification) => {
              if (notification.href) router.push(notification.href)
            }}
          />
        </div>
      </div>

      <NotificationShortcutsDialog
        open={shortcutsOpen}
        onOpenChange={setShortcutsOpen}
      />
    </div>
  )
}
