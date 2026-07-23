'use client'

import { Loading02Icon, Search01Icon } from '@hugeicons-pro/core-stroke-rounded'
import * as React from 'react'
import { SteelIcon } from '@/components/icon/icon'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { notify } from '@/lib/notify'
import {
  CepNotFoundError,
  formatCep,
  isCompleteCep,
  lookupCep,
  normalizeCep,
} from '@/src/lib/crm-cep'

export type CrmCompanyAddress = {
  street?: string
  number?: string
  complement?: string
  neighborhood?: string
  city?: string
  state?: string
  zipCode?: string
  country?: string
}

type Draft = {
  zipCode: string
  street: string
  number: string
  complement: string
  neighborhood: string
  city: string
  state: string
}

const EMPTY_DRAFT: Draft = {
  zipCode: '',
  street: '',
  number: '',
  complement: '',
  neighborhood: '',
  city: '',
  state: '',
}

function toDraft(value: CrmCompanyAddress | null | undefined): Draft {
  if (!value) return { ...EMPTY_DRAFT }
  return {
    zipCode: value.zipCode ? formatCep(value.zipCode) : '',
    street: value.street ?? '',
    number: value.number ?? '',
    complement: value.complement ?? '',
    neighborhood: value.neighborhood ?? '',
    city: value.city ?? '',
    state: value.state ?? '',
  }
}

/** Converte o rascunho em endereço, removendo campos vazios. */
function toAddress(draft: Draft): CrmCompanyAddress | null {
  const text = (v: string) => {
    const t = v.trim()
    return t === '' ? undefined : t
  }

  const address: CrmCompanyAddress = {
    zipCode: text(draft.zipCode),
    street: text(draft.street),
    number: text(draft.number),
    complement: text(draft.complement),
    neighborhood: text(draft.neighborhood),
    city: text(draft.city),
    state: text(draft.state.toUpperCase()),
  }

  const hasValue = Object.values(address).some((v) => v !== undefined)
  return hasValue ? address : null
}

export function AddressPanel({
  open,
  onOpenChange,
  value,
  onSave,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  value: CrmCompanyAddress | null | undefined
  onSave: (next: CrmCompanyAddress | null) => void
}) {
  const [draft, setDraft] = React.useState<Draft>(() => toDraft(value))
  const [loading, setLoading] = React.useState(false)
  const lastLookup = React.useRef<string>('')

  // Reinicia o rascunho sempre que o painel abre.
  React.useEffect(() => {
    if (open) {
      setDraft(toDraft(value))
      lastLookup.current = value?.zipCode ? normalizeCep(value.zipCode) : ''
    }
  }, [open, value])

  const set = (key: keyof Draft) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setDraft((d) => ({ ...d, [key]: e.target.value }))

  const runLookup = React.useCallback(async (rawCep: string) => {
    const cep = normalizeCep(rawCep)
    if (!isCompleteCep(cep) || cep === lastLookup.current) return
    lastLookup.current = cep
    setLoading(true)
    try {
      const result = await lookupCep(cep)
      setDraft((d) => ({
        ...d,
        zipCode: result.cep,
        street: result.street ?? d.street,
        neighborhood: result.neighborhood ?? d.neighborhood,
        city: result.city ?? d.city,
        state: result.state ?? d.state,
      }))
      notify.success('Endereço preenchido pelo CEP')
    } catch (error) {
      lastLookup.current = ''
      notify.error(
        error instanceof CepNotFoundError
          ? 'CEP não encontrado'
          : 'Não foi possível consultar o CEP',
      )
    } finally {
      setLoading(false)
    }
  }, [])

  function handleCepChange(e: React.ChangeEvent<HTMLInputElement>) {
    const formatted = formatCep(e.target.value)
    setDraft((d) => ({ ...d, zipCode: formatted }))
    if (isCompleteCep(formatted)) void runLookup(formatted)
  }

  function handleSave() {
    onSave(toAddress(draft))
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-lg'>
        <DialogHeader>
          <DialogTitle>Endereço da empresa</DialogTitle>
          <DialogDescription>
            Informe o CEP para preencher o endereço automaticamente.
          </DialogDescription>
        </DialogHeader>

        <div className='grid grid-cols-1 gap-4 sm:grid-cols-6'>
          <Field className='sm:col-span-3'>
            <FieldLabel htmlFor='address-cep'>CEP</FieldLabel>
            <div className='flex items-center gap-2'>
              <Input
                id='address-cep'
                value={draft.zipCode}
                onChange={handleCepChange}
                placeholder='00000-000'
                inputMode='numeric'
                autoComplete='off'
              />
              <Button
                type='button'
                variant='outline'
                size='icon'
                aria-label='Buscar CEP'
                disabled={loading || !isCompleteCep(draft.zipCode)}
                onClick={() => {
                  lastLookup.current = ''
                  void runLookup(draft.zipCode)
                }}
              >
                {loading ? (
                  <SteelIcon
                    icon={Loading02Icon}
                    strokeWidth={2}
                    className='animate-spin'
                  />
                ) : (
                  <SteelIcon icon={Search01Icon} strokeWidth={2} />
                )}
              </Button>
            </div>
          </Field>

          <Field className='sm:col-span-3'>
            <FieldLabel htmlFor='address-state'>UF</FieldLabel>
            <Input
              id='address-state'
              value={draft.state}
              onChange={set('state')}
              placeholder='SP'
              maxLength={2}
              className='uppercase'
            />
          </Field>

          <Field className='sm:col-span-4'>
            <FieldLabel htmlFor='address-street'>Logradouro</FieldLabel>
            <Input
              id='address-street'
              value={draft.street}
              onChange={set('street')}
              placeholder='Av. Paulista'
            />
          </Field>

          <Field className='sm:col-span-2'>
            <FieldLabel htmlFor='address-number'>Número</FieldLabel>
            <Input
              id='address-number'
              value={draft.number}
              onChange={set('number')}
              placeholder='1000'
            />
          </Field>

          <Field className='sm:col-span-3'>
            <FieldLabel htmlFor='address-neighborhood'>Bairro</FieldLabel>
            <Input
              id='address-neighborhood'
              value={draft.neighborhood}
              onChange={set('neighborhood')}
              placeholder='Bela Vista'
            />
          </Field>

          <Field className='sm:col-span-3'>
            <FieldLabel htmlFor='address-complement'>Complemento</FieldLabel>
            <Input
              id='address-complement'
              value={draft.complement}
              onChange={set('complement')}
              placeholder='Sala 42'
            />
          </Field>

          <Field className='sm:col-span-6'>
            <FieldLabel htmlFor='address-city'>Cidade</FieldLabel>
            <Input
              id='address-city'
              value={draft.city}
              onChange={set('city')}
              placeholder='São Paulo'
            />
          </Field>
        </div>

        <DialogFooter>
          <Button variant='outline' onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave}>Salvar endereço</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
