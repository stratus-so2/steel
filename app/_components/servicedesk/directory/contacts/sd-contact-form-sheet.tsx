'use client'

import { Cancel01Icon, StarIcon } from '@hugeicons-pro/core-stroke-rounded'
import { useState } from 'react'
import { SdEntityCustomFieldsForm } from '@/app/_components/servicedesk/custom-fields/sd-custom-fields-form'
import {
  SdField,
  SdFormSection,
  SdPhoneInput,
} from '@/app/_components/servicedesk/directory/shared/sd-form-bits'
import {
  blankToNull,
  maskPhone,
} from '@/app/_components/servicedesk/directory/shared/sd-masks'
import {
  SdCustomerPicker,
  SdUserPicker,
} from '@/app/_components/servicedesk/pickers'
import { SteelIcon } from '@/components/icon/icon'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { notify } from '@/lib/notify'
import { cn } from '@/lib/utils'
import {
  type SdContactInput,
  useCreateSdContact,
  useUpdateSdContact,
} from '@/src/hooks/use-sd-contacts'
import type { SdContactDTO } from '@/types/sd-contact'
import type { SdCustomFieldValuesDTO } from '@/types/sd-directory'

interface LinkState {
  id: string
  name: string
  isPrimary: boolean
}

interface FormState {
  name: string
  jobTitle: string
  email: string
  phone: string
  whatsapp: string
  userId: string | null
  userLabel: string | null
  customers: LinkState[]
  notes: string
  active: boolean
}

function initialState(
  contact?: SdContactDTO | null,
  defaultCustomer?: { id: string; name: string } | null,
): FormState {
  if (!contact) {
    return {
      name: '',
      jobTitle: '',
      email: '',
      phone: '',
      whatsapp: '',
      userId: null,
      userLabel: null,
      customers: defaultCustomer
        ? [{ ...defaultCustomer, isPrimary: true }]
        : [],
      notes: '',
      active: true,
    }
  }
  return {
    name: contact.name,
    jobTitle: contact.jobTitle ?? '',
    email: contact.email ?? '',
    phone: contact.phone ? maskPhone(contact.phone) : '',
    whatsapp: contact.whatsapp ? maskPhone(contact.whatsapp) : '',
    userId: contact.userId,
    userLabel: contact.user?.name ?? null,
    customers: contact.customers.map((c) => ({
      id: c.id,
      name: c.name,
      isPrimary: c.isPrimary,
    })),
    notes: contact.notes ?? '',
    active: contact.active,
  }
}

