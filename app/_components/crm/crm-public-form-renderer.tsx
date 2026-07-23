'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import type { CrmFormFieldDefinition, CrmFormPublicDTO } from '@/types/crm-form'

type Values = Record<string, unknown>

function FieldControl({
  field,
  value,
  onChange,
  disabled,
}: {
  field: CrmFormFieldDefinition
  value: unknown
  onChange: (value: unknown) => void
  disabled: boolean
}) {
  const id = `field-${field.key}`

  if (field.type === 'textarea') {
    return (
      <Textarea
        id={id}
        value={(value as string) ?? ''}
        placeholder={field.placeholder}
        required={field.required}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      />
    )
  }

  if (field.type === 'select') {
    return (
      <Select
        value={(value as string) ?? ''}
        onValueChange={onChange}
        disabled={disabled}
      >
        <SelectTrigger className='w-full'>
          <SelectValue placeholder={field.placeholder ?? 'Selecione…'} />
        </SelectTrigger>
        <SelectContent>
          {(field.options ?? []).map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    )
  }

  if (field.type === 'checkbox') {
    return (
      <div className='flex items-center gap-2'>
        <Checkbox
          id={id}
          checked={Boolean(value)}
          disabled={disabled}
          onCheckedChange={(checked) => onChange(checked === true)}
        />
        <Label htmlFor={id} className='font-normal text-muted-foreground'>
          {field.placeholder ?? field.label}
        </Label>
      </div>
    )
  }

  const inputType =
    field.type === 'email'
      ? 'email'
      : field.type === 'number'
        ? 'number'
        : field.type === 'date'
          ? 'date'
          : field.type === 'url'
            ? 'url'
            : field.type === 'phone'
              ? 'tel'
              : 'text'

  return (
    <Input
      id={id}
      type={inputType}
      value={(value as string) ?? ''}
      placeholder={field.placeholder}
      required={field.required}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}

/**
 * Renderiza o formulário no visual travado do sistema. Compartilhado entre a
 * página pública (`publicToken` definido → envia de verdade) e o preview do
 * builder (`preview` → controles desativados, sem envio).
 */
export function CrmPublicFormRenderer({
  form,
  publicToken,
  preview = false,
}: {
  form: CrmFormPublicDTO
  publicToken?: string
  preview?: boolean
}) {
  const [values, setValues] = useState<Values>({})
  const [honeypot, setHoneypot] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  function setValue(key: string, value: unknown) {
    setValues((cur) => ({ ...cur, [key]: value }))
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (preview || !publicToken) return
    if (honeypot) return // bot preencheu o campo isca — descarta silenciosamente
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/crm/forms/${publicToken}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ values }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        setError(json?.message ?? 'Não foi possível enviar. Tente novamente.')
        return
      }
      if (form.redirectUrl) {
        window.location.href = form.redirectUrl
        return
      }
      setDone(form.successMessage ?? 'Recebemos suas informações. Obrigado!')
    } catch {
      setError('Erro de rede. Tente novamente.')
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <div className='rounded-xl border bg-card p-8 text-center'>
        <p className='font-medium text-base'>{done}</p>
      </div>
    )
  }

  return (
    <form
      onSubmit={onSubmit}
      className='flex flex-col gap-5 rounded-xl border bg-card p-6 sm:p-8'
    >
      <div className='flex flex-col gap-1'>
        <h1 className='font-semibold text-xl tracking-tight'>{form.name}</h1>
        {form.description ? (
          <p className='text-muted-foreground text-sm'>{form.description}</p>
        ) : null}
      </div>

      {form.fields.length === 0 ? (
        <p className='text-muted-foreground text-sm'>
          Este formulário ainda não possui campos.
        </p>
      ) : null}

      {form.fields.map((field) => (
        <div key={field.key} className='flex flex-col gap-1.5'>
          {field.type !== 'checkbox' ? (
            <Label htmlFor={`field-${field.key}`}>
              {field.label}
              {field.required ? (
                <span className='text-destructive'> *</span>
              ) : null}
            </Label>
          ) : null}
          <FieldControl
            field={field}
            value={values[field.key]}
            onChange={(value) => setValue(field.key, value)}
            disabled={preview || submitting}
          />
        </div>
      ))}

      {/* Honeypot anti-spam: oculto para humanos, atrativo para bots. */}
      <div aria-hidden className='hidden'>
        <label htmlFor='company_website'>Não preencha</label>
        <input
          id='company_website'
          name='company_website'
          tabIndex={-1}
          autoComplete='off'
          value={honeypot}
          onChange={(e) => setHoneypot(e.target.value)}
        />
      </div>

      {error ? <p className='text-destructive text-sm'>{error}</p> : null}

      <Button type='submit' disabled={preview || submitting} className='w-full'>
        {submitting ? 'Enviando…' : 'Enviar'}
      </Button>
    </form>
  )
}
