'use client'

import {
  Cancel01Icon,
  Delete02Icon,
  PlusSignIcon,
  UserAdd01Icon,
} from '@hugeicons-pro/core-stroke-rounded'
import { useMemo, useState } from 'react'
import { DataTable } from '@/app/_components/crm/table/data-table'
import type { GridColumn } from '@/app/_components/crm/table/grid'
import { SteelIcon } from '@/components/icon/icon'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import { notify } from '@/lib/notify'
import {
  useAddCrmMailingListMember,
  useCreateCrmMailingList,
  useDeleteCrmMailingList,
  useRemoveCrmMailingListMember,
} from '@/src/hooks/use-crm-email-marketing'
import { useCrmResourceList } from '@/src/hooks/use-crm-resource-list'
import { useCrmWorkspaceLookups } from '@/src/hooks/use-crm-workspace-lookups'
import type {
  CrmMailingListDTO,
  CrmMailingListMemberDTO,
} from '@/types/crm-email-marketing'

const EMAIL_RX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const COLUMNS: GridColumn[] = [
  {
    key: 'name',
    header: 'Nome',
    kind: 'text',
    primary: true,
    readonly: true,
    placeholder: '—',
  },
  { key: 'memberCount', header: 'Membros', kind: 'number', readonly: true },
  {
    key: 'description',
    header: 'Descrição',
    kind: 'text',
    readonly: true,
    placeholder: '—',
  },
  { key: 'createdAt', header: 'Criada em', kind: 'readonly-date' },
]

export function CrmMailingListsTable({
  workspaceId,
  slug,
}: {
  workspaceId: string
  slug: string
}) {
  const { items, isLoading, refetch } = useCrmResourceList<CrmMailingListDTO>(
    workspaceId,
    'mailing-lists',
  )
  const { lookups } = useCrmWorkspaceLookups(workspaceId, [])
  const columns = useMemo(() => COLUMNS, [])
  const [viewing, setViewing] = useState<string | 'new' | null>(null)

  return (
    <>
      <DataTable
        columns={columns}
        data={items}
        workspaceId={workspaceId}
        slug={slug}
        resource='mailing-lists'
        createTitle='lista'
        lookups={lookups}
        isLoading={isLoading}
        searchPlaceholder='Buscar listas…'
        refetch={refetch}
        disableInlineCreate
        headerAction={
          <Button size='sm' onClick={() => setViewing('new')}>
            <SteelIcon icon={PlusSignIcon} strokeWidth={2} />
            Nova lista
          </Button>
        }
        onOpenRecord={(record) => setViewing(record.id)}
      />

      <MailingListSheet
        workspaceId={workspaceId}
        viewing={viewing}
        onClose={() => setViewing(null)}
        onSaved={() => {
          setViewing(null)
          refetch()
        }}
        onDeleted={() => {
          setViewing(null)
          refetch()
        }}
      />
    </>
  )
}

function MailingListSheet({
  workspaceId,
  viewing,
  onClose,
  onSaved,
  onDeleted,
}: {
  workspaceId: string
  viewing: string | 'new' | null
  onClose: () => void
  onSaved: () => void
  onDeleted: () => void
}) {
  const open = viewing !== null
  const isNew = viewing === 'new'

  return (
    <Sheet open={open} onOpenChange={(o) => (o ? null : onClose())}>
      <SheetContent
        side='right'
        showCloseButton={false}
        className='flex w-[560px] max-w-[560px] flex-col gap-0 overflow-hidden p-0 sm:max-w-[560px] data-[side=right]:sm:max-w-[560px]'
      >
        {!open ? null : isNew ? (
          <CreateListPanel
            workspaceId={workspaceId}
            onClose={onClose}
            onSaved={onSaved}
          />
        ) : (
          <ListDetailPanel
            workspaceId={workspaceId}
            id={viewing as string}
            onClose={onClose}
            onDeleted={onDeleted}
          />
        )}
      </SheetContent>
    </Sheet>
  )
}

function PanelHeader({
  onClose,
  title,
}: {
  onClose: () => void
  title: React.ReactNode
}) {
  return (
    <div className='flex shrink-0 items-center gap-2 border-b p-3'>
      <Button
        variant='ghost'
        size='icon-sm'
        onClick={onClose}
        aria-label='Fechar'
      >
        <SteelIcon icon={Cancel01Icon} strokeWidth={2} />
      </Button>
      <SheetTitle className='truncate'>{title}</SheetTitle>
    </div>
  )
}

function CreateListPanel({
  workspaceId,
  onClose,
  onSaved,
}: {
  workspaceId: string
  onClose: () => void
  onSaved: () => void
}) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const createList = useCreateCrmMailingList(workspaceId)

  async function onSubmit() {
    if (!name.trim()) {
      notify.error('Informe o nome da lista')
      return
    }
    try {
      await createList.mutateAsync({
        name: name.trim(),
        description: description.trim() || undefined,
      })
      notify.success('Lista criada')
      onSaved()
    } catch (err) {
      notify.error(err)
    }
  }

  return (
    <>
      <PanelHeader onClose={onClose} title='Nova lista de mailing' />
      <div className='min-h-0 flex-1 overflow-y-auto p-4'>
        <div className='flex flex-col gap-4'>
          <div className='grid gap-1.5'>
            <Label className='text-muted-foreground text-xs'>Nome</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder='Ex: Clientes VIP'
            />
          </div>
          <div className='grid gap-1.5'>
            <Label className='text-muted-foreground text-xs'>
              Descrição (opcional)
            </Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder='Descrição da lista…'
              rows={2}
            />
          </div>
        </div>
      </div>
      <div className='flex shrink-0 items-center justify-end gap-2 border-t p-3'>
        <Button
          variant='ghost'
          onClick={onClose}
          disabled={createList.isPending}
        >
          Cancelar
        </Button>
        <Button onClick={onSubmit} disabled={createList.isPending}>
          {createList.isPending ? 'Criando…' : 'Criar lista'}
        </Button>
      </div>
    </>
  )
}

