'use client'

import { useState } from 'react'
import { SdEntityCustomFieldsForm } from '@/app/_components/servicedesk/custom-fields/sd-custom-fields-form'
import {
  EMPTY_SD_ADDRESS,
  SdAddressFields,
  type SdAddressValue,
} from '@/app/_components/servicedesk/directory/shared/sd-address-fields'
import {
  SdDocumentInput,
  SdField,
  SdFormSection,
  SdPhoneInput,
} from '@/app/_components/servicedesk/directory/shared/sd-form-bits'
import {
  blankToNull,
  maskCep,
  maskPhone,
} from '@/app/_components/servicedesk/directory/shared/sd-masks'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select'
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
import {
  type SdCustomerInput,
  useCreateSdCustomer,
  useUpdateSdCustomer,
} from '@/src/hooks/use-sd-customers'
import {
  detectPersonType,
  formatDocument,
  validateDocument,
} from '@/src/lib/servicedesk/document'
import type {
  SdCustomerDTO,
  SdCustomerKindDTO,
  SdPersonTypeDTO,
} from '@/types/sd-customer'
import type { SdCustomFieldValuesDTO } from '@/types/sd-directory'
import {
  SD_CUSTOMER_KIND_LABEL,
  SD_PERSON_TYPE_LABEL,
} from '../shared/sd-directory-labels'

interface FormState {
  kind: SdCustomerKindDTO
  personType: SdPersonTypeDTO
  name: string
  tradeName: string
  document: string
  email: string
  phone: string
  whatsapp: string
  address: SdAddressValue
  notes: string
  active: boolean
}

function initialState(
  kind: SdCustomerKindDTO,
  customer?: SdCustomerDTO | null,
): FormState {
  if (!customer) {
    return {
      kind,
      personType: kind === 'COMPANY' ? 'LEGAL' : 'INDIVIDUAL',
      name: '',
      tradeName: '',
      document: '',
      email: '',
      phone: '',
      whatsapp: '',
      address: EMPTY_SD_ADDRESS,
      notes: '',
      active: true,
    }
  }
  return {
    kind: customer.kind,
    personType: customer.personType,
    name: customer.name,
    tradeName: customer.tradeName ?? '',
    document: customer.document ? formatDocument(customer.document) : '',
    email: customer.email ?? '',
    phone: customer.phone ? maskPhone(customer.phone) : '',
    whatsapp: customer.whatsapp ? maskPhone(customer.whatsapp) : '',
    address: {
      zipCode: customer.zipCode ? maskCep(customer.zipCode) : '',
      street: customer.street ?? '',
      number: customer.number ?? '',
      complement: customer.complement ?? '',
      district: customer.district ?? '',
      city: customer.city ?? '',
      state: customer.state ?? '',
      ibgeCode: customer.ibgeCode ?? '',
    },
    notes: customer.notes ?? '',
    active: customer.active,
  }
}

