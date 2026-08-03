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
  useCreateCrmIntegrationKey,
  useCrmIntegrationKeys,
  useRevokeCrmIntegrationKey,
} from '@/src/hooks/use-crm-integration-key'

export function CrmIntegrationKeysPanel({
  workspaceId,
}: {
  workspaceId: string
}) {
  const { data: keys, isLoading } = useCrmIntegrationKeys(workspaceId)
  const revokeKey = useRevokeCrmIntegrationKey(workspaceId)

  async function handleRevoke(keyId: string) {
    try {
      await revokeKey.mutateAsync(keyId)
      notify.success('Chave revogada')
    } catch (err) {
      notify.error(err)
    }
  }

  return (
    <div className='flex h-full min-h-0 flex-col gap-3'>
      <div className='flex justify-end'>
        <CreateCrmIntegrationKeyDialog workspaceId={workspaceId} />
      </div>
      <div className='min-h-0 flex-1 overflow-y-auto'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Prefixo</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className='w-10' />
            </TableRow>
          </TableHeader>
          <TableBody>
            {!isLoading && keys?.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className='text-center text-muted-foreground'
                >
                  Nenhuma chave criada
                </TableCell>
              </TableRow>
            )}
            {keys?.map((key) => (
              <TableRow key={key.id}>
                <TableCell>{key.name}</TableCell>
                <TableCell className='font-mono text-xs'>
                  {key.prefix}…
                </TableCell>
                <TableCell>{key.revokedAt ? 'Revogada' : 'Ativa'}</TableCell>
                <TableCell>
                  {!key.revokedAt && (
                    <Button
                      variant='ghost'
                      size='icon-xs'
                      onClick={() => handleRevoke(key.id)}
                    >
                      <SteelIcon icon={Delete02Icon} strokeWidth={2} />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

function CreateCrmIntegrationKeyDialog({
  workspaceId,
}: {
  workspaceId: string
}) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [plaintextKey, setPlaintextKey] = useState<string | null>(null)
  const createKey = useCreateCrmIntegrationKey(workspaceId)

  function handleClose() {
    setOpen(false)
    setName('')
    setPlaintextKey(null)
    createKey.reset()
  }

  async function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    try {
      const created = await createKey.mutateAsync(name)
      setPlaintextKey(created.plaintextKey)
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
            Nova chave
          </Button>
        }
      />
      <DialogContent className='w-full sm:max-w-md'>
        {plaintextKey ? (
          <div className='flex flex-col gap-4 p-4'>
            <p className='text-sm text-muted-foreground'>
              Copie esta chave agora — ela não será mostrada novamente.
            </p>
            <code className='break-all rounded-md bg-muted p-3 text-xs'>
              {plaintextKey}
            </code>
            <div className='flex justify-end'>
              <Button size='sm' onClick={handleClose}>
                Concluir
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className='flex flex-col gap-4 p-4'>
            <FieldGroup>
              <Field>
                <Input
                  placeholder='Nome (ex.: Zapier)'
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
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
                disabled={createKey.isPending || !name}
              >
                {createKey.isPending ? 'Criando...' : 'Criar chave'}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
