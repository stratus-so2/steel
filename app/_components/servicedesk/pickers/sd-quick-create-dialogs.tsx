'use client'

import { useEffect, useState } from 'react'
import {
  SdDocumentInput,
  SdField,
  SdPhoneInput,
} from '@/app/_components/servicedesk/directory/shared/sd-form-bits'
import { blankToNull } from '@/app/_components/servicedesk/directory/shared/sd-masks'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select'
import { notify } from '@/lib/notify'
import {
  useCreateSdConfigItem,
  useSdConfigItemTypes,
} from '@/src/hooks/use-sd-config-items'
import { useCreateSdContact } from '@/src/hooks/use-sd-contacts'
import { useCreateSdCustomer } from '@/src/hooks/use-sd-customers'
import type { SdCustomerKindDTO } from '@/types/sd-customer'
import type { SdPickerCreateProps } from './sd-async-picker'

function QuickDialog({
  open,
  onOpenChange,
  title,
  description,
  busy,
  onSubmit,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  busy: boolean
  onSubmit: () => void
  children: React.ReactNode
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-md'>
        <form
          className='flex flex-col gap-4'
          onSubmit={(e) => {
            e.preventDefault()
            e.stopPropagation()
            onSubmit()
          }}
        >
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <div className='flex flex-col gap-3'>{children}</div>
          <DialogFooter>
            <Button
              type='button'
              variant='outline'
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type='submit' disabled={busy}>
              {busy ? 'Salvando…' : 'Criar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/** Cadastro rápido de cliente/empresa a partir do seletor. */
export function SdCustomerQuickCreateDialog({
  workspaceId,
  kind = 'CLIENT',
  open,
  onOpenChange,
  initialName,
  onCreated,
}: SdPickerCreateProps & { workspaceId: string; kind?: SdCustomerKindDTO }) {
  const create = useCreateSdCustomer(workspaceId)
  const [name, setName] = useState('')
  const [document, setDocument] = useState('')
  const [whatsapp, setWhatsapp] = useState('')

  useEffect(() => {
    if (open) {
      setName(initialName)
      setDocument('')
      setWhatsapp('')
    }
  }, [open, initialName])

  return (
    <QuickDialog
      open={open}
      onOpenChange={onOpenChange}
      title={kind === 'COMPANY' ? 'Nova empresa' : 'Novo cliente'}
      description='Cadastro rápido — complete os dados depois em Cadastros.'
      busy={create.isPending}
      onSubmit={() => {
        if (!name.trim()) return notify.error('Informe o nome.')
        create.mutate(
          {
            kind,
            name: name.trim(),
            document: blankToNull(document),
            whatsapp: blankToNull(whatsapp),
          },
          {
            onSuccess: (customer) => {
              notify.success('Cadastro criado.')
              onCreated({
                id: customer.id,
                label: customer.name,
                sublabel: null,
              })
            },
            onError: notify.error,
          },
        )
      }}
    >
      <SdField label='Nome' htmlFor='sd-quick-customer-name'>
        <Input
          id='sd-quick-customer-name'
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
      </SdField>
      <SdField label='CPF/CNPJ'>
        <SdDocumentInput value={document} onChange={setDocument} />
      </SdField>
      <SdField label='WhatsApp'>
        <SdPhoneInput value={whatsapp} onChange={setWhatsapp} whatsapp />
      </SdField>
    </QuickDialog>
  )
}

/** Cadastro rápido de contato (já vinculado ao cliente filtrado, se houver). */
export function SdContactQuickCreateDialog({
  workspaceId,
  customerId,
  open,
  onOpenChange,
  initialName,
  onCreated,
}: SdPickerCreateProps & { workspaceId: string; customerId?: string | null }) {
  const create = useCreateSdContact(workspaceId)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [whatsapp, setWhatsapp] = useState('')

  useEffect(() => {
    if (open) {
      setName(initialName)
      setEmail('')
      setWhatsapp('')
    }
  }, [open, initialName])

  return (
    <QuickDialog
      open={open}
      onOpenChange={onOpenChange}
      title='Novo contato'
      description={
        customerId
          ? 'O contato será vinculado ao cliente selecionado.'
          : 'Cadastro rápido — complete os dados depois em Contatos.'
      }
      busy={create.isPending}
      onSubmit={() => {
        if (!name.trim()) return notify.error('Informe o nome.')
        create.mutate(
          {
            name: name.trim(),
            email: blankToNull(email),
            whatsapp: blankToNull(whatsapp),
            customers: customerId ? [{ customerId, isPrimary: true }] : [],
          },
          {
            onSuccess: (contact) => {
              notify.success('Contato criado.')
              onCreated({ id: contact.id, label: contact.name, sublabel: null })
            },
            onError: notify.error,
          },
        )
      }}
    >
      <SdField label='Nome' htmlFor='sd-quick-contact-name'>
        <Input
          id='sd-quick-contact-name'
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
      </SdField>
      <SdField label='E-mail' htmlFor='sd-quick-contact-email'>
        <Input
          id='sd-quick-contact-email'
          type='email'
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </SdField>
      <SdField label='WhatsApp'>
        <SdPhoneInput value={whatsapp} onChange={setWhatsapp} whatsapp />
      </SdField>
    </QuickDialog>
  )
}

/** Cadastro rápido de item de configuração. */
export function SdConfigItemQuickCreateDialog({
  workspaceId,
  customerId,
  open,
  onOpenChange,
  initialName,
  onCreated,
}: SdPickerCreateProps & { workspaceId: string; customerId?: string | null }) {
  const create = useCreateSdConfigItem(workspaceId)
  const { data: types = [] } = useSdConfigItemTypes(workspaceId)
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [typeId, setTypeId] = useState('')

  useEffect(() => {
    if (open) {
      setName(initialName)
      setCode('')
      setTypeId('')
    }
  }, [open, initialName])

  // Tipos com atributo obrigatório exigem o formulário completo.
  const selectable = types.filter(
    (t) => !t.attributeSchema.some((a) => a.required),
  )

  return (
    <QuickDialog
      open={open}
      onOpenChange={onOpenChange}
      title='Novo item de configuração'
      description='Cadastro rápido — atributos e relacionamentos podem ser completados depois.'
      busy={create.isPending}
      onSubmit={() => {
        if (!name.trim()) return notify.error('Informe o nome.')
        create.mutate(
          {
            name: name.trim(),
            code: blankToNull(code),
            typeId: typeId || null,
            customerId: customerId ?? null,
          },
          {
            onSuccess: (item) => {
              notify.success('Item criado.')
              onCreated({
                id: item.id,
                label: item.name,
                sublabel: item.code,
              })
            },
            onError: notify.error,
          },
        )
      }}
    >
      <SdField label='Nome' htmlFor='sd-quick-ci-name'>
        <Input
          id='sd-quick-ci-name'
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
      </SdField>
      <SdField label='Código / etiqueta' htmlFor='sd-quick-ci-code'>
        <Input
          id='sd-quick-ci-code'
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
      </SdField>
      <SdField label='Tipo'>
        <Select
          value={typeId || '__none'}
          onValueChange={(v) => setTypeId(v === '__none' ? '' : String(v))}
        >
          <SelectTrigger className='w-full'>
            <span>
              {selectable.find((t) => t.id === typeId)?.name ?? 'Sem tipo'}
            </span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='__none'>Sem tipo</SelectItem>
            {selectable.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </SdField>
    </QuickDialog>
  )
}
