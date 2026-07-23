'use client'

import {
  Add01Icon,
  Analytics01Icon,
  ArrowDown01Icon,
  ArrowLeft02Icon,
  ArrowUp01Icon,
  Copy01Icon,
  Delete02Icon,
  Globe02Icon,
} from '@hugeicons-pro/core-stroke-rounded'
import { useRouter } from 'next/navigation'
import { useMemo, useRef, useState } from 'react'
import { CrmFormStatsPanel } from '@/app/_components/crm/crm-form-stats-panel'
import { CrmPublicFormRenderer } from '@/app/_components/crm/crm-public-form-renderer'
import { SteelIcon } from '@/components/icon/icon'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { notify } from '@/lib/notify'
import { saveCrmForm, useCrmForm } from '@/src/hooks/use-crm-form'
import {
  ACTION_TARGETS,
  FORM_ACTIONS,
  FORM_FIELD_TYPES,
  TARGET_ATTRIBUTES,
} from '@/src/schemas/crm-form.schema'
import type {
  CrmFormActionDTO,
  CrmFormFieldDefinition,
  CrmFormFieldTargetDTO,
  CrmFormFieldTypeDTO,
  CrmFormPublicDTO,
} from '@/types/crm-form'

const ACTION_LABELS: Record<CrmFormActionDTO, string> = {
  COMPANY: 'Empresa',
  PERSON: 'Pessoa',
  LEAD: 'Lead',
}

const TYPE_LABELS: Record<CrmFormFieldTypeDTO, string> = {
  text: 'Texto',
  email: 'E-mail',
  phone: 'Telefone',
  number: 'Número',
  textarea: 'Texto longo',
  select: 'Seleção',
  checkbox: 'Caixa de seleção',
  url: 'URL',
  date: 'Data',
}

const TARGET_LABELS: Record<CrmFormFieldTargetDTO, string> = {
  person: 'Pessoa',
  company: 'Empresa',
  lead: 'Lead',
}

const ATTR_LABELS: Record<CrmFormFieldTargetDTO, Record<string, string>> = {
  person: {
    name: 'Nome',
    email: 'E-mail',
    phone: 'Telefone',
    city: 'Cidade',
    jobTitle: 'Cargo',
    linkedin: 'LinkedIn',
    avatar: 'Avatar',
  },
  company: {
    name: 'Nome',
    cnpj: 'CNPJ',
    domain: 'Domínio',
    employees: 'Funcionários',
    linkedin: 'LinkedIn',
    arr: 'ARR',
  },
  lead: {
    name: 'Nome',
    email: 'E-mail',
    phone: 'Telefone',
    company: 'Empresa',
    jobTitle: 'Cargo',
    source: 'Origem',
  },
}

type MappingOption = {
  value: string
  label: string
  target: CrmFormFieldTargetDTO
  attribute: string
}

function mappingOptionsFor(action: CrmFormActionDTO): MappingOption[] {
  const options: MappingOption[] = []
  for (const target of ACTION_TARGETS[action]) {
    for (const attribute of TARGET_ATTRIBUTES[target]) {
      options.push({
        value: `${target}.${attribute}`,
        label: `${TARGET_LABELS[target]} → ${ATTR_LABELS[target][attribute] ?? attribute}`,
        target,
        attribute,
      })
    }
  }
  return options
}

function defaultMapping(action: CrmFormActionDTO): {
  target: CrmFormFieldTargetDTO
  attribute: string
} {
  const first = mappingOptionsFor(action)[0]
  return { target: first.target, attribute: first.attribute }
}

function toPublicForm(
  name: string,
  description: string,
  fields: CrmFormFieldDefinition[],
  successMessage: string,
): CrmFormPublicDTO {
  return {
    id: 'preview',
    name,
    description: description || null,
    successMessage: successMessage || null,
    redirectUrl: null,
    fields: fields.map((f) => ({
      key: f.key,
      label: f.label,
      type: f.type,
      required: f.required,
      placeholder: f.placeholder,
      options: f.options,
      mapping: f.mapping,
    })),
  }
}

export function CrmFormBuilder({
  workspaceId,
  slug,
  formId,
}: {
  workspaceId: string
  slug: string
  formId: string
}) {
  const { form, isLoading, refetch } = useCrmForm(workspaceId, formId)

  if (isLoading) {
    return (
      <div className='flex h-full flex-col gap-4 p-6'>
        <Skeleton className='h-10 w-64' />
        <Skeleton className='h-full w-full' />
      </div>
    )
  }
  if (!form) {
    return (
      <div className='flex h-full items-center justify-center text-muted-foreground text-sm'>
        Formulário não encontrado.
      </div>
    )
  }
  return (
    <CrmFormBuilderInner
      workspaceId={workspaceId}
      slug={slug}
      initial={form}
      onSaved={refetch}
    />
  )
}

