'use client'

import {
  Loading03Icon,
  Location01Icon,
} from '@hugeicons-pro/core-stroke-rounded'
import { useRef, useState } from 'react'
import { SteelIcon } from '@/components/icon/icon'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select'
import { fetchSdCep } from '@/src/hooks/use-sd-customers'
import { UF_OPTIONS } from './sd-directory-labels'
import { SdField, SdFormSection } from './sd-form-bits'
import { maskCep } from './sd-masks'

export interface SdAddressValue {
  zipCode: string
  street: string
  number: string
  complement: string
  district: string
  city: string
  state: string
  ibgeCode: string
}

export const EMPTY_SD_ADDRESS: SdAddressValue = {
  zipCode: '',
  street: '',
  number: '',
  complement: '',
  district: '',
  city: '',
  state: '',
  ibgeCode: '',
}

/**
 * Endereço com preenchimento pelo CEP (ViaCEP via API): ao completar os 8
 * dígitos, preenche logradouro, bairro, cidade, UF e IBGE e leva o foco
 * para o número.
 */
export function SdAddressFields({
  workspaceId,
  value,
  onChange,
}: {
  workspaceId: string
  value: SdAddressValue
  onChange: (next: SdAddressValue) => void
}) {
  const numberRef = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState<
    { kind: 'idle' } | { kind: 'loading' } | { kind: 'error'; message: string }
  >({ kind: 'idle' })
  const lastLookup = useRef('')

  function set<K extends keyof SdAddressValue>(key: K, v: string) {
    onChange({ ...value, [key]: v })
  }

  async function handleCep(raw: string) {
    const masked = maskCep(raw)
    const next = { ...value, zipCode: masked }
    onChange(next)
    const digits = masked.replace(/\D/g, '')
    if (digits.length !== 8 || digits === lastLookup.current) return
    lastLookup.current = digits
    setStatus({ kind: 'loading' })
    try {
      const address = await fetchSdCep(workspaceId, digits)
      onChange({
        ...next,
        street: address.street ?? next.street,
        complement: next.complement || (address.complement ?? ''),
        district: address.district ?? next.district,
        city: address.city ?? next.city,
        state: address.state ?? next.state,
        ibgeCode: address.ibgeCode ?? '',
      })
      setStatus({ kind: 'idle' })
      requestAnimationFrame(() => numberRef.current?.focus())
    } catch (error) {
      lastLookup.current = ''
      setStatus({
        kind: 'error',
        message: error instanceof Error ? error.message : 'CEP não encontrado',
      })
    }
  }

  return (
    <SdFormSection
      title='Endereço'
      description='Digite o CEP para preencher o endereço automaticamente.'
    >
      <SdField
        label='CEP'
        htmlFor='sd-address-cep'
        error={status.kind === 'error' ? status.message : null}
        hint={
          status.kind === 'loading' ? (
            <span className='inline-flex items-center gap-1'>
              <SteelIcon
                icon={Loading03Icon}
                strokeWidth={2}
                className='size-3 animate-spin'
              />
              Consultando o CEP…
            </span>
          ) : value.ibgeCode ? (
            <span className='inline-flex items-center gap-1'>
              <SteelIcon
                icon={Location01Icon}
                strokeWidth={2}
                className='size-3'
              />
              IBGE {value.ibgeCode}
            </span>
          ) : null
        }
      >
        <Input
          id='sd-address-cep'
          value={value.zipCode}
          onChange={(e) => handleCep(e.target.value)}
          placeholder='00000-000'
          inputMode='numeric'
          autoComplete='postal-code'
        />
      </SdField>
      <SdField label='Logradouro' htmlFor='sd-address-street'>
        <Input
          id='sd-address-street'
          value={value.street}
          onChange={(e) => set('street', e.target.value)}
          autoComplete='address-line1'
        />
      </SdField>
      <SdField label='Número' htmlFor='sd-address-number'>
        <Input
          id='sd-address-number'
          ref={numberRef}
          value={value.number}
          onChange={(e) => set('number', e.target.value)}
        />
      </SdField>
      <SdField label='Complemento' htmlFor='sd-address-complement'>
        <Input
          id='sd-address-complement'
          value={value.complement}
          onChange={(e) => set('complement', e.target.value)}
          autoComplete='address-line2'
        />
      </SdField>
      <SdField label='Bairro' htmlFor='sd-address-district'>
        <Input
          id='sd-address-district'
          value={value.district}
          onChange={(e) => set('district', e.target.value)}
        />
      </SdField>
      <div className='grid grid-cols-[1fr_6rem] gap-3'>
        <SdField label='Cidade' htmlFor='sd-address-city'>
          <Input
            id='sd-address-city'
            value={value.city}
            onChange={(e) => set('city', e.target.value)}
            autoComplete='address-level2'
          />
        </SdField>
        <SdField label='UF'>
          <Select
            value={value.state || '__none'}
            onValueChange={(v) => set('state', v === '__none' ? '' : String(v))}
          >
            <SelectTrigger className='w-full'>
              <span>{value.state || '—'}</span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='__none'>—</SelectItem>
              {UF_OPTIONS.map((uf) => (
                <SelectItem key={uf} value={uf}>
                  {uf}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SdField>
      </div>
    </SdFormSection>
  )
}
