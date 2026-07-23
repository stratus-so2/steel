'use client'

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useCrmResourceList } from '@/src/hooks/use-crm-resource-list'
import type { CrmMailingListDTO } from '@/types/crm-email-marketing'
import type { CrmPersonDTO } from '@/types/crm-person'

export type RecipientSelection =
  | { scope: 'ALL' }
  | { scope: 'SELECTED'; mode: 'people'; personIds: string[] }
  | { scope: 'SELECTED'; mode: 'list'; mailingListId: string }

/**
 * Escolha de destinatários. Diferente do original (que combina pessoas +
 * várias listas + e-mails avulsos numa única seleção), o backend do Steel só
 * aceita `personIds` OU um único `mailingListId` por campanha — então aqui a
 * escolha é: todos, um grupo de pessoas, ou uma lista.
 */
export function CrmEmailCampaignRecipientPicker({
  workspaceId,
  value,
  onChange,
}: {
  workspaceId: string
  value: RecipientSelection
  onChange: (next: RecipientSelection) => void
}) {
  return (
    <div className='flex flex-col gap-3'>
      <div className='flex gap-2'>
        <Button
          type='button'
          size='xs'
          variant={value.scope === 'ALL' ? 'default' : 'outline'}
          onClick={() => onChange({ scope: 'ALL' })}
        >
          Todos os contatos
        </Button>
        <Button
          type='button'
          size='xs'
          variant={
            value.scope === 'SELECTED' && value.mode === 'people'
              ? 'default'
              : 'outline'
          }
          onClick={() =>
            onChange({ scope: 'SELECTED', mode: 'people', personIds: [] })
          }
        >
          Pessoas específicas
        </Button>
        <Button
          type='button'
          size='xs'
          variant={
            value.scope === 'SELECTED' && value.mode === 'list'
              ? 'default'
              : 'outline'
          }
          onClick={() =>
            onChange({ scope: 'SELECTED', mode: 'list', mailingListId: '' })
          }
        >
          Lista de mailing
        </Button>
      </div>

      {value.scope === 'SELECTED' && value.mode === 'people' ? (
        <PeoplePicker
          workspaceId={workspaceId}
          selectedIds={value.personIds}
          onChangeIds={(personIds) =>
            onChange({ scope: 'SELECTED', mode: 'people', personIds })
          }
        />
      ) : null}

      {value.scope === 'SELECTED' && value.mode === 'list' ? (
        <MailingListPicker
          workspaceId={workspaceId}
          selectedId={value.mailingListId}
          onChangeId={(mailingListId) =>
            onChange({ scope: 'SELECTED', mode: 'list', mailingListId })
          }
        />
      ) : null}
    </div>
  )
}

function PeoplePicker({
  workspaceId,
  selectedIds,
  onChangeIds,
}: {
  workspaceId: string
  selectedIds: string[]
  onChangeIds: (ids: string[]) => void
}) {
  const { items: people, isLoading } = useCrmResourceList<CrmPersonDTO>(
    workspaceId,
    'people',
  )
  const [search, setSearch] = useState('')

  const peopleWithEmail = useMemo(
    () => people.filter((p) => p.emails.length > 0),
    [people],
  )
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return peopleWithEmail
    return peopleWithEmail.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.emails.some((e) => e.toLowerCase().includes(q)),
    )
  }, [peopleWithEmail, search])

  const selected = new Set(selectedIds)

  function toggle(id: string) {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    onChangeIds(Array.from(next))
  }

  return (
    <div className='flex flex-col gap-2'>
      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder='Buscar pessoa…'
      />
      <p className='text-muted-foreground text-xs'>
        {selectedIds.length} selecionada(s)
      </p>
      {isLoading ? null : (
        <ul className='max-h-64 divide-y divide-border overflow-auto rounded-lg border border-border'>
          {filtered.map((p) => (
            <li key={p.id}>
              <label className='flex cursor-pointer items-center gap-2 px-3 py-2 text-sm hover:bg-muted'>
                <input
                  type='checkbox'
                  className='size-4 accent-primary'
                  checked={selected.has(p.id)}
                  onChange={() => toggle(p.id)}
                />
                <span className='min-w-0 flex-1 truncate'>{p.name}</span>
                <span className='shrink-0 truncate text-muted-foreground text-xs'>
                  {p.emails[0]}
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function MailingListPicker({
  workspaceId,
  selectedId,
  onChangeId,
}: {
  workspaceId: string
  selectedId: string
  onChangeId: (id: string) => void
}) {
  const { items: lists } = useCrmResourceList<CrmMailingListDTO>(
    workspaceId,
    'mailing-lists',
  )

  return (
    <div className='grid gap-1.5'>
      <Label className='text-muted-foreground text-xs'>Lista</Label>
      <Select
        items={lists.map((l) => ({
          value: l.id,
          label: `${l.name} (${l.memberCount})`,
        }))}
        value={selectedId || undefined}
        onValueChange={(v) => onChangeId(v as string)}
      >
        <SelectTrigger>
          <SelectValue placeholder='Selecione uma lista' />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {lists.map((l) => (
              <SelectItem key={l.id} value={l.id}>
                {l.name} ({l.memberCount})
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  )
}
