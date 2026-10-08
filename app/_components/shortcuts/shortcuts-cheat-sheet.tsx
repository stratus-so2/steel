'use client'

import { Search01Icon } from '@hugeicons-pro/core-stroke-rounded'
import { useMemo, useState } from 'react'
import { SteelIcon } from '@/components/icon/icon'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  groupShortcuts,
  SHORTCUT_SCOPES,
  SHORTCUTS,
  type ShortcutDefinition,
  searchShortcuts,
} from '@/src/lib/shortcuts/registry'
import { ShortcutKbd } from './shortcut-kbd'
import { useShortcut, useShortcuts } from './shortcuts-provider'

type Tab = 'screen' | 'all'

/** Editor/composer entries count as "on screen" when an editor is there. */
function documentedOnScreen(entry: ShortcutDefinition): boolean {
  if (!SHORTCUT_SCOPES[entry.scope].documentationOnly) return false
  if (entry.id.startsWith('composer.')) {
    return Boolean(document.querySelector('[data-composer]'))
  }
  return Boolean(document.querySelector('[data-slate-editor], [data-composer]'))
}

function ShortcutList({ entries }: { entries: ShortcutDefinition[] }) {
  const groups = groupShortcuts(entries)
  if (groups.length === 0) {
    return (
      <p
        className='py-8 text-center text-muted-foreground text-sm'
        role='status'
      >
        Nenhum atalho encontrado.
      </p>
    )
  }
  return (
    <div className='space-y-5'>
      {groups.map((group) => (
        <section key={group.id} aria-labelledby={`shortcuts-${group.id}`}>
          <h3
            id={`shortcuts-${group.id}`}
            className='mb-2 font-medium text-muted-foreground text-xs uppercase tracking-wide'
          >
            {group.label}
          </h3>
          <ul className='divide-y divide-border'>
            {group.items.map((entry) => (
              <li
                key={entry.id}
                className='flex items-start justify-between gap-3 py-1.5'
                data-shortcut-id={entry.id}
              >
                <span className='min-w-0'>
                  <span className='block text-sm'>{entry.label}</span>
                  {entry.note ? (
                    <span className='block text-muted-foreground text-xs'>
                      {entry.note}
                    </span>
                  ) : null}
                </span>
                <ShortcutKbd
                  id={entry.id}
                  all
                  always
                  className='shrink-0 flex-wrap justify-end'
                />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

function CheatSheetBody({ activeIds }: { activeIds: Set<string> }) {
  const [query, setQuery] = useState('')
  const onScreen = useMemo(
    () =>
      SHORTCUTS.filter(
        (entry) => activeIds.has(entry.id) || documentedOnScreen(entry),
      ),
    [activeIds],
  )
  const [tab, setTab] = useState<Tab>(onScreen.length > 0 ? 'screen' : 'all')
  const source = tab === 'screen' ? onScreen : SHORTCUTS
  const entries = searchShortcuts(source, query)

  return (
    <div className='flex min-h-0 flex-1 flex-col gap-3'>
      <div className='relative'>
        <SteelIcon
          icon={Search01Icon}
          strokeWidth={2}
          size={16}
          className='-translate-y-1/2 pointer-events-none absolute top-1/2 left-2.5 text-muted-foreground'
        />
        <Input
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder='Buscar atalho (ex.: atribuir, nota, busca)'
          aria-label='Buscar atalho'
          className='pl-8'
        />
      </div>
      <Tabs value={tab} onValueChange={(value) => setTab(value as Tab)}>
        <TabsList>
          <TabsTrigger value='screen'>Nesta tela</TabsTrigger>
          <TabsTrigger value='all'>Todos</TabsTrigger>
        </TabsList>
      </Tabs>
      <div className='-mx-1 min-h-0 flex-1 overflow-y-auto px-1'>
        <ShortcutList entries={entries} />
      </div>
    </div>
  )
}

/**
 * Keyboard shortcuts dialog (`?`, `Ctrl+/`, Ajuda → Atalhos do teclado).
 * Opens on "Nesta tela" — the bindings mounted right now — with "Todos"
 * one click away; both are searchable.
 */
export function ShortcutsCheatSheet() {
  const ctx = useShortcuts()
  const open = ctx?.cheatSheetOpen ?? false
  const toggle = () => ctx?.setCheatSheetOpen(!open)
  useShortcut('global.shortcuts', toggle)
  useShortcut('global.shortcuts-typing', toggle)
  // Snapshot when it opens: the dialog itself must not change the list.
  const activeIds = useMemo(
    () => (open && ctx ? ctx.activeIds() : new Set<string>()),
    [open, ctx],
  )
  if (!ctx) return null

  return (
    <Dialog open={open} onOpenChange={ctx.setCheatSheetOpen}>
      <DialogContent className='flex max-h-[min(85dvh,44rem)] flex-col gap-4 sm:max-w-xl max-sm:top-0 max-sm:left-0 max-sm:h-dvh max-sm:max-h-dvh max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-none'>
        <DialogHeader>
          <DialogTitle>Atalhos do teclado</DialogTitle>
          <DialogDescription>
            {ctx.singleKeyEnabled
              ? 'Teclas simples não funcionam enquanto você digita num campo; Esc sai do campo.'
              : 'Os atalhos de uma tecla estão desligados nas suas preferências; os com Ctrl, Alt ou ⌘ continuam valendo.'}
          </DialogDescription>
        </DialogHeader>
        {open ? <CheatSheetBody activeIds={activeIds} /> : null}
      </DialogContent>
    </Dialog>
  )
}