function CrmFormBuilderInner({
  workspaceId,
  slug,
  initial,
  onSaved,
}: {
  workspaceId: string
  slug: string
  initial: NonNullable<ReturnType<typeof useCrmForm>['form']>
  onSaved: () => void
}) {
  const router = useRouter()

  const [name, setName] = useState(initial.name)
  const [description, setDescription] = useState(initial.description ?? '')
  const [action, setAction] = useState<CrmFormActionDTO>(initial.action)
  const [fields, setFields] = useState<CrmFormFieldDefinition[]>(initial.fields)
  const [successMessage, setSuccessMessage] = useState(
    initial.successMessage ?? '',
  )
  const [status, setStatus] = useState(initial.status)
  const [saving, setSaving] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [statsOpen, setStatsOpen] = useState(false)

  const online = status === 'PUBLISHED'
  const mappingOptions = useMemo(() => mappingOptionsFor(action), [action])
  const publicUrl = useMemo(() => {
    if (typeof window === 'undefined') return ''
    return `${window.location.origin}/f/${initial.publicToken}`
  }, [initial.publicToken])

  const keyCounter = useRef(initial.fields.length)

  function buildPayload() {
    return {
      name: name.trim() || 'Formulário sem título',
      description: description.trim() ? description.trim() : undefined,
      action,
      fields,
      successMessage: successMessage.trim() ? successMessage.trim() : undefined,
    }
  }

  async function onSave() {
    setSaving(true)
    const res = await saveCrmForm(workspaceId, initial.id, buildPayload())
    setSaving(false)
    if (res.ok) {
      notify.success('Formulário salvo')
      onSaved()
    } else {
      notify.error(res.message ?? 'Não foi possível salvar.')
    }
  }

  async function onTogglePublish(next: boolean) {
    const desired = next ? 'PUBLISHED' : 'DRAFT'
    setPublishing(true)
    const res = await saveCrmForm(workspaceId, initial.id, {
      ...buildPayload(),
      status: desired,
    })
    setPublishing(false)
    if (res.ok) {
      setStatus(desired)
      notify.success(next ? 'Formulário publicado' : 'Formulário despublicado')
      onSaved()
    } else {
      notify.error(res.message ?? 'Não foi possível alterar a publicação.')
    }
  }

  function onChangeAction(next: CrmFormActionDTO) {
    const allowed = ACTION_TARGETS[next] as readonly CrmFormFieldTargetDTO[]
    const fallback = defaultMapping(next)
    setFields((cur) =>
      cur.map((f) =>
        allowed.includes(f.mapping.target) ? f : { ...f, mapping: fallback },
      ),
    )
    setAction(next)
  }

  function addField() {
    keyCounter.current += 1
    const newField: CrmFormFieldDefinition = {
      key: `campo_${keyCounter.current}`,
      label: 'Novo campo',
      type: 'text',
      required: false,
      mapping: defaultMapping(action),
    }
    setFields((cur) => [...cur, newField])
  }

  function updateField(index: number, patch: Partial<CrmFormFieldDefinition>) {
    setFields((cur) =>
      cur.map((f, i) => (i === index ? { ...f, ...patch } : f)),
    )
  }

  function removeField(index: number) {
    setFields((cur) => cur.filter((_, i) => i !== index))
  }

  function moveField(index: number, dir: -1 | 1) {
    setFields((cur) => {
      const next = [...cur]
      const target = index + dir
      if (target < 0 || target >= next.length) return cur
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  function copyUrl() {
    navigator.clipboard.writeText(publicUrl)
    notify.success('URL pública copiada')
  }

  const preview = toPublicForm(name, description, fields, successMessage)

  return (
    <div className='flex h-full flex-col'>
      <header className='flex h-14 shrink-0 items-center gap-2 border-b px-3'>
        <Button
          variant='ghost'
          size='icon-sm'
          aria-label='Voltar'
          onClick={() => router.push(`/${slug}/crm/forms`)}
        >
          <SteelIcon icon={ArrowLeft02Icon} strokeWidth={2} />
        </Button>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder='Formulário sem título'
          aria-label='Nome do formulário'
          className='min-w-0 flex-1 bg-transparent font-semibold text-sm outline-none placeholder:text-muted-foreground/60'
        />
        {online ? (
          <Button
            variant='ghost'
            size='sm'
            nativeButton={false}
            render={
              <a href={publicUrl} target='_blank' rel='noopener noreferrer'>
                <SteelIcon icon={Globe02Icon} strokeWidth={2} />
                Abrir
              </a>
            }
          />
        ) : null}
        <Button
          variant='ghost'
          size='sm'
          onClick={() => setStatsOpen(true)}
          aria-label='Ver respostas'
        >
          <SteelIcon icon={Analytics01Icon} strokeWidth={2} />
          Respostas
          {initial.submissionCount > 0 ? (
            <span className='rounded-full bg-primary/10 px-1.5 py-0.5 font-medium text-[10px] text-primary tabular-nums'>
              {initial.submissionCount}
            </span>
          ) : null}
        </Button>
        <Button size='sm' onClick={onSave} disabled={saving}>
          {saving ? 'Salvando…' : 'Salvar'}
        </Button>
      </header>

      <CrmFormStatsPanel
        open={statsOpen}
        onOpenChange={setStatsOpen}
        workspaceId={workspaceId}
        formId={initial.id}
        formName={name}
        fields={fields}
      />

      <div className='flex min-h-0 flex-1 flex-col lg:flex-row'>
        <div className='min-w-0 flex-1 overflow-y-auto border-b lg:border-r lg:border-b-0'>
          <div className='mx-auto flex max-w-2xl flex-col gap-6 p-6'>
            <section className='flex flex-col gap-4'>
              <h2 className='font-medium text-sm'>Configurações</h2>

              <div className='flex flex-col gap-1.5'>
                <Label htmlFor='form-description'>Descrição</Label>
                <Textarea
                  id='form-description'
                  value={description}
                  placeholder='Texto exibido abaixo do título'
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              <div className='flex flex-col gap-1.5'>
                <Label>Ação no envio</Label>
                <Select
                  value={action}
                  onValueChange={(v) => onChangeAction(v as CrmFormActionDTO)}
                >
                  <SelectTrigger className='w-full'>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FORM_ACTIONS.map((a) => (
                      <SelectItem key={a} value={a}>
                        {ACTION_LABELS[a]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className='flex flex-col gap-1.5'>
                <Label htmlFor='form-success'>Mensagem de sucesso</Label>
                <Input
                  id='form-success'
                  value={successMessage}
                  placeholder='Recebemos suas informações. Obrigado!'
                  onChange={(e) => setSuccessMessage(e.target.value)}
                />
              </div>
            </section>

            <section className='flex flex-col gap-3 rounded-lg border p-4'>
              <div className='flex items-center justify-between gap-3'>
                <div>
                  <p className='font-medium text-sm'>Publicar formulário</p>
                  <p className='text-muted-foreground text-xs'>
                    Disponibiliza a URL pública para receber respostas.
                  </p>
                </div>
                <Switch
                  checked={online}
                  disabled={publishing}
                  onCheckedChange={onTogglePublish}
                />
              </div>
              {online ? (
                <div className='flex items-center gap-2'>
                  <Input readOnly value={publicUrl} className='text-xs' />
                  <Button
                    variant='outline'
                    size='icon-sm'
                    aria-label='Copiar URL'
                    onClick={copyUrl}
                  >
                    <SteelIcon icon={Copy01Icon} strokeWidth={2} />
                  </Button>
                </div>
              ) : null}
            </section>

            <section className='flex flex-col gap-3'>
              <div className='flex items-center justify-between'>
                <h2 className='font-medium text-sm'>Campos</h2>
                <Button variant='outline' size='sm' onClick={addField}>
                  <SteelIcon icon={Add01Icon} strokeWidth={2} />
                  Adicionar campo
                </Button>
              </div>

              {fields.length === 0 ? (
                <p className='rounded-lg border border-dashed p-6 text-center text-muted-foreground text-sm'>
                  Nenhum campo ainda. Adicione campos para montar o formulário.
                </p>
              ) : null}

              {fields.map((field, index) => (
                <FieldEditor
                  key={field.key}
                  field={field}
                  index={index}
                  total={fields.length}
                  mappingOptions={mappingOptions}
                  onChange={(patch) => updateField(index, patch)}
                  onRemove={() => removeField(index)}
                  onMove={(dir) => moveField(index, dir)}
                />
              ))}
            </section>
          </div>
        </div>

        <div className='min-w-0 flex-1 overflow-y-auto bg-muted/30'>
          <div className='mx-auto max-w-xl p-6'>
            <p className='mb-3 text-muted-foreground text-xs uppercase tracking-wide'>
              Pré-visualização
            </p>
            <CrmPublicFormRenderer form={preview} preview />
          </div>
        </div>
      </div>
    </div>
  )
}

function FieldEditor({
  field,
  index,
  total,
  mappingOptions,
  onChange,
  onRemove,
  onMove,
}: {
  field: CrmFormFieldDefinition
  index: number
  total: number
  mappingOptions: MappingOption[]
  onChange: (patch: Partial<CrmFormFieldDefinition>) => void
  onRemove: () => void
  onMove: (dir: -1 | 1) => void
}) {
  const mappingValue = `${field.mapping.target}.${field.mapping.attribute}`

  function setOption(i: number, label: string) {
    onChange({
      options: (field.options ?? []).map((o, idx) =>
        idx === i ? { label, value: label } : o,
      ),
    })
  }
  function addOption() {
    onChange({
      options: [...(field.options ?? []), { label: 'Opção', value: 'Opção' }],
    })
  }
  function removeOption(i: number) {
    onChange({ options: (field.options ?? []).filter((_, idx) => idx !== i) })
  }

  return (
    <div className='flex flex-col gap-3 rounded-lg border p-4'>
      <div className='flex items-center gap-2'>
        <Input
          value={field.label}
          placeholder='Rótulo do campo'
          onChange={(e) => onChange({ label: e.target.value })}
        />
        <Button
          variant='ghost'
          size='icon-sm'
          aria-label='Mover para cima'
          disabled={index === 0}
          onClick={() => onMove(-1)}
        >
          <SteelIcon icon={ArrowUp01Icon} strokeWidth={2} />
        </Button>
        <Button
          variant='ghost'
          size='icon-sm'
          aria-label='Mover para baixo'
          disabled={index === total - 1}
          onClick={() => onMove(1)}
        >
          <SteelIcon icon={ArrowDown01Icon} strokeWidth={2} />
        </Button>
        <Button
          variant='ghost'
          size='icon-sm'
          aria-label='Remover campo'
          onClick={onRemove}
        >
          <SteelIcon icon={Delete02Icon} strokeWidth={2} />
        </Button>
      </div>

      <div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
        <div className='flex flex-col gap-1.5'>
          <Label>Tipo</Label>
          <Select
            value={field.type}
            onValueChange={(v) => onChange({ type: v as CrmFormFieldTypeDTO })}
          >
            <SelectTrigger className='w-full'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FORM_FIELD_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {TYPE_LABELS[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className='flex flex-col gap-1.5'>
          <Label>Preenche</Label>
          <Select
            value={mappingValue}
            onValueChange={(v) => {
              const opt = mappingOptions.find((o) => o.value === v)
              if (opt) {
                onChange({
                  mapping: { target: opt.target, attribute: opt.attribute },
                })
              }
            }}
          >
            <SelectTrigger className='w-full'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {mappingOptions.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className='flex flex-col gap-1.5'>
        <Label>Placeholder</Label>
        <Input
          value={field.placeholder ?? ''}
          placeholder='Texto de ajuda exibido no campo'
          onChange={(e) =>
            onChange({ placeholder: e.target.value || undefined })
          }
        />
      </div>

      {field.type === 'select' ? (
        <div className='flex flex-col gap-2'>
          <Label>Opções</Label>
          {(field.options ?? []).map((opt, i) => (
            <div key={opt.value + i} className='flex items-center gap-2'>
              <Input
                value={opt.label}
                placeholder='Opção'
                onChange={(e) => setOption(i, e.target.value)}
              />
              <Button
                variant='ghost'
                size='icon-sm'
                aria-label='Remover opção'
                onClick={() => removeOption(i)}
              >
                <SteelIcon icon={Delete02Icon} strokeWidth={2} />
              </Button>
            </div>
          ))}
          <Button variant='outline' size='sm' onClick={addOption}>
            <SteelIcon icon={Add01Icon} strokeWidth={2} />
            Adicionar opção
          </Button>
        </div>
      ) : null}

      <div className='flex items-center gap-2 text-sm'>
        <Switch
          checked={field.required}
          onCheckedChange={(checked) => onChange({ required: checked })}
        />
        Campo obrigatório
      </div>
    </div>
  )
}
