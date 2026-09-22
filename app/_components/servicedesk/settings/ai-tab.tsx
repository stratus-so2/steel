'use client'

import { Cancel01Icon } from '@hugeicons-pro/core-stroke-rounded'
import { useEffect, useState } from 'react'
import { SteelIcon } from '@/components/icon/icon'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { notify } from '@/lib/notify'
import { useSdSettings, useUpdateSdSettings } from '@/src/hooks/use-sd-config'
import type { SdSettingsDTO } from '@/types/sd-config'
import {
  FieldBlock,
  SettingsSection,
  ToggleRow,
  useSdSettingsContext,
} from './sd-settings-kit'

type AiDraft = Pick<
  SdSettingsDTO,
  | 'aiEnabled'
  | 'aiPreServiceEnabled'
  | 'aiAutoTriageEnabled'
  | 'aiWhatsappAutoReply'
  | 'aiPersona'
  | 'aiInstructions'
  | 'aiHandoffKeywords'
>

function toDraft(settings: SdSettingsDTO): AiDraft {
  return {
    aiEnabled: settings.aiEnabled,
    aiPreServiceEnabled: settings.aiPreServiceEnabled,
    aiAutoTriageEnabled: settings.aiAutoTriageEnabled,
    aiWhatsappAutoReply: settings.aiWhatsappAutoReply,
    aiPersona: settings.aiPersona,
    aiInstructions: settings.aiInstructions,
    aiHandoffKeywords: settings.aiHandoffKeywords,
  }
}

export function SdAiTab() {
  const { workspaceId, canEdit } = useSdSettingsContext()
  const settings = useSdSettings(workspaceId)
  const update = useUpdateSdSettings(workspaceId)
  const [draft, setDraft] = useState<AiDraft | null>(null)
  const [keyword, setKeyword] = useState('')

  useEffect(() => {
    if (settings.data) setDraft(toDraft(settings.data))
  }, [settings.data])

  if (!draft || !settings.data) return <Skeleton className='h-96 w-full' />

  const original = toDraft(settings.data)
  const dirty = JSON.stringify(original) !== JSON.stringify(draft)
  const set = <K extends keyof AiDraft>(key: K, value: AiDraft[K]) =>
    setDraft((current) => (current ? { ...current, [key]: value } : current))
  const off = !canEdit || !draft.aiEnabled

  function addKeyword() {
    const value = keyword.trim().toLowerCase()
    if (!value || !draft || draft.aiHandoffKeywords.includes(value)) {
      setKeyword('')
      return
    }
    set('aiHandoffKeywords', [...draft.aiHandoffKeywords, value])
    setKeyword('')
  }

  async function save() {
    if (!draft) return
    try {
      await update.mutateAsync({
        ...draft,
        aiPersona: draft.aiPersona?.trim() || null,
        aiInstructions: draft.aiInstructions?.trim() || null,
      })
      notify.success('Configurações de IA salvas')
    } catch (err) {
      notify.error(err)
    }
  }

  return (
    <div className='flex flex-col gap-5'>
      <SettingsSection
        title='Agente de IA do ServiceDesk'
        description='Usa o provedor e a cota de IA do workspace (Ajustes > Steel IA).'
      >
        <ToggleRow
          label='IA habilitada'
          description='Liga o copiloto do agente e os recursos abaixo.'
          checked={draft.aiEnabled}
          onCheckedChange={(value) => set('aiEnabled', value)}
          disabled={!canEdit}
        />
        <div className='flex flex-col divide-y divide-border rounded-lg border border-border px-3'>
          <ToggleRow
            label='Pré-atendimento'
            description='A IA conversa com o solicitante (portal/WhatsApp) antes de abrir o chamado, sugere artigos da base e faz a triagem.'
            checked={draft.aiPreServiceEnabled}
            onCheckedChange={(value) => set('aiPreServiceEnabled', value)}
            disabled={off}
          />
          <ToggleRow
            label='Triagem automática'
            description='Sugere categoria, prioridade e departamento na abertura.'
            checked={draft.aiAutoTriageEnabled}
            onCheckedChange={(value) => set('aiAutoTriageEnabled', value)}
            disabled={off}
          />
          <ToggleRow
            label='Resposta automática no WhatsApp'
            description='Responde enquanto nenhum atendente assumiu a conversa.'
            checked={draft.aiWhatsappAutoReply}
            onCheckedChange={(value) => set('aiWhatsappAutoReply', value)}
            disabled={off}
          />
        </div>
      </SettingsSection>

      <SettingsSection
        title='Persona e instruções'
        description='Como o agente se apresenta e o que deve (ou não) fazer.'
      >
        <FieldBlock
          label='Persona'
          hint='Ex.: "Sou a Ana, assistente do suporte da Acme."'
        >
          <Textarea
            value={draft.aiPersona ?? ''}
            onChange={(e) => set('aiPersona', e.target.value)}
            rows={3}
            maxLength={2000}
            disabled={off}
          />
        </FieldBlock>
        <FieldBlock
          label='Instruções'
          hint='Tom, limites, quando pedir dados do solicitante, o que nunca prometer...'
        >
          <Textarea
            value={draft.aiInstructions ?? ''}
            onChange={(e) => set('aiInstructions', e.target.value)}
            rows={8}
            maxLength={10000}
            disabled={off}
          />
        </FieldBlock>
        <FieldBlock
          label='Palavras de transbordo para humano'
          hint='Se o solicitante usar uma delas, a IA passa a conversa para um agente.'
        >
          <div className='flex flex-wrap items-center gap-1.5'>
            {draft.aiHandoffKeywords.map((word) => (
              <Badge key={word} variant='secondary' className='gap-1'>
                {word}
                {!off ? (
                  <button
                    type='button'
                    aria-label={`Remover ${word}`}
                    onClick={() =>
                      set(
                        'aiHandoffKeywords',
                        draft.aiHandoffKeywords.filter((w) => w !== word),
                      )
                    }
                  >
                    <SteelIcon icon={Cancel01Icon} size={12} strokeWidth={2} />
                  </button>
                ) : null}
              </Badge>
            ))}
            {!off ? (
              <Input
                value={keyword}
                placeholder='atendente, humano...'
                onChange={(e) => setKeyword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ',') {
                    e.preventDefault()
                    addKeyword()
                  }
                }}
                onBlur={addKeyword}
                className='h-7 w-44'
                maxLength={60}
              />
            ) : null}
          </div>
        </FieldBlock>
      </SettingsSection>

      {canEdit ? (
        <div className='flex justify-end gap-2'>
          <Button
            variant='outline'
            size='sm'
            disabled={!dirty || update.isPending}
            onClick={() => setDraft(original)}
          >
            Descartar
          </Button>
          <Button
            size='sm'
            disabled={!dirty || update.isPending}
            onClick={save}
          >
            {update.isPending ? 'Salvando...' : 'Salvar'}
          </Button>
        </div>
      ) : null}
    </div>
  )
}
