'use client'

import {
  AiMagicIcon,
  BookOpen01Icon,
  Briefcase01Icon,
  Building03Icon,
  Clock01Icon,
  ContactIcon,
  File01Icon,
  Message01Icon,
  PlusSignIcon,
  SearchIcon,
  ServerStack01Icon,
  Target02Icon,
  TaskDone01Icon,
  Ticket01Icon,
  UserGroupIcon,
  UserIcon,
  WhatsappIcon,
} from '@hugeicons-pro/core-stroke-rounded'
import { usePathname, useRouter } from 'next/navigation'
import {
  Fragment,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { stashSteelAiPrompt } from '@/app/_components/steel-ai/steel-ai-handoff'
import { SteelIcon } from '@/components/icon/icon'
import { Button } from '@/components/ui/button'
import {
  CommandDialog,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  Command as CommandRoot,
  CommandSeparator,
} from '@/components/ui/command'
import { Kbd } from '@/components/ui/kbd'
import { useGlobalSearch } from '@/src/hooks/use-global-search'
import {
  useCreateSteelAiConversation,
  useSteelAiCapabilities,
} from '@/src/hooks/use-steel-ai'
import type { SearchEntityType } from '@/src/lib/search/search-entities'
import { highlightRanges } from '@/src/lib/search/search-query'
import type { SearchResultDTO } from '@/types/search'

type IconType = typeof SearchIcon

const TYPE_ICON: Record<SearchEntityType, IconType> = {
  'sd-ticket': Ticket01Icon,
  'sd-kb-article': BookOpen01Icon,
  'sd-customer': Building03Icon,
  'sd-contact': ContactIcon,
  'sd-config-item': ServerStack01Icon,
  'crm-lead': Target02Icon,
  'crm-opportunity': Briefcase01Icon,
  'crm-person': UserIcon,
  'crm-company': Building03Icon,
  'crm-task': TaskDone01Icon,
  'crm-proposal': File01Icon,
  'zap-conversation': Message01Icon,
  'zap-contact': WhatsappIcon,
  member: UserGroupIcon,
}

const RECENT_MAX = 6

function recentKey(workspaceId: string) {
  return `steel:search-recent:${workspaceId}`
}

export function readRecentSearches(workspaceId: string): string[] {
  try {
    const raw = window.localStorage.getItem(recentKey(workspaceId))
    const parsed: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed)
      ? parsed
          .filter((v): v is string => typeof v === 'string')
          .slice(0, RECENT_MAX)
      : []
  } catch {
    return []
  }
}

export function pushRecentSearch(workspaceId: string, query: string): string[] {
  const value = query.trim()
  if (!value) return readRecentSearches(workspaceId)
  const next = [
    value,
    ...readRecentSearches(workspaceId).filter(
      (q) => q.toLowerCase() !== value.toLowerCase(),
    ),
  ].slice(0, RECENT_MAX)
  try {
    window.localStorage.setItem(recentKey(workspaceId), JSON.stringify(next))
  } catch {
    // Private mode / blocked storage: recents just are not remembered.
  }
  return next
}

/** Bolds the parts of `text` that match the query (accent-insensitive). */
export function SearchHighlight({
  text,
  query,
}: {
  text: string
  query: string
}) {
  const ranges = highlightRanges(text, query)
  if (!ranges.length) return <>{text}</>
  const parts: ReactNode[] = []
  let cursor = 0
  for (const [start, end] of ranges) {
    if (start > cursor) parts.push(text.slice(cursor, start))
    parts.push(
      <mark
        key={start}
        className='rounded-[2px] bg-primary/15 font-semibold text-foreground'
      >
        {text.slice(start, end)}
      </mark>,
    )
    cursor = end
  }
  if (cursor < text.length) parts.push(text.slice(cursor))
  return <>{parts}</>
}

/** Results grouped by type, groups in order of their best result. */
export function groupSearchResults(results: readonly SearchResultDTO[]) {
  const groups = new Map<string, SearchResultDTO[]>()
  for (const result of results) {
    const list = groups.get(result.group)
    if (list) list.push(result)
    else groups.set(result.group, [result])
  }
  return [...groups.entries()].map(([group, items]) => ({ group, items }))
}

function useIsMac() {
  const [mac, setMac] = useState(false)
  useEffect(() => {
    setMac(/Mac|iPhone|iPad/.test(window.navigator.platform))
  }, [])
  return mac
}

/**
 * Global search (Ctrl+K / ⌘K): header trigger + command palette. The
 * palette body only mounts while open, so closed it costs no request.
 */
