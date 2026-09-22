'use client'

import { fetchSdOptions } from '@/src/hooks/_sd-directory'
import type { SdCustomerKindDTO } from '@/types/sd-customer'
import type { SdOptionDTO } from '@/types/sd-directory'
import { SdAsyncPicker } from './sd-async-picker'
import {
  SdConfigItemQuickCreateDialog,
  SdContactQuickCreateDialog,
  SdCustomerQuickCreateDialog,
} from './sd-quick-create-dialogs'

/**
 * Seletores do ServiceDesk (formulário de chamado e cadastros). Todos são
 * controlados: `value` = id, `selectedLabel` = rótulo já conhecido e
 * `onChange(option | null)`.
 */
interface BasePickerProps {
  workspaceId: string
  value: string | null
  selectedLabel?: string | null
  onChange: (option: SdOptionDTO | null) => void
  placeholder?: string
  disabled?: boolean
  /** Mostra "criar novo" (padrão `true`). */
  allowCreate?: boolean
  id?: string
  className?: string
}

export function SdCustomerPicker({
  workspaceId,
  kind,
  allowCreate = true,
  placeholder,
  ...props
}: BasePickerProps & { kind?: SdCustomerKindDTO }) {
  const noun = kind === 'COMPANY' ? 'empresa' : kind ? 'cliente' : 'cadastro'
  return (
    <SdAsyncPicker
      {...props}
      placeholder={placeholder ?? `Selecionar ${noun}…`}
      searchPlaceholder='Nome, fantasia, CPF/CNPJ…'
      emptyText='Nenhum cadastro encontrado.'
      optionsKey={['sd-customers', workspaceId, 'options', kind ?? '']}
      fetchOptions={(q) =>
        fetchSdOptions(workspaceId, 'customers/options', { q, kind })
      }
      createLabel={
        allowCreate
          ? kind === 'COMPANY'
            ? 'Criar nova empresa'
            : 'Criar novo cliente'
          : undefined
      }
      renderCreate={(create) => (
        <SdCustomerQuickCreateDialog
          {...create}
          workspaceId={workspaceId}
          kind={kind ?? 'CLIENT'}
        />
      )}
    />
  )
}

export function SdContactPicker({
  workspaceId,
  customerId,
  allowCreate = true,
  placeholder,
  ...props
}: BasePickerProps & { customerId?: string | null }) {
  return (
    <SdAsyncPicker
      {...props}
      placeholder={placeholder ?? 'Selecionar contato…'}
      searchPlaceholder='Nome, e-mail, telefone…'
      emptyText={
        customerId
          ? 'Nenhum contato deste cliente.'
          : 'Nenhum contato encontrado.'
      }
      optionsKey={['sd-contacts', workspaceId, 'options', customerId ?? '']}
      fetchOptions={(q) =>
        fetchSdOptions(workspaceId, 'contacts/options', {
          q,
          customerId: customerId ?? undefined,
        })
      }
      createLabel={allowCreate ? 'Criar novo contato' : undefined}
      renderCreate={(create) => (
        <SdContactQuickCreateDialog
          {...create}
          workspaceId={workspaceId}
          customerId={customerId}
        />
      )}
    />
  )
}

export function SdConfigItemPicker({
  workspaceId,
  customerId,
  excludeId,
  allowCreate = true,
  placeholder,
  ...props
}: BasePickerProps & {
  customerId?: string | null
  /** Esconde um item (ex.: o próprio CI no seletor de pai). */
  excludeId?: string
}) {
  return (
    <SdAsyncPicker
      {...props}
      placeholder={placeholder ?? 'Selecionar item de configuração…'}
      searchPlaceholder='Nome, código, série, IP…'
      emptyText='Nenhum item encontrado.'
      optionsKey={[
        'sd-config-items',
        workspaceId,
        'options',
        customerId ?? '',
        excludeId ?? '',
      ]}
      fetchOptions={(q) =>
        fetchSdOptions(workspaceId, 'config-items/options', {
          q,
          customerId: customerId ?? undefined,
          excludeId,
        })
      }
      createLabel={allowCreate ? 'Criar novo item' : undefined}
      renderCreate={(create) => (
        <SdConfigItemQuickCreateDialog
          {...create}
          workspaceId={workspaceId}
          customerId={customerId}
        />
      )}
    />
  )
}

/** Membro do workspace (usuário do contato, responsável do CI). */
export function SdUserPicker({
  workspaceId,
  placeholder,
  ...props
}: Omit<BasePickerProps, 'allowCreate'>) {
  return (
    <SdAsyncPicker
      {...props}
      placeholder={placeholder ?? 'Selecionar usuário…'}
      searchPlaceholder='Nome ou e-mail…'
      emptyText='Nenhum membro encontrado.'
      optionsKey={['sd-contacts', workspaceId, 'user-options']}
      fetchOptions={(q) =>
        fetchSdOptions(workspaceId, 'contacts/user-options', { q })
      }
    />
  )
}
