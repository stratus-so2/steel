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
  useCreateCrmProduct,
  useCrmProducts,
  useDeleteCrmProduct,
} from '@/src/hooks/use-crm-product'

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

export function CrmProductsTable({ workspaceId }: { workspaceId: string }) {
  const { data: products, isLoading } = useCrmProducts(workspaceId)
  const deleteProduct = useDeleteCrmProduct(workspaceId)

  async function handleDelete(productId: string) {
    try {
      await deleteProduct.mutateAsync(productId)
      notify.success('Produto removido')
    } catch (err) {
      notify.error(err)
    }
  }

  return (
    <div className='flex flex-col gap-3'>
      <div className='flex justify-end'>
        <CreateCrmProductDialog workspaceId={workspaceId} />
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Produto</TableHead>
            <TableHead>Preço</TableHead>
            <TableHead>Ativo</TableHead>
            <TableHead className='w-10' />
          </TableRow>
        </TableHeader>
        <TableBody>
          {!isLoading && products?.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={4}
                className='text-center text-muted-foreground'
              >
                Nenhum produto cadastrado
              </TableCell>
            </TableRow>
          )}
          {products?.map((product) => (
            <TableRow key={product.id}>
              <TableCell>{product.name}</TableCell>
              <TableCell>
                {currencyFormatter.format(product.unitPrice)}
              </TableCell>
              <TableCell>{product.active ? 'Sim' : 'Não'}</TableCell>
              <TableCell>
                <Button
                  variant='ghost'
                  size='icon-xs'
                  onClick={() => handleDelete(product.id)}
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

function CreateCrmProductDialog({ workspaceId }: { workspaceId: string }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [unitPrice, setUnitPrice] = useState('')
  const createProduct = useCreateCrmProduct(workspaceId)

  function handleClose() {
    setOpen(false)
    setName('')
    setUnitPrice('')
    createProduct.reset()
  }

  async function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    try {
      await createProduct.mutateAsync({
        name,
        unitPrice: unitPrice ? Number(unitPrice) : undefined,
      })
      notify.success('Produto criado')
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
            Adicionar produto
          </Button>
        }
      />
      <DialogContent className='w-full sm:max-w-md'>
        <form onSubmit={handleSubmit} className='flex flex-col gap-4 p-4'>
          <FieldGroup>
            <Field>
              <Input
                placeholder='Nome do produto'
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </Field>
            <Field>
              <Input
                type='number'
                min='0'
                step='0.01'
                placeholder='Preço (opcional)'
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
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
              disabled={createProduct.isPending || !name}
            >
              {createProduct.isPending ? 'Criando...' : 'Criar produto'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
