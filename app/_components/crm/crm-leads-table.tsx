'use client'

import { PlusSignIcon } from '@hugeicons-pro/core-stroke-rounded'
import { useMemo, useState } from 'react'
import { DataTable } from '@/app/_components/crm/table/data-table'
import type { GridColumn } from '@/app/_components/crm/table/grid'
import { SteelIcon } from '@/components/icon/icon'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { notify } from '@/lib/notify'
import { useConvertCrmLead } from '@/src/hooks/use-crm-lead'
import {
  createCrmResource,
  useCrmResourceList,
} from '@/src/hooks/use-crm-resource-list'
import {
  type LookupKind,
  useCrmWorkspaceLookups,
} from '@/src/hooks/use-crm-workspace-lookups'
import type { CrmLeadDTO, CrmLeadStageDTO } from '@/types/crm-lead'

const LOOKUP_KINDS: LookupKind[] = ['users', 'companies']

/** As 6 etapas fixas do painel de leads — ver CrmLeadService para as regras
 * de avanço (gates) entre cada uma. */
export const LEAD_STAGES: CrmLeadStageDTO[] = [
  'RECEIVED',
  'IN_CONTACT',
  'QUALIFIED',
  'OPPORTUNITY',
  'PROPOSAL',
  'CLOSED',
]

export const STAGE_STYLES: Record<CrmLeadStageDTO, string> = {
  RECEIVED: 'bg-blue-500/15 text-blue-600',
  IN_CONTACT: 'bg-amber-500/15 text-amber-600',
  QUALIFIED: 'bg-emerald-500/15 text-emerald-600',
  OPPORTUNITY: 'bg-violet-500/15 text-violet-600',
  PROPOSAL: 'bg-orange-500/15 text-orange-600',
  CLOSED: 'bg-rose-500/15 text-rose-600',
}

export const STAGE_LABELS: Record<CrmLeadStageDTO, string> = {
  RECEIVED: 'Lead recebido',
  IN_CONTACT: 'Em contato',
  QUALIFIED: 'Lead qualificado',
  OPPORTUNITY: 'Interesse/Oportunidade',
  PROPOSAL: 'Proposta',
  CLOSED: 'Fechado/Encerrado',
}

/** Canal de entrada: categoria fixa, separada de `source` (texto livre para
 * detalhe/campanha específica dentro do canal). */
const CHANNEL_OPTIONS = [
  { value: 'WHATSAPP', label: 'WhatsApp' },
  { value: 'INSTAGRAM', label: 'Instagram' },
  { value: 'FACEBOOK', label: 'Facebook' },
  { value: 'SITE', label: 'Site' },
  { value: 'FORM', label: 'Formulário' },
  { value: 'INDICACAO', label: 'Indicação' },
  { value: 'EVENTO', label: 'Evento' },
  { value: 'OUTRO', label: 'Outro' },
]

const CHANNEL_STYLES: Record<string, string> = {
  WHATSAPP: 'bg-emerald-500/15 text-emerald-600',
  INSTAGRAM: 'bg-fuchsia-500/15 text-fuchsia-600',
  FACEBOOK: 'bg-blue-500/15 text-blue-600',
  SITE: 'bg-slate-500/15 text-slate-600',
  FORM: 'bg-violet-500/15 text-violet-600',
  INDICACAO: 'bg-amber-500/15 text-amber-600',
  EVENTO: 'bg-rose-500/15 text-rose-600',
  OUTRO: 'bg-muted text-muted-foreground',
}

const COLUMNS: GridColumn[] = [
  {
    key: 'name',
    header: 'Nome',
    kind: 'text',
    required: true,
    primary: true,
    placeholder: 'Maria Silva',
  },
  {
    key: 'emails',
    header: 'E-mails',
    kind: 'tags',
    placeholder: 'maria@x.com',
  },
  { key: 'phones', header: 'Telefones', kind: 'tags' },
  {
    key: 'company',
    header: 'Empresa',
    kind: 'company-name-picker',
    placeholder: 'Selecionar empresa',
  },
  { key: 'jobTitle', header: 'Cargo', kind: 'text' },
  { key: 'source', header: 'Origem', kind: 'text', placeholder: 'WhatsApp' },
  {
    key: 'channel',
    header: 'Canal de entrada',
    kind: 'select',
    options: CHANNEL_OPTIONS,
    optionStyles: CHANNEL_STYLES,
  },
  {
    key: 'stage',
    header: 'Etapa',
    kind: 'select',
    defaultValue: 'RECEIVED',
    readonly: true,
    options: LEAD_STAGES.map((s) => ({ value: s, label: STAGE_LABELS[s] })),
    optionStyles: STAGE_STYLES,
  },
  { key: 'score', header: 'Score', kind: 'number', readonly: true },
  {
    key: 'ownerId',
    header: 'Responsável',
    kind: 'relation',
    relationKind: 'users',
    clearable: true,
  },
  { key: 'createdAt', header: 'Criado em', kind: 'readonly-date' },
]