export function GlobalSearch({
  slug,
  workspaceId,
}: {
  slug: string
  workspaceId: string
}) {
  const [open, setOpen] = useState(false)
  const isMac = useIsMac()

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (
        event.key.toLowerCase() === 'k' &&
        (event.metaKey || event.ctrlKey) &&
        !event.altKey
      ) {
        event.preventDefault()
        setOpen((value) => !value)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <>
      <Button
        variant='outline'
        size='sm'
        className='hidden w-56 justify-start gap-2 text-muted-foreground lg:inline-flex'
        onClick={() => setOpen(true)}
        aria-label='Buscar no workspace'
      >
        <SteelIcon icon={SearchIcon} strokeWidth={2} />
        <span className='flex-1 text-left font-normal'>Buscar…</span>
        <Kbd>{isMac ? '⌘K' : 'Ctrl K'}</Kbd>
      </Button>
      <Button
        variant='ghost'
        size='icon-sm'
        className='lg:hidden'
        onClick={() => setOpen(true)}
        aria-label='Buscar no workspace'
      >
        <SteelIcon icon={SearchIcon} strokeWidth={2} size={20} />
      </Button>
      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title='Busca global'
        description='Busque chamados, artigos, clientes, leads, conversas e membros.'
        className='max-sm:top-0 max-sm:left-0 max-sm:flex max-sm:h-dvh max-sm:flex-col max-sm:max-w-none max-sm:translate-x-0 max-sm:rounded-none! sm:top-[12vh] sm:max-w-xl'
      >
        {open ? (
          <GlobalSearchPalette
            slug={slug}
            workspaceId={workspaceId}
            onClose={() => setOpen(false)}
          />
        ) : null}
      </CommandDialog>
    </>
  )
}

