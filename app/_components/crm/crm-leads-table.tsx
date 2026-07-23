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
  useConvertCrmLead,
  useCreateCrmLead,
  useCrmLeads,
  useDeleteCrmLead,
  useUpdateCrmLeadStatus,
} from '@/src/hooks/use-crm-lead'
import type { CrmLeadStatusDTO } from '@/types/crm-lead'

const STATUSES: CrmLeadStatusDTO[] = [
  'NEW',
  'WORKING',
  'QUALIFIED',
  'UNQUALIFIED',
  'CONVERTED',
]

export function CrmLeadsTable({ workspaceId }: { workspaceId: string }) {
  const { data: leads, isLoading } = useCrmLeads(workspaceId)
  const updateStatus = useUpdateCrmLeadStatus(workspaceId)
  const convertLead = useConvertCrmLead(workspaceId)
  const deleteLead = useDeleteCrmLead(workspaceId)

  async function handleStatusChange(leadId: string, status: CrmLeadStatusDTO) {
    try {
      await updateStatus.mutateAsync({ leadId, status })
    } catch (err) {
      notify.error(err)
    }
  }

  async function handleConvert(leadId: string) {
    try {
      await convertLead.mutateAsync(leadId)
      notify.success('Lead convertido em pessoa')
    } catch (err) {
      notify.error(err)
    }
  }

  async function handleDelete(leadId: string) {
    try {
      await deleteLead.mutateAsync(leadId)
      notify.success('Lead removido')
    } catch (err) {
      notify.error(err)
    }
  }

  return (
    <div className='flex flex-col gap-3'>
      <div className='flex justify-end'>
        <CreateCrmLeadDialog workspaceId={workspaceId} />
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Lead</TableHead>
            <TableHead>Score</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className='w-24' />
          </TableRow>
        </TableHeader>
        <TableBody>
          {!isLoading && leads?.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={4}
                className='text-center text-muted-foreground'
              >
                Nenhum lead cadastrado
              </TableCell>
            </TableRow>
          )}
          {leads?.map((lead) => (
            <TableRow key={lead.id}>
              <TableCell>{lead.name}</TableCell>
              <TableCell>{lead.score}</TableCell>
              <TableCell>
                <Select
                  items={STATUSES.map((s) => ({ value: s, label: s }))}
                  value={lead.status}
                  onValueChange={(value) =>
                    handleStatusChange(lead.id, value as CrmLeadStatusDTO)
                  }
                  disabled={lead.status === 'CONVERTED'}
                >
                  <SelectTrigger className='h-7 w-36 text-xs'>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell>
                <div className='flex items-center gap-1'>
                  <Button
                    variant='outline'
                    size='xs'
                    disabled={lead.status === 'CONVERTED'}
                    onClick={() => handleConvert(lead.id)}
                  >
                    Converter
                  </Button>
                  <Button
                    variant='ghost'
                    size='icon-xs'
                    onClick={() => handleDelete(lead.id)}
                  >
                    <SteelIcon icon={Delete02Icon} strokeWidth={2} />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function CreateCrmLeadDialog({ workspaceId }: { workspaceId: string }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const createLead = useCreateCrmLead(workspaceId)

  function handleClose() {
    setOpen(false)
    setName('')
    setEmail('')
    createLead.reset()
  }

  async function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    try {
      await createLead.mutateAsync({
        name,
        emails: email ? [email] : undefined,
      })
      notify.success('Lead criado')
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
            Novo lead
          </Button>
        }
      />
      <DialogContent className='w-full sm:max-w-md'>
        <form onSubmit={handleSubmit} className='flex flex-col gap-4 p-4'>
          <FieldGroup>
            <Field>
              <Input
                placeholder='Nome'
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </Field>
            <Field>
              <Input
                type='email'
                placeholder='E-mail (opcional)'
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
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
              disabled={createLead.isPending || !name}
            >
              {createLead.isPending ? 'Criando...' : 'Criar lead'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
