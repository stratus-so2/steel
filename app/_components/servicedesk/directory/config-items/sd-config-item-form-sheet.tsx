'use client'

import { useState } from 'react'
import { SdEntityCustomFieldsForm } from '@/app/_components/servicedesk/custom-fields/sd-custom-fields-form'
import {
  SD_CI_STATUS_LABEL,
  SD_RISK_LABEL,
} from '@/app/_components/servicedesk/directory/shared/sd-directory-labels'
import {
  SdField,
  SdFormSection,
} from '@/app/_components/servicedesk/directory/shared/sd-form-bits'
import { blankToNull } from '@/app/_components/servicedesk/directory/shared/sd-masks'
import {
  SdConfigItemPicker,
  SdCustomerPicker,
  SdUserPicker,
} from '@/app/_components/servicedesk/pickers'
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
import { Textarea } from '@/components/ui/textarea'
import { notify } from '@/lib/notify'
import {
  type SdConfigItemInput,
  useCreateSdConfigItem,
  useSdConfigItemTypes,
  useSdDepartmentOptions,
  useUpdateSdConfigItem,
} from '@/src/hooks/use-sd-config-items'
import type {
  SdConfigItemDTO,
  SdConfigItemStatusDTO,
  SdRiskLevelDTO,
} from '@/types/sd-config-item'
import type { SdCustomFieldValuesDTO } from '@/types/sd-directory'
import {
  fromAttributeFormValues,
  type SdCiAttributeFormValues,
  SdCiAttributeInputs,
  toAttributeFormValues,
} from './sd-ci-attribute-inputs'

interface Ref {
  id: string | null
  label: string | null
}

interface FormState {
  name: string
  code: string
  typeId: string
  status: SdConfigItemStatusDTO
  criticality: SdRiskLevelDTO
  parent: Ref
  customer: Ref
  owner: Ref
  departmentId: string
  serialNumber: string
  manufacturer: string
  model: string
  location: string
  ipAddress: string
  purchasedAt: string
  warrantyUntil: string
  attributes: SdCiAttributeFormValues
  notes: string
}

const EMPTY_REF: Ref = { id: null, label: null }

function day(iso: string | null): string {
  return iso ? iso.slice(0, 10) : ''
}

function initialState(
  item?: SdConfigItemDTO | null,
  defaults?: { parent?: Ref; customer?: Ref },
): FormState {
  return {
    name: item?.name ?? '',
    code: item?.code ?? '',
    typeId: item?.typeId ?? '',
    status: item?.status ?? 'ACTIVE',
    criticality: item?.criticality ?? 'MEDIUM',
    parent: item?.parent
      ? { id: item.parent.id, label: item.parent.name }
      : (defaults?.parent ?? EMPTY_REF),
    customer: item?.customer
      ? { id: item.customer.id, label: item.customer.name }
      : (defaults?.customer ?? EMPTY_REF),
    owner: item?.owner
      ? { id: item.owner.id, label: item.owner.name }
      : EMPTY_REF,
    departmentId: item?.departmentId ?? '',
    serialNumber: item?.serialNumber ?? '',
    manufacturer: item?.manufacturer ?? '',
    model: item?.model ?? '',
    location: item?.location ?? '',
    ipAddress: item?.ipAddress ?? '',
    purchasedAt: day(item?.purchasedAt ?? null),
    warrantyUntil: day(item?.warrantyUntil ?? null),
    attributes: item ? toAttributeFormValues(item.attributes) : {},
    notes: item?.notes ?? '',
  }
}