function ListDetailPanel({
  workspaceId,
  id,
  onClose,
  onDeleted,
}: {
  workspaceId: string
  id: string
  onClose: () => void
  onDeleted: () => void
}) {
  const { items: lists } = useCrmResourceList<CrmMailingListDTO>(
    workspaceId,
    'mailing-lists',
  )
  const list = lists.find((l) => l.id === id)
  const {
    items: members,
    isLoading,
    refetch,
  } = useCrmResourceList<CrmMailingListMemberDTO>(
    workspaceId,
    `mailing-lists/${id}/members`,
  )

  const [emailInput, setEmailInput] = useState('')
  const [nameInput, setNameInput] = useState('')
  const [addError, setAddError] = useState('')
  const addMember = useAddCrmMailingListMember(workspaceId, id)
  const removeMember = useRemoveCrmMailingListMember(workspaceId, id)
  const deleteList = useDeleteCrmMailingList(workspaceId)

  async function handleAddMember() {
    const email = emailInput.trim().toLowerCase()
    if (!email) return
    if (!EMAIL_RX.test(email)) {
      setAddError('Email inválido')
      return
    }
    try {
      await addMember.mutateAsync({
        email,
        name: nameInput.trim() || undefined,
      })
      setEmailInput('')
      setNameInput('')
      setAddError('')
      refetch()
    } catch (err) {
      notify.error(err)
    }
  }

  async function handleRemoveMember(memberId: string) {
    try {
      await removeMember.mutateAsync(memberId)
      refetch()
    } catch (err) {
      notify.error(err)
    }
  }

  async function handleDeleteList() {
    try {
      await deleteList.mutateAsync(id)
      notify.success('Lista removida')
      onDeleted()
    } catch (err) {
      notify.error(err)
    }
  }

  return (
    <>
      <PanelHeader onClose={onClose} title={list?.name ?? 'Lista'} />

      <div className='min-h-0 flex-1 overflow-y-auto p-4'>
        <div className='flex flex-col gap-5'>
          {list?.description ? (
            <p className='text-muted-foreground text-sm'>{list.description}</p>
          ) : null}

          <div className='grid gap-1.5'>
            <Label className='text-muted-foreground text-xs'>
              Adicionar membro
            </Label>
            <div className='flex gap-2'>
              <Input
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder='Nome (opcional)'
                className='w-36 shrink-0'
              />
              <div className='flex-1'>
                <Input
                  value={emailInput}
                  onChange={(e) => {
                    setEmailInput(e.target.value)
                    setAddError('')
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleAddMember()
                    }
                  }}
                  placeholder='email@empresa.com'
                  type='email'
                />
                {addError ? (
                  <p className='mt-1 text-destructive text-xs'>{addError}</p>
                ) : null}
              </div>
              <Button
                type='button'
                variant='outline'
                size='sm'
                onClick={handleAddMember}
                disabled={addMember.isPending}
                className='shrink-0'
              >
                <SteelIcon icon={UserAdd01Icon} strokeWidth={2} />
              </Button>
            </div>
          </div>

          <div className='grid gap-1.5'>
            <Label className='text-muted-foreground text-xs'>
              Membros ({members.length})
            </Label>
            {isLoading ? null : members.length === 0 ? (
              <div className='rounded-lg border border-dashed border-border p-6 text-center text-muted-foreground text-xs'>
                Nenhum membro ainda. Adicione emails acima.
              </div>
            ) : (
              <ul className='max-h-96 divide-y divide-border overflow-auto rounded-lg border border-border'>
                {members.map((m) => (
                  <li key={m.id} className='flex items-center gap-3 px-3 py-2'>
                    <div className='min-w-0 flex-1'>
                      {m.name ? (
                        <div className='truncate font-medium text-sm'>
                          {m.name}
                        </div>
                      ) : null}
                      <div className='truncate text-muted-foreground text-xs'>
                        {m.email}
                      </div>
                    </div>
                    <Button
                      variant='ghost'
                      size='icon-sm'
                      onClick={() => handleRemoveMember(m.id)}
                      aria-label='Remover'
                      className='shrink-0 text-muted-foreground hover:text-destructive'
                    >
                      <SteelIcon icon={Cancel01Icon} strokeWidth={2} />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      <div className='flex shrink-0 items-center justify-between gap-2 border-t p-3'>
        <Button
          variant='ghost'
          size='sm'
          onClick={handleDeleteList}
          disabled={deleteList.isPending}
          className='text-muted-foreground hover:text-destructive'
        >
          <SteelIcon
            icon={Delete02Icon}
            strokeWidth={2}
            className='mr-1.5 size-4'
          />
          {deleteList.isPending ? 'Removendo…' : 'Remover lista'}
        </Button>
        <Button variant='ghost' onClick={onClose}>
          Fechar
        </Button>
      </div>
    </>
  )
}
