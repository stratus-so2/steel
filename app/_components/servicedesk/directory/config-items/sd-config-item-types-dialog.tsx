'use client'

import {
  Delete02Icon,
  PencilEdit02Icon,
  PlusSignIcon,
} from '@hugeicons-pro/core-stroke-rounded'
import { useState } from 'react'
import { SdConfirmDelete } from '@/app/_components/servicedesk/directory/shared/sd-directory-widgets'
import { SdField } from '@/app/_components/servicedesk/directory/shared/sd-form-bits'
import { blankToNull } from '@/app/_components/servicedesk/directory/shared/sd-masks'
import { SteelIcon } from '@/components/icon/icon'
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
import { Switch } from '@/components/ui/switch'
import { notify } from '@/lib/notify'
import {
  useCreateSdConfigItemType,
  useDeleteSdConfigItemType,
  useSdConfigItemTypes,
  useUpdateSdConfigItemType,
} from '@/src/hooks/use-sd-config-items'
import type {
  SdCiAttributeDefinitionDTO,
  SdCiAttributeTypeDTO,
  SdConfigItemTypeDTO,
} from '@/types/sd-config-item'

const ATTRIBUTE_TYPE_LABEL: Record<SdCiAttributeTypeDTO, string> = {
  text: 'Texto',
  number: 'Número',
  date: 'Data',
  select: 'Seleção',
  boolean: 'Sim/não',
}

interface AttributeDraft {
  uid: number
  key: string
  label: string
  type: SdCiAttributeTypeDTO
  options: string
  required: boolean
}

let uidSeq = 0

/** Chave técnica a partir do rótulo: "Memória RAM" → "memoria_ram". */
function slugKey(label: string): string {
  const key = label
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 50)
  return /^[a-z]/.test(key) ? key : `attr_${key}`.slice(0, 50)
}

function toDrafts(schema: SdCiAttributeDefinitionDTO[]): AttributeDraft[] {
  return schema.map((def) => ({
    uid: ++uidSeq,
    key: def.key,
    label: def.label,
    type: def.type,
    options: (def.options ?? []).join(', '),
    required: Boolean(def.required),
  }))
}

function toSchema(drafts: AttributeDraft[]): SdCiAttributeDefinitionDTO[] {
  return drafts
    .filter((d) => d.label.trim())
    .map((d) => ({
      key: d.key || slugKey(d.label),
      label: d.label.trim(),
      type: d.type,
      ...(d.type === 'select'
        ? {
            options: d.options
              .split(',')
              .map((o) => o.trim())
              .filter(Boolean),
          }
        : {}),
      ...(d.required ? { required: true } : {}),
    }))
}

