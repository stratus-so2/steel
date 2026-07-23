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
  useCreateCrmReport,
  useCrmReportData,
  useCrmReports,
  useDeleteCrmReport,
} from '@/src/hooks/use-crm-report'

const SOURCES = ['company', 'person', 'opportunity', 'lead'] as const

export function CrmReportsPanel({ workspaceId }: { workspaceId: string }) {
  const { data: reports, isLoading } = useCrmReports(workspaceId)
  const deleteReport = useDeleteCrmReport(workspaceId)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const { data: rows } = useCrmReportData(workspaceId, selectedId)

  async function handleDelete(reportId: string) {
    try {
      await deleteReport.mutateAsync(reportId)
      if (selectedId === reportId) setSelectedId(null)
      notify.success('Relatório removido')
    } catch (err) {
      notify.error(err)
    }
  }

  return (
    <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
      <div className='flex flex-col gap-3'>
        <div className='flex justify-end'>
          <CreateCrmReportDialog workspaceId={workspaceId} />
        </div>
        {!isLoading && reports?.length === 0 && (
          <p className='text-sm text-muted-foreground'>
            Nenhum relatório cadastrado
          </p>
        )}
        <div className='flex flex-col gap-1'>
          {reports?.map((report) => (
            <button
              type='button'
              key={report.id}
              onClick={() => setSelectedId(report.id)}
              className='flex items-center justify-between rounded-md px-3 py-2 text-left text-sm hover:bg-muted'
            >
              <span>
                {report.name}{' '}
                <span className='text-xs text-muted-foreground'>
                  ({report.source})
                </span>
              </span>
              <Button
                variant='ghost'
                size='icon-xs'
                onClick={(e) => {
                  e.stopPropagation()
                  handleDelete(report.id)
                }}
              >
                <SteelIcon icon={Delete02Icon} strokeWidth={2} />
              </Button>
            </button>
          ))}
        </div>
      </div>
      <div>
        {!selectedId && (
          <p className='text-sm text-muted-foreground'>
            Selecione um relatório para ver os dados
          </p>
        )}
        {selectedId && rows && (
          <Table>
            <TableHeader>
              <TableRow>
                {Object.keys(rows[0] ?? {}).map((key) => (
                  <TableHead key={key}>{key}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && (
                <TableRow>
                  <TableCell className='text-center text-muted-foreground'>
                    Sem dados
                  </TableCell>
                </TableRow>
              )}
              {rows.map((row, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: report rows have no stable id
                <TableRow key={i}>
                  {Object.values(row).map((value, j) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: report rows have no stable id
                    <TableCell key={j}>{String(value)}</TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  )
}

function CreateCrmReportDialog({ workspaceId }: { workspaceId: string }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [source, setSource] = useState<(typeof SOURCES)[number]>('opportunity')
  const [columns, setColumns] = useState('name')
  const createReport = useCreateCrmReport(workspaceId)

  function handleClose() {
    setOpen(false)
    setName('')
    setColumns('name')
    createReport.reset()
  }

  async function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    try {
      await createReport.mutateAsync({
        name,
        source,
        columns: columns
          .split(',')
          .map((c) => c.trim())
          .filter(Boolean),
      })
      notify.success('Relatório criado')
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
            Novo relatório
          </Button>
        }
      />
      <DialogContent className='w-full sm:max-w-md'>
        <form onSubmit={handleSubmit} className='flex flex-col gap-4 p-4'>
          <FieldGroup>
            <Field>
              <Input
                placeholder='Nome do relatório'
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </Field>
            <Field>
              <Select
                items={SOURCES.map((s) => ({ value: s, label: s }))}
                value={source}
                onValueChange={(value) =>
                  setSource(value as (typeof SOURCES)[number])
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {SOURCES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <Input
                placeholder='Colunas (separadas por vírgula)'
                value={columns}
                onChange={(e) => setColumns(e.target.value)}
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
              disabled={createReport.isPending || !name}
            >
              {createReport.isPending ? 'Criando...' : 'Criar relatório'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