/** Criação/edição de item de configuração (CMDB). */
export function SdConfigItemFormSheet({
  workspaceId,
  open,
  onOpenChange,
  item,
  defaultParent,
  onSaved,
}: {
  workspaceId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  item?: SdConfigItemDTO | null
  /** Novo filho a partir da árvore de relacionamento. */
  defaultParent?: { id: string; label: string } | null
  onSaved?: (item: SdConfigItemDTO) => void
}) {
  const [form, setForm] = useState<FormState>(() =>
    initialState(item, { parent: defaultParent ?? undefined }),
  )
  const [customFields, setCustomFields] = useState<Record<string, unknown>>(
    () => item?.customFields ?? {},
  )
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setForm(initialState(item, { parent: defaultParent ?? undefined }))
      setCustomFields(item?.customFields ?? {})
    }
  }

  const { data: types = [] } = useSdConfigItemTypes(workspaceId)
  const { data: departments = [] } = useSdDepartmentOptions(workspaceId)
  const create = useCreateSdConfigItem(workspaceId)
  const update = useUpdateSdConfigItem(workspaceId)
  const busy = create.isPending || update.isPending
  const editing = Boolean(item)
  const type = types.find((t) => t.id === form.typeId) ?? null
  const schema = type?.attributeSchema ?? []

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  function submit() {
    if (!form.name.trim()) {
      notify.error('Informe o nome.')
      return
    }
    const missing = schema.filter(
      (def) =>
        def.required &&
        (form.attributes[def.key] === undefined ||
          form.attributes[def.key] === ''),
    )
    if (missing.length > 0) {
      notify.error(`Preencha: ${missing.map((def) => def.label).join(', ')}.`)
      return
    }
    const payload: SdConfigItemInput = {
      name: form.name.trim(),
      code: blankToNull(form.code),
      typeId: form.typeId || null,
      status: form.status,
      criticality: form.criticality,
      parentId: form.parent.id,
      customerId: form.customer.id,
      ownerId: form.owner.id,
      departmentId: form.departmentId || null,
      serialNumber: blankToNull(form.serialNumber),
      manufacturer: blankToNull(form.manufacturer),
      model: blankToNull(form.model),
      location: blankToNull(form.location),
      ipAddress: blankToNull(form.ipAddress),
      purchasedAt: form.purchasedAt || null,
      warrantyUntil: form.warrantyUntil || null,
      notes: blankToNull(form.notes),
      customFields: customFields as SdCustomFieldValuesDTO,
      ...(form.typeId
        ? { attributes: fromAttributeFormValues(schema, form.attributes) }
        : {}),
    }
    const done = {
      onSuccess: (saved: SdConfigItemDTO) => {
        notify.success(editing ? 'Item atualizado.' : 'Item criado.')
        onSaved?.(saved)
        onOpenChange(false)
      },
      onError: notify.error,
    }
    if (item) update.mutate({ id: item.id, data: payload }, done)
    else create.mutate({ ...payload, name: form.name.trim() }, done)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className='flex w-full flex-col gap-0 p-0 sm:max-w-2xl'>
        <SheetHeader className='border-b px-6 py-4'>
          <SheetTitle>
            {editing
              ? 'Editar item de configuração'
              : 'Novo item de configuração'}
          </SheetTitle>
          <SheetDescription>
            Os atributos específicos seguem o tipo escolhido.
          </SheetDescription>
        </SheetHeader>

        <form
          id='sd-ci-form'
          className='flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-6 py-5'
          onSubmit={(e) => {
            e.preventDefault()
            submit()
          }}
        >
          <SdFormSection title='Identificação'>
            <SdField label='Nome' htmlFor='sd-ci-name'>
              <Input
                id='sd-ci-name'
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                autoFocus
              />
            </SdField>
            <SdField label='Código / etiqueta patrimonial' htmlFor='sd-ci-code'>
              <Input
                id='sd-ci-code'
                value={form.code}
                onChange={(e) => set('code', e.target.value)}
              />
            </SdField>
            <SdField label='Tipo'>
              <Select
                value={form.typeId || '__none'}
                onValueChange={(v) =>
                  set('typeId', v === '__none' ? '' : String(v))
                }
              >
                <SelectTrigger className='w-full'>
                  <span>{type?.name ?? 'Sem tipo'}</span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='__none'>Sem tipo</SelectItem>
                  {types.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </SdField>
            <div className='grid grid-cols-2 gap-3'>
              <SdField label='Status'>
                <Select
                  value={form.status}
                  onValueChange={(v) =>
                    set('status', v as SdConfigItemStatusDTO)
                  }
                >
                  <SelectTrigger className='w-full'>
                    <span>{SD_CI_STATUS_LABEL[form.status]}</span>
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(SD_CI_STATUS_LABEL).map(([v, label]) => (
                      <SelectItem key={v} value={v}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </SdField>
              <SdField label='Criticidade'>
                <Select
                  value={form.criticality}
                  onValueChange={(v) => set('criticality', v as SdRiskLevelDTO)}
                >
                  <SelectTrigger className='w-full'>
                    <span>{SD_RISK_LABEL[form.criticality]}</span>
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(SD_RISK_LABEL).map(([v, label]) => (
                      <SelectItem key={v} value={v}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </SdField>
            </div>
          </SdFormSection>

          {type ? (
            <SdFormSection title={`Atributos de ${type.name}`}>
              <SdCiAttributeInputs
                schema={schema}
                values={form.attributes}
                onChange={(attributes) => set('attributes', attributes)}
              />
            </SdFormSection>
          ) : null}

          <SdFormSection title='Relacionamentos'>
            <SdField label='Item pai'>
              <SdConfigItemPicker
                workspaceId={workspaceId}
                value={form.parent.id}
                selectedLabel={form.parent.label}
                excludeId={item?.id}
                allowCreate={false}
                placeholder='Nenhum (item raiz)'
                onChange={(o) =>
                  set('parent', { id: o?.id ?? null, label: o?.label ?? null })
                }
              />
            </SdField>
            <SdField label='Cliente / empresa'>
              <SdCustomerPicker
                workspaceId={workspaceId}
                value={form.customer.id}
                selectedLabel={form.customer.label}
                placeholder='Nenhum'
                onChange={(o) =>
                  set('customer', {
                    id: o?.id ?? null,
                    label: o?.label ?? null,
                  })
                }
              />
            </SdField>
            <SdField label='Responsável'>
              <SdUserPicker
                workspaceId={workspaceId}
                value={form.owner.id}
                selectedLabel={form.owner.label}
                placeholder='Nenhum'
                onChange={(o) =>
                  set('owner', { id: o?.id ?? null, label: o?.label ?? null })
                }
              />
            </SdField>
            {departments.length > 0 ? (
              <SdField label='Departamento'>
                <Select
                  value={form.departmentId || '__none'}
                  onValueChange={(v) =>
                    set('departmentId', v === '__none' ? '' : String(v))
                  }
                >
                  <SelectTrigger className='w-full'>
                    <span>
                      {departments.find((d) => d.id === form.departmentId)
                        ?.name ??
                        (item?.department?.id === form.departmentId
                          ? item?.department?.name
                          : null) ??
                        'Nenhum'}
                    </span>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='__none'>Nenhum</SelectItem>
                    {departments.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </SdField>
            ) : null}
          </SdFormSection>

          <SdFormSection title='Hardware e rede'>
            <SdField label='Fabricante' htmlFor='sd-ci-manufacturer'>
              <Input
                id='sd-ci-manufacturer'
                value={form.manufacturer}
                onChange={(e) => set('manufacturer', e.target.value)}
              />
            </SdField>
            <SdField label='Modelo' htmlFor='sd-ci-model'>
              <Input
                id='sd-ci-model'
                value={form.model}
                onChange={(e) => set('model', e.target.value)}
              />
            </SdField>
            <SdField label='Número de série' htmlFor='sd-ci-serial'>
              <Input
                id='sd-ci-serial'
                value={form.serialNumber}
                onChange={(e) => set('serialNumber', e.target.value)}
                className='font-mono'
              />
            </SdField>
            <SdField label='Endereço IP' htmlFor='sd-ci-ip'>
              <Input
                id='sd-ci-ip'
                value={form.ipAddress}
                onChange={(e) => set('ipAddress', e.target.value)}
                placeholder='10.0.0.10'
                className='font-mono'
              />
            </SdField>
            <SdField
              label='Localização'
              htmlFor='sd-ci-location'
              className='sm:col-span-2'
            >
              <Input
                id='sd-ci-location'
                value={form.location}
                onChange={(e) => set('location', e.target.value)}
                placeholder='Ex.: Datacenter SP · Rack 3'
              />
            </SdField>
          </SdFormSection>

          <SdFormSection title='Aquisição e garantia'>
            <SdField label='Data de compra' htmlFor='sd-ci-purchased'>
              <Input
                id='sd-ci-purchased'
                type='date'
                value={form.purchasedAt}
                onChange={(e) => set('purchasedAt', e.target.value)}
              />
            </SdField>
            <SdField label='Garantia até' htmlFor='sd-ci-warranty'>
              <Input
                id='sd-ci-warranty'
                type='date'
                value={form.warrantyUntil}
                onChange={(e) => set('warrantyUntil', e.target.value)}
              />
            </SdField>
          </SdFormSection>

          <SdFormSection title='Observações' className='sm:grid-cols-1'>
            <Textarea
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
              rows={3}
            />
          </SdFormSection>
          <SdEntityCustomFieldsForm
            workspaceId={workspaceId}
            entity='CONFIG_ITEM'
            values={customFields}
            onChange={setCustomFields}
            idPrefix='sd-config_item-cf'
          />
        </form>

        <SheetFooter className='flex-row justify-end gap-2 border-t px-6 py-4'>
          <Button variant='outline' onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type='submit' form='sd-ci-form' disabled={busy}>
            {busy ? 'Salvando…' : editing ? 'Salvar' : 'Criar'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
