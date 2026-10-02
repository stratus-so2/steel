'use client'

import { ArrowLeft01Icon, SentIcon } from '@hugeicons-pro/core-stroke-rounded'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { SteelIcon } from '@/components/icon/icon'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import {
  useCreateSdPortalTicket,
  useSdPortalFormOptions,
} from '@/src/hooks/use-sd-external-portal'
import type {
  SdPortalCatalogNodeDTO,
  SdPortalCustomFieldDTO,
} from '@/types/sd-portal'
import type { SdTicketTypeDTO } from '@/types/sd-settings'
import { SD_TICKET_TYPE_LABEL } from '../ticket/sd-ticket-meta'
import { sdExtTicketHref } from './sd-ext-tickets'

/** Nós do catálogo válidos para o tipo escolhido (vazio = todos). */
function forType(
  nodes: SdPortalCatalogNodeDTO[],
  type: SdTicketTypeDTO,
): SdPortalCatalogNodeDTO[] {
  return nodes.filter(
    (node) => node.ticketTypes.length === 0 || node.ticketTypes.includes(type),
  )
}

function fieldApplies(
  field: SdPortalCustomFieldDTO,
  type: SdTicketTypeDTO,
  categoryIds: string[],
): boolean {
  if (field.ticketTypes.length > 0 && !field.ticketTypes.includes(type)) {
    return false
  }
  if (field.categoryIds.length === 0) return true
  return field.categoryIds.some((id) => categoryIds.includes(id))
}

function Select({
  id,
  label,
  value,
  options,
  onChange,
  placeholder,
}: {
  id: string
  label: string
  value: string
  options: { id: string; name: string }[]
  onChange: (value: string) => void
  placeholder: string
}) {
  if (options.length === 0) return null
  return (
    <div className='flex flex-col gap-1.5'>
      <Label htmlFor={id}>{label}</Label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className='h-9 rounded-lg border border-border bg-background px-3 text-sm'
      >
        <option value=''>{placeholder}</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </select>
    </div>
  )
}

/**
 * `/suporte/novo`: o contato abre um chamado. Só aparece o que o workspace
 * liberou para o portal — tipos de `portalTicketTypes`, catálogo e modelos
 * `portalVisible`, campos customizados `visibleInPortal`.
 */