/** Criação/edição de contato com vínculos a um ou mais clientes/empresas. */
export function SdContactFormSheet({
  workspaceId,
  open,
  onOpenChange,
  contact,
  defaultCustomer,
  onSaved,
}: {
  workspaceId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  contact?: SdContactDTO | null
  /** Pré-vincula ao cliente de onde o formulário foi aberto. */
  defaultCustomer?: { id: string; name: string } | null
  onSaved?: (contact: SdContactDTO) => void
}) {
  const [form, setForm] = useState<FormState>(() =>
    initialState(contact, defaultCustomer),
  )
  const create = useCreateSdContact(workspaceId)
  const update = useUpdateSdContact(workspaceId)
  const busy = create.isPending || update.isPending
  const editing = Boolean(contact)

  // Reinicia ao abrir (os objetos podem ser recriados a cada render do pai).
  const [customFields, setCustomFields] = useState<Record<string, unknown>>(
    () => contact?.customFields ?? {},
  )
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setForm(initialState(contact, defaultCustomer))
      setCustomFields(contact?.customFields ?? {})
    }
  }

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  function addCustomer(option: { id: string; label: string } | null) {
    if (!option) return
    setForm((current) =>
      current.customers.some((c) => c.id === option.id)
        ? current
        : {
            ...current,
            customers: [
              ...current.customers,
              {
                id: option.id,
                name: option.label,
                isPrimary: current.customers.length === 0,
              },
            ],
          },
    )
  }

  function removeCustomer(id: string) {
    setForm((current) => {
      const rest = current.customers.filter((c) => c.id !== id)
      if (rest.length > 0 && !rest.some((c) => c.isPrimary)) {
        rest[0] = { ...rest[0], isPrimary: true }
      }
      return { ...current, customers: rest }
    })
  }

  function makePrimary(id: string) {
    setForm((current) => ({
      ...current,
      customers: current.customers.map((c) => ({
        ...c,
        isPrimary: c.id === id,
      })),
    }))
  }

  function submit() {
    if (!form.name.trim()) {
      notify.error('Informe o nome.')
      return
    }
    const payload: SdContactInput = {
      name: form.name.trim(),
      jobTitle: blankToNull(form.jobTitle),
      email: blankToNull(form.email),
      phone: blankToNull(form.phone),
      whatsapp: blankToNull(form.whatsapp),
      userId: form.userId,
      notes: blankToNull(form.notes),
      active: form.active,
      customFields: customFields as SdCustomFieldValuesDTO,
      customers: form.customers.map((c) => ({
        customerId: c.id,
        isPrimary: c.isPrimary,
      })),
    }
    const done = {
      onSuccess: (saved: SdContactDTO) => {
        notify.success(editing ? 'Contato atualizado.' : 'Contato criado.')
        onSaved?.(saved)
        onOpenChange(false)
      },
      onError: notify.error,
    }
    if (contact) update.mutate({ id: contact.id, data: payload }, done)
    else create.mutate({ ...payload, name: form.name.trim() }, done)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className='flex w-full flex-col gap-0 p-0 sm:max-w-2xl'>
        <SheetHeader className='border-b px-6 py-4'>
          <SheetTitle>{editing ? 'Editar contato' : 'Novo contato'}</SheetTitle>
          <SheetDescription>
            Um contato pode atender por vários clientes e empresas; o principal
            aparece primeiro no chamado.
          </SheetDescription>
        </SheetHeader>

        <form
          id='sd-contact-form'
          className='flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-6 py-5'
          onSubmit={(e) => {
            e.preventDefault()
            submit()
          }}
        >
          <SdFormSection title='Dados'>
            <SdField label='Nome' htmlFor='sd-contact-name'>
              <Input
                id='sd-contact-name'
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                autoFocus
              />
            </SdField>
            <SdField label='Cargo' htmlFor='sd-contact-job'>
              <Input
                id='sd-contact-job'
                value={form.jobTitle}
                onChange={(e) => set('jobTitle', e.target.value)}
              />
            </SdField>
            <SdField
              label='E-mail'
              htmlFor='sd-contact-email'
              className='sm:col-span-2'
            >
              <Input
                id='sd-contact-email'
                type='email'
                value={form.email}
                onChange={(e) => set('email', e.target.value)}
              />
            </SdField>
            <SdField label='Telefone' htmlFor='sd-contact-phone'>
              <SdPhoneInput
                id='sd-contact-phone'
                value={form.phone}
                onChange={(v) => set('phone', v)}
              />
            </SdField>
            <SdField
              label='WhatsApp'
              htmlFor='sd-contact-whatsapp'
              hint='Usado para reconhecer mensagens recebidas no WhatsApp do ServiceDesk.'
            >
              <SdPhoneInput
                id='sd-contact-whatsapp'
                value={form.whatsapp}
                onChange={(v) => set('whatsapp', v)}
                whatsapp
              />
            </SdField>
          </SdFormSection>

          <SdFormSection
            title='Clientes e empresas'
            description='Clique na estrela para definir o principal.'
            className='sm:grid-cols-1'
          >
            {form.customers.length > 0 ? (
              <ul className='divide-y rounded-lg border'>
                {form.customers.map((c) => (
                  <li
                    key={c.id}
                    className='flex items-center gap-2 px-3 py-2 text-sm'
                  >
                    <button
                      type='button'
                      onClick={() => makePrimary(c.id)}
                      aria-label={
                        c.isPrimary ? 'Principal' : 'Definir como principal'
                      }
                      className='rounded p-0.5 hover:bg-muted'
                    >
                      <SteelIcon
                        icon={StarIcon}
                        strokeWidth={2}
                        className={cn(
                          'size-4',
                          c.isPrimary
                            ? 'fill-highlight text-highlight'
                            : 'text-muted-foreground',
                        )}
                      />
                    </button>
                    <span className='min-w-0 flex-1 truncate'>{c.name}</span>
                    {c.isPrimary ? (
                      <span className='text-muted-foreground text-xs'>
                        Principal
                      </span>
                    ) : null}
                    <button
                      type='button'
                      onClick={() => removeCustomer(c.id)}
                      aria-label={`Remover ${c.name}`}
                      className='rounded p-0.5 text-muted-foreground hover:bg-muted'
                    >
                      <SteelIcon
                        icon={Cancel01Icon}
                        strokeWidth={2}
                        className='size-3.5'
                      />
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            <SdCustomerPicker
              workspaceId={workspaceId}
              value={null}
              onChange={addCustomer}
              placeholder='Vincular cliente ou empresa…'
            />
          </SdFormSection>

          <SdFormSection title='Acesso à plataforma' className='sm:grid-cols-1'>
            <SdField
              label='Usuário vinculado'
              hint='Opcional: membro do workspace que é este contato (chat interno e portal).'
            >
              <SdUserPicker
                workspaceId={workspaceId}
                value={form.userId}
                selectedLabel={form.userLabel}
                onChange={(option) =>
                  setForm((current) => ({
                    ...current,
                    userId: option?.id ?? null,
                    userLabel: option?.label ?? null,
                  }))
                }
                placeholder='Nenhum usuário'
              />
            </SdField>
          </SdFormSection>

          <SdFormSection title='Observações' className='sm:grid-cols-1'>
            <Textarea
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
              rows={3}
            />
            {/* biome-ignore lint/a11y/noLabelWithoutControl: o Switch é o controle envolvido */}
            <label className='flex items-center gap-2 text-sm'>
              <Switch
                checked={form.active}
                onCheckedChange={(checked) => set('active', Boolean(checked))}
              />
              Contato ativo
            </label>
          </SdFormSection>
          <SdEntityCustomFieldsForm
            workspaceId={workspaceId}
            entity='CONTACT'
            values={customFields}
            onChange={setCustomFields}
            idPrefix='sd-contact-cf'
          />
        </form>

        <SheetFooter className='flex-row justify-end gap-2 border-t px-6 py-4'>
          <Button variant='outline' onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type='submit' form='sd-contact-form' disabled={busy}>
            {busy ? 'Salvando…' : editing ? 'Salvar' : 'Criar'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