export function GlobalSearchPalette({
  slug,
  workspaceId,
  onClose,
}: {
  slug: string
  workspaceId: string
  onClose: () => void
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [query, setQuery] = useState('')
  const [recent, setRecent] = useState<string[]>([])
  const search = useGlobalSearch(workspaceId, query)
  const capabilities = useSteelAiCapabilities(workspaceId)
  const createConversation = useCreateSteelAiConversation(workspaceId)

  useEffect(() => setRecent(readRecentSearches(workspaceId)), [workspaceId])

  const trimmed = query.trim()
  const results = trimmed ? (search.data?.results ?? []) : []
  const groups = useMemo(() => groupSearchResults(results), [results])
  // New results: the best match is the one Enter opens (cmdk would keep
  // the previous selection, e.g. a quick action from the empty state).
  const [selected, setSelected] = useState('')
  const firstKey = groups[0]
    ? `${groups[0].items[0].type}:${groups[0].items[0].id}`
    : ''
  useEffect(() => {
    if (firstKey) setSelected(firstKey)
  }, [firstKey])
  const modules = capabilities.data?.modules ?? []
  const aiEnabled = capabilities.data?.aiEnabled ?? false
  const loading = Boolean(trimmed) && (search.isDebouncing || search.isFetching)
  const settled = Boolean(trimmed) && !loading && search.isSuccess

  const go = useCallback(
    (href: string) => {
      onClose()
      // Same page with another `?record=`: the page reads the param on
      // mount, so a full navigation is what actually opens the record.
      const target = new URL(href, window.location.origin)
      if (target.pathname === pathname) window.location.assign(href)
      else router.push(href)
    },
    [onClose, pathname, router],
  )

  function openResult(result: SearchResultDTO) {
    setRecent(pushRecentSearch(workspaceId, trimmed))
    go(result.href)
  }

  async function askSteelAi() {
    const prompt = trimmed
    onClose()
    try {
      const conversation = await createConversation.mutateAsync({
        mode: 'EXPLORE',
      })
      stashSteelAiPrompt(conversation.id, { content: prompt, mode: 'EXPLORE' })
      router.push(`/${slug}/ai/${conversation.id}`)
    } catch {
      router.push(`/${slug}/ai`)
    }
  }

  const quickActions = (
    <CommandGroup heading='Ações rápidas'>
      {trimmed && aiEnabled ? (
        <CommandItem value='action:ai' onSelect={askSteelAi}>
          <SteelIcon icon={AiMagicIcon} strokeWidth={2} />
          <span className='truncate'>
            Perguntar ao Steel AI: <strong>{trimmed}</strong>
          </span>
        </CommandItem>
      ) : null}
      {modules.includes('SERVICE_DESK') ? (
        <CommandItem
          value='action:new-ticket'
          onSelect={() => go(`/${slug}/servicedesk/tickets?new=1`)}
        >
          <SteelIcon icon={PlusSignIcon} strokeWidth={2} />
          Novo chamado
        </CommandItem>
      ) : null}
      {modules.includes('CRM') ? (
        <CommandItem
          value='action:new-lead'
          onSelect={() => go(`/${slug}/crm/leads?new=1`)}
        >
          <SteelIcon icon={PlusSignIcon} strokeWidth={2} />
          Novo lead
        </CommandItem>
      ) : null}
      {!trimmed && aiEnabled ? (
        <CommandItem value='action:ai-open' onSelect={() => go(`/${slug}/ai`)}>
          <SteelIcon icon={AiMagicIcon} strokeWidth={2} />
          Abrir o Steel AI
        </CommandItem>
      ) : null}
    </CommandGroup>
  )

  return (
    <CommandRoot
      shouldFilter={false}
      loop
      value={selected}
      onValueChange={setSelected}
      className='max-sm:h-full'
    >
      <CommandInput
        value={query}
        onValueChange={setQuery}
        placeholder='Buscar chamados, clientes, leads, conversas…'
        aria-label='Buscar no workspace'
      />
      <CommandList className='max-h-[min(62vh,30rem)] max-sm:max-h-none max-sm:flex-1'>
        {!trimmed ? (
          <>
            {recent.length ? (
              <CommandGroup heading='Buscas recentes'>
                {recent.map((q) => (
                  <CommandItem
                    key={q}
                    value={`recent:${q}`}
                    onSelect={() => setQuery(q)}
                  >
                    <SteelIcon icon={Clock01Icon} strokeWidth={2} />
                    {q}
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : (
              <p className='px-3 py-4 text-muted-foreground text-xs'>
                Digite um nome, código (INC-000123), telefone ou e-mail.
              </p>
            )}
            <CommandSeparator />
            {quickActions}
          </>
        ) : (
          <>
            {groups.map(({ group, items }, index) => (
              <Fragment key={group}>
                {index > 0 ? <CommandSeparator /> : null}
                <CommandGroup heading={group}>
                  {items.map((result) => (
                    <CommandItem
                      key={`${result.type}:${result.id}`}
                      value={`${result.type}:${result.id}`}
                      onSelect={() => openResult(result)}
                      className='items-start'
                    >
                      <SteelIcon
                        icon={TYPE_ICON[result.type]}
                        strokeWidth={2}
                        className='mt-0.5'
                      />
                      <span className='flex min-w-0 flex-1 flex-col'>
                        <span className='truncate'>
                          <SearchHighlight
                            text={result.title}
                            query={trimmed}
                          />
                        </span>
                        {result.subtitle || result.snippet ? (
                          <span className='truncate text-muted-foreground text-xs'>
                            <SearchHighlight
                              text={result.subtitle ?? result.snippet ?? ''}
                              query={trimmed}
                            />
                          </span>
                        ) : null}
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </Fragment>
            ))}
            {loading && !groups.length ? (
              <p className='px-3 py-6 text-center text-muted-foreground text-sm'>
                Buscando…
              </p>
            ) : null}
            {search.isError ? (
              <p className='px-3 py-6 text-center text-destructive text-sm'>
                Não foi possível buscar agora. Tente de novo.
              </p>
            ) : null}
            {settled && !groups.length ? (
              <div className='px-3 py-6 text-center text-sm' role='status'>
                <p>
                  Nada encontrado para <strong>“{trimmed}”</strong>.
                </p>
                <p className='mt-1 text-muted-foreground text-xs'>
                  Confira a grafia, tente parte do nome ou busque pelo código,
                  telefone ou e-mail.
                </p>
              </div>
            ) : null}
            <CommandSeparator />
            {quickActions}
          </>
        )}
      </CommandList>
      <div className='flex items-center justify-between gap-2 border-t px-3 py-2 text-muted-foreground text-xs'>
        <span className='hidden items-center gap-1.5 sm:flex'>
          <Kbd>↑</Kbd>
          <Kbd>↓</Kbd> navegar <Kbd>↵</Kbd> abrir <Kbd>esc</Kbd> fechar
        </span>
        <span className='sm:hidden'>
          {results.length ? `${results.length} resultado(s)` : ''}
        </span>
        <Button
          variant='ghost'
          size='sm'
          className='sm:hidden'
          onClick={onClose}
        >
          Fechar
        </Button>
      </div>
    </CommandRoot>
  )
}