/** Criação/edição de cliente ou empresa em um painel lateral com seções. */
export function SdCustomerFormSheet({
  workspaceId,
  kind,
  open,
  onOpenChange,
  customer,
  onSaved,
}: {
  workspaceId: string
  kind: SdCustomerKindDTO
  open: boolean
  onOpenChange: (open: boolean) => void
  customer?: SdCustomerDTO | null
  onSaved?: (customer: SdCustomerDTO) => void
}) {
  const [form, setForm] = useState<FormState>(() =>
    initialState(kind, customer),
  )
  const create = useCreateSdCustomer(workspaceId)
  const update = useUpdateSdCustomer(workspaceId)
  const busy = create.isPending || update.isPending
  const editing = Boolean(customer)

  // Reinicia ao abrir.
  const [customFields, setCustomFields] = useState<Record<string, unknown>>(
    () => customer?.customFields ?? {},
  )
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setForm(initialState(kind, customer))
      setCustomFields(customer?.customFields ?? {})
    }
  }

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  // Documento completo decide PF/PJ.
  function setDocument(value: string) {
    const inferred = detectPersonType(value)
    setForm((current) => ({
      ...current,
      document: value,
      personType: inferred ?? current.personType,
    }))
  }

  function submit() {
    if (!form.name.trim()) {
      notify.error('Informe o nome.')
      return
    }
    if (form.document.trim() && !validateDocument(form.document).valid) {
      notify.error('CPF/CNPJ inválido.')
      return
    }
    const payload: SdCustomerInput = {
      kind: form.kind,
      personType: form.personType,
      name: form.name.trim(),
      tradeName: blankToNull(form.tradeName),
      document: blankToNull(form.document),
      email: blankToNull(form.email),
      phone: blankToNull(form.phone),
      whatsapp: blankToNull(form.whatsapp),
      zipCode: blankToNull(form.address.zipCode),
      street: blankToNull(form.address.street),
      number: blankToNull(form.address.number),
      complement: blankToNull(form.address.complement),
      district: blankToNull(form.address.district),
      city: blankToNull(form.address.city),
      state: blankToNull(form.address.state),
      ibgeCode: blankToNull(form.address.ibgeCode),
      notes: blankToNull(form.notes),
      active: form.active,
      customFields: customFields as SdCustomFieldValuesDTO,
    }
    const done = {
      onSuccess: (saved: SdCustomerDTO) => {
        notify.success(editing ? 'Cadastro atualizado.' : 'Cadastro criado.')
        onSaved?.(saved)
        onOpenChange(false)
      },
      onError: notify.error,
    }
    if (customer) update.mutate({ id: customer.id, data: payload }, done)
    else create.mutate({ ...payload, name: form.name.trim() }, done)
  }

  const noun = form.kind === 'COMPANY' ? 'empresa' : 'cliente'

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className='flex w-full flex-col gap-0 p-0 sm:max-w-2xl'>
        <SheetHeader className='border-b px-6 py-4'>
          <SheetTitle>{editing ? `Editar ${noun}` : `Novo ${noun}`}</SheetTitle>
          <SheetDescription>
            CPF/CNPJ é validado (inclusive o CNPJ alfanumérico) e não pode se
            repetir no workspace.
          </SheetDescription>
        </SheetHeader>

        <form
          id='sd-customer-form'
          className='flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-6 py-5'
          onSubmit={(e) => {
            e.preventDefault()
            submit()
          }}
        >
          <SdFormSection title='Identificação'>
            <SdField label='Nome / razão social' htmlFor='sd-customer-name'>
              <Input
                id='sd-customer-name'
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                autoFocus
              />
            </SdField>
            <SdField label='Nome fantasia' htmlFor='sd-customer-trade'>
              <Input
                id='sd-customer-trade'
                value={form.tradeName}
                onChange={(e) => set('tradeName', e.target.value)}
              />
            </SdField>
            <SdField label='CPF / CNPJ' htmlFor='sd-customer-document'>
              <SdDocumentInput
                id='sd-customer-document'
                value={form.document}
                onChange={setDocument}
              />
            </SdField>
            <div className='grid grid-cols-2 gap-3'>
              <SdField label='Tipo de pessoa'>
                <Select
                  value={form.personType}
                  onValueChange={(v) => set('personType', v as SdPersonTypeDTO)}
                >
                  <SelectTrigger className='w-full'>
                    <span>{SD_PERSON_TYPE_LABEL[form.personType]}</span>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='INDIVIDUAL'>Pessoa física</SelectItem>
                    <SelectItem value='LEGAL'>Pessoa jurídica</SelectItem>
                  </SelectContent>
                </Select>
              </SdField>
              <SdField label='Lista'>
                <Select
                  value={form.kind}
                  onValueChange={(v) => set('kind', v as SdCustomerKindDTO)}
                >
                  <SelectTrigger className='w-full'>
                    <span>{SD_CUSTOMER_KIND_LABEL[form.kind]}</span>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='CLIENT'>Cliente</SelectItem>
                    <SelectItem value='COMPANY'>Empresa</SelectItem>
                  </SelectContent>
                </Select>
              </SdField>
            </div>
          </SdFormSection>

          <SdFormSection title='Contato'>
            <SdField
              label='E-mail'
              htmlFor='sd-customer-email'
              className='sm:col-span-2'
            >
              <Input
                id='sd-customer-email'
                type='email'
                value={form.email}
                onChange={(e) => set('email', e.target.value)}
              />
            </SdField>
            <SdField label='Telefone' htmlFor='sd-customer-phone'>
              <SdPhoneInput
                id='sd-customer-phone'
                value={form.phone}
                onChange={(v) => set('phone', v)}
              />
            </SdField>
            <SdField label='WhatsApp' htmlFor='sd-customer-whatsapp'>
              <SdPhoneInput
                id='sd-customer-whatsapp'
                value={form.whatsapp}
                onChange={(v) => set('whatsapp', v)}
                whatsapp
              />
            </SdField>
          </SdFormSection>

          <SdAddressFields
            workspaceId={workspaceId}
            value={form.address}
            onChange={(address) => set('address', address)}
          />

          <SdFormSection title='Observações' className='sm:grid-cols-1'>
            <Textarea
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
              rows={4}
              placeholder='Informações úteis para o atendimento…'
            />
            {/* biome-ignore lint/a11y/noLabelWithoutControl: o Switch é o controle envolvido */}
            <label className='flex items-center gap-2 text-sm'>
              <Switch
                checked={form.active}
                onCheckedChange={(checked) => set('active', Boolean(checked))}
              />
              Cadastro ativo (aparece nos seletores do chamado)
            </label>
          </SdFormSection>
          <SdEntityCustomFieldsForm
            workspaceId={workspaceId}
            entity='CUSTOMER'
            values={customFields}
            onChange={setCustomFields}
            idPrefix='sd-customer-cf'
          />
        </form>

        <SheetFooter className='flex-row justify-end gap-2 border-t px-6 py-4'>
          <Button variant='outline' onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type='submit' form='sd-customer-form' disabled={busy}>
            {busy ? 'Salvando…' : editing ? 'Salvar' : 'Criar'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
