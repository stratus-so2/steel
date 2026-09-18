'use client'

import { useState } from 'react'
import { Muted } from '@/components/typography/text/muted'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select'
import { notify } from '@/lib/notify'
import {
  useAdminWorkspaceFeatures,
  useSetWorkspaceFeatureOverride,
} from '@/src/hooks/use-feature-flags'
import type { WorkspaceFeatureDTO } from '@/types/feature-flag'
import type { ModuleKind } from '@/types/workspace-connection'

const MODULE_LABEL: Record<ModuleKind, string> = {
  SERVICE_DESK: 'Service Desk',
  CRM: 'CRM',
  COMMUNICATION: 'WhatsApp',
}

type Mode = 'default' | 'on' | 'off'

const MODE_LABEL: Record<Mode, string> = {
  default: 'Padrão do plano',
  on: 'Ligado (override)',
  off: 'Desligado (override)',
}

function modeOf(feature: WorkspaceFeatureDTO): Mode {
  if (!feature.override) return 'default'
  return feature.override.enabled ? 'on' : 'off'
}

/** `YYYY-MM-DD` local do ISO salvo (para o `<input type="date">`). */
function toDateInput(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Fim do dia local escolhido → ISO (o override vale durante todo o dia). */
function fromDateInput(value: string): string | null {
  if (!value) return null
  const [y, m, d] = value.split('-').map(Number)
  return new Date(y, m - 1, d, 23, 59, 59).toISOString()
}

function FeatureRow({
  workspaceId,
  feature,
}: {
  workspaceId: string
  feature: WorkspaceFeatureDTO
}) {
  const setOverride = useSetWorkspaceFeatureOverride(workspaceId)
  const [mode, setMode] = useState<Mode>(modeOf(feature))
  const [note, setNote] = useState(feature.override?.note ?? '')
  const [expiresOn, setExpiresOn] = useState(
    toDateInput(feature.override?.expiresAt ?? null),
  )

  const dirty =
    mode !== modeOf(feature) ||
    (mode !== 'default' &&
      (note !== (feature.override?.note ?? '') ||
        expiresOn !== toDateInput(feature.override?.expiresAt ?? null)))

  async function handleSave() {
    try {
      await setOverride.mutateAsync({
        key: feature.key,
        enabled: mode === 'default' ? null : mode === 'on',
        note: mode === 'default' ? null : note,
        expiresAt: mode === 'default' ? null : fromDateInput(expiresOn),
      })
      notify.success('Funcionalidade atualizada')
    } catch (error) {
      notify.error(error)
    }
  }

  return (
    <div className='space-y-3 rounded-md border p-3'>
      <div className='flex flex-wrap items-start justify-between gap-2'>
        <div className='min-w-0 space-y-0.5'>
          <div className='flex flex-wrap items-center gap-1.5'>
            <p className='font-medium text-sm'>{feature.label}</p>
            <Badge variant='secondary'>{MODULE_LABEL[feature.module]}</Badge>
            <Badge variant={feature.enabled ? 'default' : 'destructive'}>
              {feature.enabled ? 'Ativa' : 'Inativa'}
            </Badge>
          </div>
          <p className='text-muted-foreground text-xs'>{feature.description}</p>
          <p className='text-muted-foreground text-xs'>
            Padrão do plano: {feature.planDefault ? 'ligado' : 'desligado'}
            {feature.override?.expired ? ' · override expirado' : ''}
          </p>
        </div>
        <Select value={mode} onValueChange={(value) => setMode(value as Mode)}>
          <SelectTrigger size='sm' className='w-48'>
            <span className='truncate'>{MODE_LABEL[mode]}</span>
          </SelectTrigger>
          <SelectContent alignItemWithTrigger={false}>
            {(Object.keys(MODE_LABEL) as Mode[]).map((value) => (
              <SelectItem key={value} value={value}>
                {MODE_LABEL[value]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {mode !== 'default' && (
        <div className='grid gap-2 sm:grid-cols-[1fr_auto]'>
          <Input
            placeholder='Nota (ex.: contrato 2026, cliente piloto)'
            value={note}
            maxLength={500}
            onChange={(e) => setNote(e.target.value)}
          />
          <Input
            type='date'
            aria-label='Válido até'
            title='Válido até (opcional)'
            value={expiresOn}
            onChange={(e) => setExpiresOn(e.target.value)}
          />
        </div>
      )}

      {dirty && (
        <div className='flex justify-end'>
          <Button
            size='sm'
            onClick={handleSave}
            disabled={setOverride.isPending}
          >
            {setOverride.isPending ? 'Salvando...' : 'Salvar'}
          </Button>
        </div>
      )}
    </div>
  )
}

export function AdminFeatureFlagsPanel({
  workspaceId,
}: {
  workspaceId: string
}) {
  const { data: features, isLoading } = useAdminWorkspaceFeatures(workspaceId)

  if (isLoading || !features) {
    return <Muted>Carregando funcionalidades...</Muted>
  }

  return (
    <div className='space-y-2'>
      {features.map((feature) => (
        <FeatureRow
          // Remonta a linha quando o servidor devolve um estado novo, para o
          // formulário refletir o que foi salvo.
          key={`${feature.key}:${feature.override?.updatedAt ?? 'default'}`}
          workspaceId={workspaceId}
          feature={feature}
        />
      ))}
    </div>
  )
}
