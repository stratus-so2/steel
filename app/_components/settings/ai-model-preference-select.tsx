'use client'

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { notify } from '@/lib/notify'
import { cn } from '@/lib/utils'
import { useSetAiPreference } from '@/src/hooks/use-ai-settings'
import type { WorkspaceAiSettingsDTO } from '@/types/ai-settings'

const WORKSPACE_DEFAULT = '__workspace_default__'

/**
 * Seletor do modelo pessoal do usuário (assistente do CRM). Só lista os
 * modelos habilitados no workspace cujo provedor está disponível — o
 * backend valida de novo (`AI_MODEL_NOT_ENABLED`).
 */
export function AiModelPreferenceSelect({
  workspaceId,
  settings,
  size = 'default',
  className,
}: {
  workspaceId: string
  settings: WorkspaceAiSettingsDTO
  size?: 'sm' | 'default'
  className?: string
}) {
  const setPreference = useSetAiPreference(workspaceId)
  const options = settings.models.filter((m) => m.enabled && m.available)
  const labelOf = (key: string) =>
    settings.models.find((m) => m.key === key)?.label ?? key
  const defaultLabel = `Padrão do workspace (${labelOf(settings.crmAssistantModel)})`
  const current =
    settings.userPreference &&
    options.some((m) => m.key === settings.userPreference)
      ? settings.userPreference
      : WORKSPACE_DEFAULT

  function handleChange(value: unknown) {
    if (typeof value !== 'string' || value === current) return
    setPreference.mutate(value === WORKSPACE_DEFAULT ? null : value, {
      onSuccess: () => notify.success('Modelo de IA atualizado'),
      onError: (error) =>
        notify.error(error, 'Não foi possível trocar o modelo'),
    })
  }

  return (
    <Select
      value={current}
      onValueChange={handleChange}
      disabled={setPreference.isPending}
    >
      <SelectTrigger
        size={size}
        aria-label='Modelo de IA'
        className={cn('min-w-0', className)}
      >
        <SelectValue>
          {(value: string) =>
            value === WORKSPACE_DEFAULT ? defaultLabel : labelOf(value)
          }
        </SelectValue>
      </SelectTrigger>
      <SelectContent alignItemWithTrigger={false}>
        <SelectGroup>
          <SelectItem value={WORKSPACE_DEFAULT}>{defaultLabel}</SelectItem>
          {options.map((m) => (
            <SelectItem key={m.key} value={m.key}>
              {m.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}
