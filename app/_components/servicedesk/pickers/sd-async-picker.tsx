'use client'

import {
  ArrowDown01Icon,
  Cancel01Icon,
  Loading03Icon,
  PlusSignIcon,
  Tick02Icon,
} from '@hugeicons-pro/core-stroke-rounded'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { type ReactNode, useState } from 'react'
import { useDebouncedValue } from '@/app/_components/servicedesk/table/use-sd-table-state'
import { SteelIcon } from '@/components/icon/icon'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import type { SdOptionDTO } from '@/types/sd-directory'

export interface SdPickerCreateProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Texto digitado na busca — sugestão de nome. */
  initialName: string
  onCreated: (option: SdOptionDTO) => void
}

export interface SdAsyncPickerProps {
  value: string | null
  /** Rótulo do valor atual (ex.: vindo do registro já salvo). */
  selectedLabel?: string | null
  onChange: (option: SdOptionDTO | null) => void
  /** Chave base do cache (a busca é acrescentada). */
  optionsKey: readonly unknown[]
  fetchOptions: (q: string | undefined) => Promise<SdOptionDTO[]>
  placeholder?: string
  searchPlaceholder?: string
  emptyText?: string
  /** Rótulo da opção "criar novo" (sem ela, a opção não aparece). */
  createLabel?: string
  renderCreate?: (props: SdPickerCreateProps) => ReactNode
  disabled?: boolean
  allowClear?: boolean
  className?: string
  id?: string
}

/**
 * Combobox com busca assíncrona (debounce) e "criar novo" inline. Base dos
 * seletores de cliente, contato e item de configuração do ServiceDesk.
 */
export function SdAsyncPicker({
  value,
  selectedLabel,
  onChange,
  optionsKey,
  fetchOptions,
  placeholder = 'Selecionar…',
  searchPlaceholder = 'Buscar…',
  emptyText = 'Nada encontrado.',
  createLabel,
  renderCreate,
  disabled,
  allowClear = true,
  className,
  id,
}: SdAsyncPickerProps) {
  const [open, setOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [search, setSearch] = useState('')
  const [picked, setPicked] = useState<SdOptionDTO | null>(null)
  const q = useDebouncedValue(search.trim()) || undefined
  const { data = [], isFetching } = useQuery({
    queryKey: [...optionsKey, q ?? ''],
    queryFn: () => fetchOptions(q),
    enabled: open,
    staleTime: 15 * 1000,
    placeholderData: keepPreviousData,
  })

  const label =
    value && picked?.id === value
      ? picked.label
      : value
        ? (selectedLabel ?? data.find((o) => o.id === value)?.label ?? '…')
        : null

  function select(option: SdOptionDTO | null) {
    setPicked(option)
    onChange(option)
    setOpen(false)
    setSearch('')
  }

  const clearable = allowClear && Boolean(value) && !disabled

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <div className={cn('relative w-full', className)}>
          <PopoverTrigger
            render={
              <Button
                id={id}
                variant='outline'
                disabled={disabled}
                className={cn(
                  'w-full justify-between gap-2 font-normal',
                  !label && 'text-muted-foreground',
                  clearable && 'pr-14',
                )}
              >
                <span className='truncate'>{label ?? placeholder}</span>
                <SteelIcon
                  icon={ArrowDown01Icon}
                  strokeWidth={2}
                  className='size-4 shrink-0 text-muted-foreground'
                />
              </Button>
            }
          />
          {clearable ? (
            <button
              type='button'
              aria-label='Limpar seleção'
              onClick={() => select(null)}
              className='-translate-y-1/2 absolute top-1/2 right-8 rounded p-0.5 text-muted-foreground hover:bg-muted'
            >
              <SteelIcon
                icon={Cancel01Icon}
                strokeWidth={2}
                className='size-3.5'
              />
            </button>
          ) : null}
        </div>
        <PopoverContent
          align='start'
          className='w-(--anchor-width) min-w-72 p-0'
        >
          <Command shouldFilter={false}>
            <CommandInput
              value={search}
              onValueChange={setSearch}
              placeholder={searchPlaceholder}
            />
            <CommandList>
              {isFetching && data.length === 0 ? (
                <div className='flex items-center justify-center gap-2 py-6 text-muted-foreground text-sm'>
                  <SteelIcon
                    icon={Loading03Icon}
                    strokeWidth={2}
                    className='size-4 animate-spin'
                  />
                  Buscando…
                </div>
              ) : (
                <CommandEmpty>{emptyText}</CommandEmpty>
              )}
              {data.length > 0 ? (
                <CommandGroup>
                  {data.map((option) => (
                    <CommandItem
                      key={option.id}
                      value={option.id}
                      onSelect={() => select(option)}
                      className='flex items-start gap-2'
                    >
                      <SteelIcon
                        icon={Tick02Icon}
                        strokeWidth={2}
                        className={cn(
                          'mt-0.5 size-4 shrink-0',
                          option.id === value ? 'opacity-100' : 'opacity-0',
                        )}
                      />
                      <span className='flex min-w-0 flex-col'>
                        <span className='truncate'>{option.label}</span>
                        {option.sublabel ? (
                          <span className='truncate text-muted-foreground text-xs'>
                            {option.sublabel}
                          </span>
                        ) : null}
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              ) : null}
              {createLabel && renderCreate ? (
                <>
                  <CommandSeparator />
                  <CommandGroup>
                    <CommandItem
                      value='__create'
                      onSelect={() => {
                        setOpen(false)
                        setCreating(true)
                      }}
                    >
                      <SteelIcon
                        icon={PlusSignIcon}
                        strokeWidth={2}
                        className='size-4'
                      />
                      {search.trim()
                        ? `${createLabel}: “${search.trim()}”`
                        : createLabel}
                    </CommandItem>
                  </CommandGroup>
                </>
              ) : null}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {renderCreate
        ? renderCreate({
            open: creating,
            onOpenChange: setCreating,
            initialName: search.trim(),
            onCreated: (option) => {
              setCreating(false)
              select(option)
            },
          })
        : null}
    </>
  )
}