function TypeEditor({
  workspaceId,
  type,
  onDone,
}: {
  workspaceId: string
  type: SdConfigItemTypeDTO | null
  onDone: () => void
}) {
  const create = useCreateSdConfigItemType(workspaceId)
  const update = useUpdateSdConfigItemType(workspaceId)
  const [name, setName] = useState(type?.name ?? '')
  const [color, setColor] = useState(type?.color ?? '#2563eb')
  const [drafts, setDrafts] = useState<AttributeDraft[]>(() =>
    toDrafts(type?.attributeSchema ?? []),
  )
  const busy = create.isPending || update.isPending

  function patch(uid: number, changes: Partial<AttributeDraft>) {
    setDrafts((current) =>
      current.map((d) => (d.uid === uid ? { ...d, ...changes } : d)),
    )
  }

  function save() {
    if (!name.trim()) {
      notify.error('Informe o nome do tipo.')
      return
    }
    const attributeSchema = toSchema(drafts)
    const payload = {
      name: name.trim(),
      color: blankToNull(color),
      attributeSchema,
    }
    const done = {
      onSuccess: () => {
        notify.success(type ? 'Tipo atualizado.' : 'Tipo criado.')
        onDone()
      },
      onError: notify.error,
    }
    if (type) update.mutate({ id: type.id, data: payload }, done)
    else create.mutate(payload, done)
  }

  return (
    <div className='flex flex-col gap-4'>
      <div className='grid grid-cols-[1fr_7rem] gap-3'>
        <SdField label='Nome' htmlFor='sd-ci-type-name'>
          <Input
            id='sd-ci-type-name'
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder='Ex.: Servidor, Notebook, Link, Licença'
            autoFocus
          />
        </SdField>
        <SdField label='Cor' htmlFor='sd-ci-type-color'>
          <Input
            id='sd-ci-type-color'
            type='color'
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className='h-9 p-1'
          />
        </SdField>
      </div>

      <div className='flex flex-col gap-2'>
        <div className='flex items-center justify-between'>
          <h4 className='font-semibold text-sm'>Atributos</h4>
          <Button
            size='xs'
            variant='outline'
            onClick={() =>
              setDrafts((current) => [
                ...current,
                {
                  uid: ++uidSeq,
                  key: '',
                  label: '',
                  type: 'text',
                  options: '',
                  required: false,
                },
              ])
            }
          >
            <SteelIcon icon={PlusSignIcon} strokeWidth={2} />
            Atributo
          </Button>
        </div>
        {drafts.length === 0 ? (
          <p className='rounded-lg border border-dashed py-6 text-center text-muted-foreground text-sm'>
            Sem atributos: os itens deste tipo usam só os campos padrão.
          </p>
        ) : (
          <ul className='flex flex-col gap-2'>
            {drafts.map((d) => (
              <li
                key={d.uid}
                className='grid grid-cols-[1fr_8rem_auto_auto] items-center gap-2 rounded-lg border p-2'
              >
                <Input
                  value={d.label}
                  onChange={(e) => patch(d.uid, { label: e.target.value })}
                  placeholder='Rótulo (ex.: Memória RAM)'
                  aria-label='Rótulo do atributo'
                />
                <Select
                  value={d.type}
                  onValueChange={(v) =>
                    patch(d.uid, { type: v as SdCiAttributeTypeDTO })
                  }
                >
                  <SelectTrigger className='w-full'>
                    <span>{ATTRIBUTE_TYPE_LABEL[d.type]}</span>
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(ATTRIBUTE_TYPE_LABEL).map(([v, label]) => (
                      <SelectItem key={v} value={v}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {/* biome-ignore lint/a11y/noLabelWithoutControl: o Switch é o controle envolvido */}
                <label className='flex items-center gap-1.5 text-xs'>
                  <Switch
                    checked={d.required}
                    onCheckedChange={(checked) =>
                      patch(d.uid, { required: Boolean(checked) })
                    }
                  />
                  Obrigatório
                </label>
                <Button
                  variant='ghost'
                  size='icon-sm'
                  aria-label='Remover atributo'
                  onClick={() =>
                    setDrafts((current) =>
                      current.filter((x) => x.uid !== d.uid),
                    )
                  }
                >
                  <SteelIcon
                    icon={Delete02Icon}
                    strokeWidth={2}
                    className='text-destructive'
                  />
                </Button>
                {d.type === 'select' ? (
                  <Input
                    className='col-span-4'
                    value={d.options}
                    onChange={(e) => patch(d.uid, { options: e.target.value })}
                    placeholder='Opções separadas por vírgula (ex.: Linux, Windows)'
                    aria-label='Opções'
                  />
                ) : null}
                <p className='col-span-4 font-mono text-[11px] text-muted-foreground'>
                  chave: {d.key || slugKey(d.label || 'novo')}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <DialogFooter>
        <Button variant='outline' onClick={onDone}>
          Voltar
        </Button>
        <Button onClick={save} disabled={busy}>
          {busy ? 'Salvando…' : 'Salvar tipo'}
        </Button>
      </DialogFooter>
    </div>
  )
}

/** Gestão dos tipos de CI (admins do ServiceDesk). */
export function SdConfigItemTypesDialog({
  workspaceId,
  open,
  onOpenChange,
}: {
  workspaceId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { data: types = [], isLoading } = useSdConfigItemTypes(workspaceId)
  const remove = useDeleteSdConfigItemType(workspaceId)
  const [editing, setEditing] = useState<SdConfigItemTypeDTO | 'new' | null>(
    null,
  )
  const [deleting, setDeleting] = useState<SdConfigItemTypeDTO | null>(null)

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next)
        if (!next) setEditing(null)
      }}
    >
      <DialogContent className='max-h-[85vh] overflow-y-auto sm:max-w-2xl'>
        <DialogHeader>
          <DialogTitle>
            {editing === 'new'
              ? 'Novo tipo de item'
              : editing
                ? `Tipo: ${editing.name}`
                : 'Tipos de item de configuração'}
          </DialogTitle>
          <DialogDescription>
            Cada tipo define os atributos específicos dos seus itens (ex.:
            hostname e SO para servidores). Apenas administradores do
            ServiceDesk podem alterar.
          </DialogDescription>
        </DialogHeader>

        {editing ? (
          <TypeEditor
            key={editing === 'new' ? 'new' : editing.id}
            workspaceId={workspaceId}
            type={editing === 'new' ? null : editing}
            onDone={() => setEditing(null)}
          />
        ) : (
          <div className='flex flex-col gap-3'>
            {isLoading ? null : types.length === 0 ? (
              <p className='rounded-lg border border-dashed py-8 text-center text-muted-foreground text-sm'>
                Nenhum tipo cadastrado.
              </p>
            ) : (
              <ul className='divide-y rounded-lg border'>
                {types.map((t) => (
                  <li
                    key={t.id}
                    className='flex items-center gap-3 px-3 py-2.5 text-sm'
                  >
                    <span
                      className='size-3 shrink-0 rounded-full border'
                      style={{ backgroundColor: t.color ?? 'transparent' }}
                    />
                    <div className='min-w-0 flex-1'>
                      <p className='font-medium'>{t.name}</p>
                      <p className='truncate text-muted-foreground text-xs'>
                        {t.attributeSchema.length === 0
                          ? 'Sem atributos'
                          : t.attributeSchema.map((a) => a.label).join(', ')}
                      </p>
                    </div>
                    <span className='text-muted-foreground text-xs tabular-nums'>
                      {t.itemsCount} {t.itemsCount === 1 ? 'item' : 'itens'}
                    </span>
                    <Button
                      variant='ghost'
                      size='icon-sm'
                      aria-label={`Editar ${t.name}`}
                      onClick={() => setEditing(t)}
                    >
                      <SteelIcon icon={PencilEdit02Icon} strokeWidth={2} />
                    </Button>
                    <Button
                      variant='ghost'
                      size='icon-sm'
                      aria-label={`Excluir ${t.name}`}
                      onClick={() => setDeleting(t)}
                    >
                      <SteelIcon
                        icon={Delete02Icon}
                        strokeWidth={2}
                        className='text-destructive'
                      />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            <Button className='self-start' onClick={() => setEditing('new')}>
              <SteelIcon icon={PlusSignIcon} strokeWidth={2} />
              Novo tipo
            </Button>
          </div>
        )}

        <SdConfirmDelete
          open={Boolean(deleting)}
          onOpenChange={(next) => {
            if (!next) setDeleting(null)
          }}
          title={`Excluir o tipo "${deleting?.name ?? ''}"?`}
          description='Os itens deste tipo continuam cadastrados, mas ficam sem tipo.'
          onConfirm={async () => {
            if (!deleting) return
            try {
              await remove.mutateAsync(deleting.id)
              notify.success('Tipo excluído.')
            } catch (error) {
              notify.error(error, 'Não foi possível excluir.')
            }
          }}
        />
      </DialogContent>
    </Dialog>
  )
}
