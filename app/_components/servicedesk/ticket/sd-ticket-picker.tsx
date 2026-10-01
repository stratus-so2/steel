'use client'

import { fetchSdTicketOptions } from '@/src/hooks/use-sd-ticket-ui'
import type { SdOptionDTO } from '@/types/sd-directory'
import { SdAsyncPicker } from '../pickers/sd-async-picker'

/** Seletor de chamado por código ou título (item pai, vincular filho). */
export function SdTicketPicker({
  workspaceId,
  value,
  selectedLabel,
  onChange,
  excludeIds = [],
  placeholder = 'Buscar chamado…',
  id,
  disabled,
}: {
  workspaceId: string
  value: string | null
  selectedLabel?: string | null
  onChange: (option: SdOptionDTO | null) => void
  excludeIds?: string[]
  placeholder?: string
  id?: string
  disabled?: boolean
}) {
  return (
    <SdAsyncPicker
      id={id}
      disabled={disabled}
      value={value}
      selectedLabel={selectedLabel}
      onChange={onChange}
      placeholder={placeholder}
      searchPlaceholder='Código (INC-000123) ou título…'
      emptyText='Nenhum chamado encontrado.'
      optionsKey={['sd-tickets', workspaceId, 'picker', excludeIds.join(',')]}
      fetchOptions={(q) => fetchSdTicketOptions(workspaceId, q, { excludeIds })}
    />
  )
}