export function CrmLeadsTable({
  workspaceId,
  slug,
}: {
  workspaceId: string
  slug: string
}) {
  const { items, isLoading, refetch } = useCrmResourceList<CrmLeadDTO>(
    workspaceId,
    'leads',
  )
  const { lookups } = useCrmWorkspaceLookups(workspaceId, LOOKUP_KINDS)
  const [createOpen, setCreateOpen] = useState(false)

  const columns = useMemo(() => COLUMNS, [])

  return (
    <DataTable
      columns={columns}
      data={items}
      workspaceId={workspaceId}
      slug={slug}
      resource='leads'
      createTitle='lead'
      lookups={lookups}
      isLoading={isLoading}
      searchPlaceholder='Buscar leads…'
      refetch={refetch}
      disableInlineCreate
      headerAction={
        <>
          <Button size='sm' onClick={() => setCreateOpen(true)}>
            <SteelIcon icon={PlusSignIcon} strokeWidth={2} />
            Novo lead
          </Button>
          <CreateLeadDialog
            workspaceId={workspaceId}
            open={createOpen}
            onClose={() => setCreateOpen(false)}
            onCreated={() => {
              setCreateOpen(false)
              refetch()
            }}
          />
        </>
      }
      kanban={{
        groupByKey: 'stage',
        columns: LEAD_STAGES.map((s) => ({
          value: s,
          label: STAGE_LABELS[s],
          className: STAGE_STYLES[s],
        })),
        renderCard: (record) => (
          <div className='flex flex-col gap-1'>
            <span className='truncate font-medium'>{record.name}</span>
            {record.company ? (
              <span className='truncate text-muted-foreground text-xs'>
                {record.company}
              </span>
            ) : null}
            {record.emails[0] ? (
              <span className='truncate text-muted-foreground text-xs'>
                {record.emails[0]}
              </span>
            ) : null}
          </div>
        ),
      }}
      renderRecordExtra={(record) => (
        <LeadConvert
          workspaceId={workspaceId}
          leadId={record.id}
          convertedPersonId={record.convertedPersonId}
          onConverted={refetch}
        />
      )}
    />
  )
}

/**
 * Substitui a criação em branco (padrão da grade genérica) porque o Lead tem
 * campos obrigatórios que a linha vazia não consegue satisfazer sozinha:
 * nome, (email OU telefone) e origem — travado no schema do backend
 * (`CreateCrmLeadSchema`). Esse form coleta tudo antes de criar.
 */
function CreateLeadDialog({
  workspaceId,
  open,
  onClose,
  onCreated,
}: {
  workspaceId: string
  open: boolean
  onClose: () => void
  onCreated: () => void
}) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [source, setSource] = useState('')
  const [channel, setChannel] = useState('')
  const [submitting, setSubmitting] = useState(false)

  function reset() {
    setName('')
    setEmail('')
    setPhone('')
    setSource('')
    setChannel('')
  }

  async function handleSubmit() {
    if (!name.trim()) {
      notify.error('Informe o nome')
      return
    }
    if (!email.trim() && !phone.trim()) {
      notify.error('Informe ao menos um email ou telefone')
      return
    }
    if (!source.trim()) {
      notify.error('Informe a origem')
      return
    }

    setSubmitting(true)
    try {
      const result = await createCrmResource<CrmLeadDTO>(workspaceId, 'leads', {
        name: name.trim(),
        emails: email.trim() ? [email.trim()] : [],
        phones: phone.trim() ? [phone.trim()] : [],
        source: source.trim(),
        channel: channel || undefined,
      })
      if (!result.ok) {
        notify.error(result.message ?? 'Não foi possível criar o lead.')
        return
      }
      notify.success('Lead criado')
      reset()
      onCreated()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          reset()
          onClose()
        }
      }}
    >
      <DialogContent className='w-full sm:max-w-md'>
        <DialogTitle>Novo lead</DialogTitle>
        <div className='flex flex-col gap-4'>
          <div className='grid gap-1.5'>
            <Label className='text-muted-foreground text-xs'>Nome *</Label>
            <Input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder='Maria Silva'
            />
          </div>
          <div className='grid grid-cols-2 gap-3'>
            <div className='grid gap-1.5'>
              <Label className='text-muted-foreground text-xs'>Email</Label>
              <Input
                type='email'
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder='maria@x.com'
              />
            </div>
            <div className='grid gap-1.5'>
              <Label className='text-muted-foreground text-xs'>Telefone</Label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder='(11) 99999-9999'
              />
            </div>
          </div>
          <p className='-mt-2 text-muted-foreground text-xs'>
            Pelo menos um dos dois é obrigatório.
          </p>
          <div className='grid gap-1.5'>
            <Label className='text-muted-foreground text-xs'>Origem *</Label>
            <Input
              value={source}
              onChange={(e) => setSource(e.target.value)}
              placeholder='WhatsApp'
            />
          </div>
          <div className='grid gap-1.5'>
            <Label className='text-muted-foreground text-xs'>
              Canal de entrada
            </Label>
            <Select
              value={channel || undefined}
              onValueChange={(v) => setChannel(v ?? '')}
            >
              <SelectTrigger className='w-full'>
                <SelectValue placeholder='Selecionar (opcional)' />
              </SelectTrigger>
              <SelectContent>
                {CHANNEL_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className='flex justify-end gap-2'>
          <Button variant='ghost' onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Criando…' : 'Criar lead'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function LeadConvert({
  workspaceId,
  leadId,
  convertedPersonId,
  onConverted,
}: {
  workspaceId: string
  leadId: string
  convertedPersonId: string | null
  onConverted: () => void
}) {
  const convertLead = useConvertCrmLead(workspaceId)

  async function handleConvert() {
    try {
      await convertLead.mutateAsync(leadId)
      notify.success('Lead convertido em pessoa')
      onConverted()
    } catch (err) {
      notify.error(err)
    }
  }

  if (convertedPersonId) {
    return (
      <p className='text-muted-foreground text-sm'>
        Este lead já foi convertido.
      </p>
    )
  }

  return (
    <Button
      size='sm'
      className='w-full'
      disabled={convertLead.isPending}
      onClick={handleConvert}
    >
      {convertLead.isPending ? 'Convertendo…' : 'Converter em pessoa'}
    </Button>
  )
}
