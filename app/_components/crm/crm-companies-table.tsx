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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { notify } from '@/lib/notify'
import {
  useCreateCrmCompany,
  useCrmCompanies,
  useDeleteCrmCompany,
} from '@/src/hooks/use-crm-company'

export function CrmCompaniesTable({ workspaceId }: { workspaceId: string }) {
  const { data: companies, isLoading } = useCrmCompanies(workspaceId)
  const deleteCompany = useDeleteCrmCompany(workspaceId)

  async function handleDelete(companyId: string) {
    try {
      await deleteCompany.mutateAsync(companyId)
      notify.success('Empresa removida')
    } catch (err) {
      notify.error(err)
    }
  }

  return (
    <div className='flex flex-col gap-3'>
      <div className='flex justify-end'>
        <CreateCrmCompanyDialog workspaceId={workspaceId} />
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Empresa</TableHead>
            <TableHead>Domínio</TableHead>
            <TableHead>ICP</TableHead>
            <TableHead className='w-10' />
          </TableRow>
        </TableHeader>
        <TableBody>
          {!isLoading && companies?.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={4}
                className='text-center text-muted-foreground'
              >
                Nenhuma empresa cadastrada
              </TableCell>
            </TableRow>
          )}
          {companies?.map((company) => (
            <TableRow key={company.id}>
              <TableCell>{company.name}</TableCell>
              <TableCell>{company.domain ?? '—'}</TableCell>
              <TableCell>{company.icp ? 'Sim' : 'Não'}</TableCell>
              <TableCell>
                <Button
                  variant='ghost'
                  size='icon-xs'
                  onClick={() => handleDelete(company.id)}
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

function CreateCrmCompanyDialog({ workspaceId }: { workspaceId: string }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [domain, setDomain] = useState('')
  const createCompany = useCreateCrmCompany(workspaceId)

  function handleClose() {
    setOpen(false)
    setName('')
    setDomain('')
    createCompany.reset()
  }

  async function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    try {
      await createCompany.mutateAsync({ name, domain: domain || undefined })
      notify.success('Empresa criada')
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
            Adicionar empresa
          </Button>
        }
      />
      <DialogContent className='w-full sm:max-w-md'>
        <form onSubmit={handleSubmit} className='flex flex-col gap-4 p-4'>
          <FieldGroup>
            <Field>
              <Input
                placeholder='Nome da empresa'
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </Field>
            <Field>
              <Input
                placeholder='Domínio (opcional)'
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
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
              disabled={createCompany.isPending || !name}
            >
              {createCompany.isPending ? 'Criando...' : 'Criar empresa'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
