'use client'

import { Delete02Icon, PlusSignIcon } from '@hugeicons-pro/core-stroke-rounded'
import { useState } from 'react'
import { SteelIcon } from '@/components/icon/icon'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Field, FieldGroup } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { notify } from '@/lib/notify'
import {
  useCreateCrmCustomField,
  useCrmCustomFields,
  useDeleteCrmCustomField,
} from '@/src/hooks/use-crm-custom-field'
import type {
  CrmCustomFieldEntityDTO,
  CrmCustomFieldTypeDTO,
} from '@/types/crm-custom-field'

const ENTITIES: CrmCustomFieldEntityDTO[] = ['COMPANY', 'PERSON', 'OPPORTUNITY']
const TYPES: CrmCustomFieldTypeDTO[] = [
  'TEXT',
  'NUMBER',
  'DATE',
  'BOOLEAN',
  'SELECT',
]

export function CrmCustomFieldsPanel({ workspaceId }: { workspaceId: string }) {
  const [entity, setEntity] = useState<CrmCustomFieldEntityDTO>('COMPANY')
  const { data: fields, isLoading } = useCrmCustomFields(workspaceId, entity)
  const deleteField = useDeleteCrmCustomField(workspaceId)

  async function handleDelete(definitionId: string) {
    try {
      await deleteField.mutateAsync(definitionId)
      notify.success('Campo removido')
    } catch (err) {
      notify.error(err)
    }
  }

  return (
    <div className='flex flex-col gap-3'>
      <div className='flex items-center justify-between'>
        <Select
          items={ENTITIES.map((e) => ({ value: e, label: e }))}
          value={entity}
          onValueChange={(value) => setEntity(value as CrmCustomFieldEntityDTO)}
        >
          <SelectTrigger className='w-48'>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {ENTITIES.map((e) => (
                <SelectItem key={e} value={e}>
                  {e}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        <CreateCrmCustomFieldDialog workspaceId={workspaceId} entity={entity} />
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Chave</TableHead>
            <TableHead>Rótulo</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead className='w-10' />
          </TableRow>
        </TableHeader>
        <TableBody>
          {!isLoading && fields?.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={4}
                className='text-center text-muted-foreground'
              >
                Nenhum campo customizado para {entity}
              </TableCell>
            </TableRow>
          )}
          {fields?.map((field) => (
            <TableRow key={field.id}>
              <TableCell>{field.key}</TableCell>
              <TableCell>{field.label}</TableCell>
              <TableCell>{field.type}</TableCell>
              <TableCell>
                <Button
                  variant='ghost'
                  size='icon-xs'
                  onClick={() => handleDelete(field.id)}
                >
                  <SteelIcon icon={Delete02Icon} strokeWidth={2} />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function CreateCrmCustomFieldDialog({
  workspaceId,
  entity,
}: {
  workspaceId: string
  entity: CrmCustomFieldEntityDTO
}) {
  const [open, setOpen] = useState(false)
  const [key, setKey] = useState('')
  const [label, setLabel] = useState('')
  const [type, setType] = useState<CrmCustomFieldTypeDTO>('TEXT')
  const createField = useCreateCrmCustomField(workspaceId)

  function handleClose() {
    setOpen(false)
    setKey('')
    setLabel('')
    setType('TEXT')
    createField.reset()
  }

  async function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    try {
      await createField.mutateAsync({ entity, key, label, type })
      notify.success('Campo criado')
      handleClose()
    } catch (err) {
      notify.error(err)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => (v ? setOpen(true) : handleClose())}
    >
      <DialogTrigger
        render={
          <Button variant='default' size='xs'>
            <SteelIcon icon={PlusSignIcon} strokeWidth={2} />
            Novo campo
          </Button>
        }
      />
      <DialogContent className='w-full sm:max-w-md'>
        <form onSubmit={handleSubmit} className='flex flex-col gap-4 p-4'>
          <FieldGroup>
            <Field>
              <Input
                placeholder='Chave (snake_case)'
                value={key}
                onChange={(e) => setKey(e.target.value)}
                required
              />
            </Field>
            <Field>
              <Input
                placeholder='Rótulo'
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                required
              />
            </Field>
            <Field>
              <Select
                items={TYPES.map((t) => ({ value: t, label: t }))}
                value={type}
                onValueChange={(value) =>
                  setType(value as CrmCustomFieldTypeDTO)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
          </FieldGroup>
          <div className='flex justify-end gap-2'>
            <DialogClose
              render={
                <Button
                  variant='outline'
                  size='sm'
                  type='button'
                  onClick={handleClose}
                >
                  Cancelar
                </Button>
              }
            />
            <Button
              size='sm'
              type='submit'
              disabled={createField.isPending || !key || !label}
            >
              {createField.isPending ? 'Criando...' : 'Criar campo'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