export function SdExtNewTicket() {
  const router = useRouter()
  const options = useSdPortalFormOptions()
  const create = useCreateSdPortalTicket()

  const types = options.data?.ticketTypes ?? []
  const [type, setType] = useState<SdTicketTypeDTO | ''>('')
  const [templateId, setTemplateId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [subcategoryId, setSubcategoryId] = useState('')
  const [serviceId, setServiceId] = useState('')
  const [urgencyId, setUrgencyId] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [custom, setCustom] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)

  const effectiveType = (type || types[0] || '') as SdTicketTypeDTO | ''

  const categories = useMemo(
    () =>
      effectiveType ? forType(options.data?.catalog ?? [], effectiveType) : [],
    [options.data?.catalog, effectiveType],
  )
  const subcategories = useMemo(() => {
    const parent = categories.find((node) => node.id === categoryId)
    return parent && effectiveType
      ? forType(parent.children, effectiveType)
      : []
  }, [categories, categoryId, effectiveType])
  const services = useMemo(() => {
    const parent = subcategories.find((node) => node.id === subcategoryId)
    return parent && effectiveType
      ? forType(parent.children, effectiveType)
      : []
  }, [subcategories, subcategoryId, effectiveType])

  const templates = (options.data?.templates ?? []).filter(
    (template) => template.ticketType === effectiveType,
  )
  const customFields = (options.data?.customFields ?? []).filter(
    (field) =>
      effectiveType &&
      fieldApplies(field, effectiveType, [
        categoryId,
        subcategoryId,
        serviceId,
      ]),
  )

  if (options.isLoading) {
    return (
      <div className='flex flex-col gap-3'>
        <Skeleton className='h-10 rounded-xl' />
        <Skeleton className='h-48 rounded-xl' />
      </div>
    )
  }

  if (options.isError) {
    return (
      <div className='rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-destructive text-sm'>
        {options.error.message}
      </div>
    )
  }

  if (types.length === 0) {
    return (
      <div className='flex flex-col items-center gap-2 rounded-2xl border border-border border-dashed bg-card p-8 text-center'>
        <p className='font-medium text-sm'>
          A abertura de chamados pelo portal está desligada
        </p>
        <p className='max-w-sm text-muted-foreground text-xs'>
          Fale com a equipe de atendimento pelos canais de sempre — eles abrem o
          chamado para você e ele aparece aqui.
        </p>
        <Link
          href='/suporte/chamados'
          className={buttonVariants({ variant: 'outline', size: 'sm' })}
        >
          Voltar aos meus chamados
        </Link>
      </div>
    )
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!effectiveType || !title.trim()) return
    setError(null)
    const customFieldValues: Record<string, unknown> = {}
    for (const field of customFields) {
      const value = custom[field.key]
      if (value !== undefined && value !== '')
        customFieldValues[field.key] = value
    }
    try {
      const created = await create.mutateAsync({
        type: effectiveType,
        title: title.trim(),
        ...(description.trim() ? { description: description.trim() } : {}),
        ...(templateId ? { templateId } : {}),
        ...(categoryId ? { categoryId } : {}),
        ...(subcategoryId ? { subcategoryId } : {}),
        ...(serviceId ? { serviceId } : {}),
        ...(urgencyId ? { urgencyId } : {}),
        ...(Object.keys(customFieldValues).length > 0
          ? { customFields: customFieldValues }
          : {}),
      })
      router.push(sdExtTicketHref(created.code))
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Não conseguimos abrir seu chamado',
      )
    }
  }

  return (
    <form className='flex flex-col gap-5' onSubmit={submit}>
      <div className='flex items-center gap-2'>
        <Link
          href='/suporte/chamados'
          aria-label='Voltar aos meus chamados'
          className={buttonVariants({ variant: 'ghost', size: 'icon-xs' })}
        >
          <SteelIcon icon={ArrowLeft01Icon} strokeWidth={2} />
        </Link>
        <p className='text-muted-foreground text-sm'>
          Conte o que está acontecendo — a equipe cuida do resto.
        </p>
      </div>

      {types.length > 1 ? (
        <div className='flex flex-col gap-1.5'>
          <Label>Do que você precisa?</Label>
          <div className='flex flex-wrap gap-2'>
            {types.map((item) => (
              <button
                key={item}
                type='button'
                aria-pressed={effectiveType === item}
                onClick={() => {
                  setType(item)
                  setTemplateId('')
                  setCategoryId('')
                  setSubcategoryId('')
                  setServiceId('')
                }}
                className={cn(
                  'rounded-xl border px-3 py-2 font-medium text-sm transition-colors',
                  effectiveType === item
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-card text-muted-foreground hover:text-foreground',
                )}
              >
                {SD_TICKET_TYPE_LABEL[item]}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className='grid gap-4 sm:grid-cols-2'>
        <Select
          id='sd-ext-template'
          label='Modelo (opcional)'
          value={templateId}
          options={templates}
          onChange={setTemplateId}
          placeholder='Sem modelo'
        />
        <Select
          id='sd-ext-urgency'
          label='Urgência'
          value={urgencyId}
          options={options.data?.urgencies ?? []}
          onChange={setUrgencyId}
          placeholder='A equipe define'
        />
        <Select
          id='sd-ext-category'
          label='Assunto'
          value={categoryId}
          options={categories}
          onChange={(value) => {
            setCategoryId(value)
            setSubcategoryId('')
            setServiceId('')
          }}
          placeholder='Escolha o assunto'
        />
        <Select
          id='sd-ext-subcategory'
          label='Detalhe do assunto'
          value={subcategoryId}
          options={subcategories}
          onChange={(value) => {
            setSubcategoryId(value)
            setServiceId('')
          }}
          placeholder='Escolha o detalhe'
        />
        <Select
          id='sd-ext-service'
          label='Serviço'
          value={serviceId}
          options={services}
          onChange={setServiceId}
          placeholder='Escolha o serviço'
        />
      </div>

      <div className='flex flex-col gap-1.5'>
        <Label htmlFor='sd-ext-title'>Resumo</Label>
        <Input
          id='sd-ext-title'
          required
          maxLength={200}
          value={title}
          placeholder='Ex.: a impressora do 3º andar não imprime'
          onChange={(event) => setTitle(event.target.value)}
        />
      </div>

      <div className='flex flex-col gap-1.5'>
        <Label htmlFor='sd-ext-description'>Detalhes</Label>
        <Textarea
          id='sd-ext-description'
          rows={6}
          maxLength={20_000}
          value={description}
          placeholder='Quando começou, o que você já tentou, quem está sendo afetado…'
          onChange={(event) => setDescription(event.target.value)}
        />
      </div>

      {customFields.map((field) => (
        <div key={field.id} className='flex flex-col gap-1.5'>
          <Label htmlFor={`sd-ext-cf-${field.key}`}>
            {field.label}
            {field.required ? ' *' : ''}
          </Label>
          {field.options.length > 0 ? (
            <select
              id={`sd-ext-cf-${field.key}`}
              required={field.required}
              value={custom[field.key] ?? ''}
              onChange={(event) =>
                setCustom((current) => ({
                  ...current,
                  [field.key]: event.target.value,
                }))
              }
              className='h-9 rounded-lg border border-border bg-background px-3 text-sm'
            >
              <option value=''>Escolha uma opção</option>
              {field.options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          ) : (
            <Input
              id={`sd-ext-cf-${field.key}`}
              required={field.required}
              value={custom[field.key] ?? ''}
              onChange={(event) =>
                setCustom((current) => ({
                  ...current,
                  [field.key]: event.target.value,
                }))
              }
            />
          )}
          {field.description ? (
            <p className='text-muted-foreground text-xs'>{field.description}</p>
          ) : null}
        </div>
      ))}

      {error ? (
        <p
          role='alert'
          className='rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-destructive text-sm'
        >
          {error}
        </p>
      ) : null}

      <div className='flex justify-end'>
        <Button
          type='submit'
          size='lg'
          disabled={create.isPending || !title.trim()}
        >
          <SteelIcon icon={SentIcon} strokeWidth={2} />
          {create.isPending ? 'Abrindo…' : 'Abrir chamado'}
        </Button>
      </div>
    </form>
  )
}
