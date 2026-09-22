'use client'

import {
  AlertCircleIcon,
  CheckmarkCircle02Icon,
  WhatsappIcon,
} from '@hugeicons-pro/core-stroke-rounded'
import type { ReactNode } from 'react'
import { SteelIcon } from '@/components/icon/icon'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import {
  detectDocumentKind,
  formatDocument,
  validateDocument,
  whatsappLink,
} from '@/src/lib/servicedesk/document'
import { maskPhone } from './sd-masks'

/** Seção do formulário (título + descrição + campos em grade). */
export function SdFormSection({
  title,
  description,
  children,
  className,
}: {
  title: string
  description?: string
  children: ReactNode
  className?: string
}) {
  return (
    <section className='flex flex-col gap-3'>
      <div>
        <h3 className='font-semibold text-sm'>{title}</h3>
        {description ? (
          <p className='text-muted-foreground text-xs'>{description}</p>
        ) : null}
      </div>
      <div className={cn('grid grid-cols-1 gap-3 sm:grid-cols-2', className)}>
        {children}
      </div>
    </section>
  )
}

/** Rótulo + campo + dica/erro. */
export function SdField({
  label,
  htmlFor,
  hint,
  error,
  className,
  children,
}: {
  label: string
  htmlFor?: string
  hint?: ReactNode
  error?: string | null
  className?: string
  children: ReactNode
}) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <Label htmlFor={htmlFor} className='text-xs'>
        {label}
      </Label>
      {children}
      {error ? (
        <p className='text-destructive text-xs'>{error}</p>
      ) : hint ? (
        <div className='text-muted-foreground text-xs'>{hint}</div>
      ) : null}
    </div>
  )
}

/** CPF/CNPJ com máscara e validação ao vivo (inclui o CNPJ alfanumérico). */
export function SdDocumentInput({
  id,
  value,
  onChange,
}: {
  id?: string
  value: string
  onChange: (value: string) => void
}) {
  const normalized = value.replace(/[^0-9A-Za-z]/g, '')
  const kind = detectDocumentKind(value)
  const complete = kind !== null
  const valid = complete && validateDocument(value).valid
  return (
    <div className='relative'>
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(formatDocument(e.target.value))}
        placeholder='000.000.000-00 ou 00.000.000/0000-00'
        aria-invalid={complete && !valid ? true : undefined}
        className='pr-24 font-mono'
        autoComplete='off'
      />
      {normalized.length > 0 ? (
        <span
          className={cn(
            '-translate-y-1/2 absolute top-1/2 right-2 inline-flex items-center gap-1 text-xs',
            !complete && 'text-muted-foreground',
            complete && valid && 'text-emerald-600 dark:text-emerald-400',
            complete && !valid && 'text-destructive',
          )}
        >
          {complete ? (
            <SteelIcon
              icon={valid ? CheckmarkCircle02Icon : AlertCircleIcon}
              strokeWidth={2}
              className='size-3.5'
            />
          ) : null}
          {complete ? (valid ? kind : `${kind} inválido`) : 'incompleto'}
        </span>
      ) : null}
    </div>
  )
}

/** Telefone com máscara BR; `whatsapp` mostra o atalho para abrir a conversa. */
export function SdPhoneInput({
  id,
  value,
  onChange,
  whatsapp,
}: {
  id?: string
  value: string
  onChange: (value: string) => void
  whatsapp?: boolean
}) {
  const link = whatsapp ? whatsappLink(value) : null
  return (
    <div className='flex gap-1.5'>
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(maskPhone(e.target.value))}
        placeholder='(11) 98765-4321'
        inputMode='tel'
        autoComplete='off'
      />
      {whatsapp && link ? (
        <a
          href={link}
          target='_blank'
          rel='noreferrer'
          title='Abrir no WhatsApp'
          className={buttonVariants({ variant: 'outline', size: 'icon' })}
        >
          <SteelIcon
            icon={WhatsappIcon}
            strokeWidth={2}
            className='text-emerald-600'
          />
          <span className='sr-only'>Abrir no WhatsApp</span>
        </a>
      ) : whatsapp ? (
        <Button variant='outline' size='icon' disabled>
          <SteelIcon icon={WhatsappIcon} strokeWidth={2} />
          <span className='sr-only'>Abrir no WhatsApp</span>
        </Button>
      ) : null}
    </div>
  )
}

/** Linha "rótulo: valor" da aba Dados. */
export function SdInfoRow({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <div className='grid grid-cols-[9rem_1fr] gap-2 py-1.5 text-sm'>
      <dt className='text-muted-foreground'>{label}</dt>
      <dd className='min-w-0 break-words'>{children || '—'}</dd>
    </div>
  )
}
