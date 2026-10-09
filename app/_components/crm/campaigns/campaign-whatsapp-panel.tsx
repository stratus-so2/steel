'use client'

import { WhatsappIcon } from '@hugeicons-pro/core-stroke-rounded'
import { SteelIcon } from '@/components/icon/icon'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import type {
  CrmCampaignOptionsDTO,
  CrmCampaignVariableSourceDTO,
  CrmCampaignVariableSourceKind,
  CrmCampaignWhatsAppTemplateOptionDTO,
  CrmCampaignWhatsAppVariablesDTO,
} from '@/types/crm-campaign'
import type { CampaignDraft, DraftChange } from './campaign-draft'
import { VARIABLE_SOURCE_LABEL } from './campaign-labels'

const EMPTY_VARIABLES: CrmCampaignWhatsAppVariablesDTO = {
  header: {},
  body: {},
  buttons: {},
}

type VariableGroup = keyof CrmCampaignWhatsAppVariablesDTO

function variableSlots(template: CrmCampaignWhatsAppTemplateOptionDTO) {
  const slots: { group: VariableGroup; key: string; label: string }[] = []
  for (let i = 1; i <= template.fields.headerVariables; i += 1) {
    slots.push({ group: 'header', key: String(i), label: `Cabeçalho {{${i}}}` })
  }
  for (let i = 1; i <= template.fields.bodyVariables; i += 1) {
    slots.push({ group: 'body', key: String(i), label: `Mensagem {{${i}}}` })
  }
  for (const index of template.fields.urlButtons) {
    slots.push({
      group: 'buttons',
      key: String(index),
      label: `Botão ${index + 1} (fim da URL)`,
    })
  }
  return slots
}

const SOURCE_ITEMS = (
  Object.keys(VARIABLE_SOURCE_LABEL) as CrmCampaignVariableSourceKind[]
).map((value) => ({ value, label: VARIABLE_SOURCE_LABEL[value] }))

/**
 * WhatsApp add-on of a campaign (off by default). Meta Cloud API → an
 * approved template with its variables mapped; Z-API → free text with
 * {nome}/{link} and an optional media link.
 */
export function CampaignWhatsAppPanel({
  draft,
  onChange,
  options,
}: {
  draft: CampaignDraft
  onChange: DraftChange
  options: CrmCampaignOptionsDTO
}) {
  const { whatsapp } = options
  const connection = whatsapp.connections.find(
    (c) => c.id === draft.whatsappConnectionId,
  )
  const template = connection?.templates.find(
    (t) => t.id === draft.whatsappTemplateId,
  )
  const variables = draft.whatsappVariables ?? EMPTY_VARIABLES

  function setVariable(
    group: VariableGroup,
    key: string,
    value: CrmCampaignVariableSourceDTO,
  ) {
    onChange({
      whatsappVariables: {
        ...variables,
        [group]: { ...variables[group], [key]: value },
      },
    })
  }

  return (
    <section className='flex flex-col gap-4 rounded-xl border p-4'>
      <Label className='flex items-center justify-between gap-4 font-normal'>
        <span className='flex min-w-0 items-start gap-2'>
          <SteelIcon icon={WhatsappIcon} size={18} className='mt-0.5' />
          <span className='min-w-0'>
            <span className='block font-medium'>
              Também enviar pelo WhatsApp
            </span>
            <span className='text-muted-foreground text-xs'>
              {whatsapp.available
                ? 'Mesmo público, só quem tem WhatsApp e não pediu para sair.'
                : whatsapp.reason}
            </span>
          </span>
        </span>
        <Switch
          aria-label='Também enviar pelo WhatsApp'
          checked={draft.whatsappEnabled}
          disabled={!whatsapp.available && !draft.whatsappEnabled}
          onCheckedChange={(checked) => onChange({ whatsappEnabled: checked })}
        />
      </Label>

      {draft.whatsappEnabled ? (
        <div className='flex flex-col gap-4'>
          <div className='flex flex-col gap-2'>
            <Label htmlFor='wa-connection'>Conexão</Label>
            <Select
              items={whatsapp.connections.map((c) => ({
                value: c.id,
                label: `${c.label} · ${c.provider === 'META' ? 'Meta (API oficial)' : 'Z-API'}`,
              }))}
              value={draft.whatsappConnectionId}
              onValueChange={(value) =>
                onChange({
                  whatsappConnectionId: value as string,
                  whatsappTemplateId: null,
                  whatsappVariables: null,
                })
              }
            >
              <SelectTrigger id='wa-connection' className='w-full'>
                <SelectValue placeholder='Escolha a conexão' />
              </SelectTrigger>
              <SelectContent>
                {whatsapp.connections.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.label} ·{' '}
                    {c.provider === 'META' ? 'Meta (API oficial)' : 'Z-API'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {connection?.provider === 'META' ? (
            <div className='flex flex-col gap-4'>
              <p className='text-muted-foreground text-xs'>
                Pela API oficial, a primeira mensagem para o contato precisa ser
                um template aprovado pela Meta.
              </p>
              <div className='flex flex-col gap-2'>
                <Label htmlFor='wa-template'>Template aprovado</Label>
                <Select
                  items={connection.templates.map((t) => ({
                    value: t.id,
                    label: `${t.name} (${t.language})`,
                  }))}
                  value={draft.whatsappTemplateId}
                  onValueChange={(value) =>
                    onChange({
                      whatsappTemplateId: value as string,
                      whatsappVariables: null,
                    })
                  }
                >
                  <SelectTrigger id='wa-template' className='w-full'>
                    <SelectValue placeholder='Escolha o template' />
                  </SelectTrigger>
                  <SelectContent>
                    {connection.templates.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name} ({t.language})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {connection.templates.length === 0 ? (
                  <p className='text-muted-foreground text-xs'>
                    Nenhum template aprovado nesta conexão. Crie ou sincronize
                    em Comunicação › Templates.
                  </p>
                ) : null}
              </div>
              {template ? (
                <div className='flex flex-col gap-3'>
                  <p className='whitespace-pre-wrap rounded-lg bg-muted/40 p-3 text-sm'>
                    {template.fields.bodyText}
                  </p>
                  {variableSlots(template).map((slot) => {
                    const current = variables[slot.group][slot.key]
                    return (
                      <div
                        key={`${slot.group}-${slot.key}`}
                        className='grid gap-2 sm:grid-cols-[10rem_minmax(0,1fr)] sm:items-center'
                      >
                        <span className='text-sm'>{slot.label}</span>
                        <div className='flex min-w-0 flex-col gap-2 sm:flex-row'>
                          <Select
                            items={SOURCE_ITEMS}
                            value={current?.source ?? null}
                            onValueChange={(value) =>
                              setVariable(slot.group, slot.key, {
                                source: value as CrmCampaignVariableSourceKind,
                              })
                            }
                          >
                            <SelectTrigger
                              aria-label={`Valor de ${slot.label}`}
                              className='w-full sm:w-56'
                            >
                              <SelectValue placeholder='Preencher com…' />
                            </SelectTrigger>
                            <SelectContent>
                              {SOURCE_ITEMS.map((item) => (
                                <SelectItem key={item.value} value={item.value}>
                                  {item.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {current?.source === 'static' ? (
                            <Input
                              aria-label={`Texto de ${slot.label}`}
                              value={current.value ?? ''}
                              onChange={(e) =>
                                setVariable(slot.group, slot.key, {
                                  source: 'static',
                                  value: e.target.value,
                                })
                              }
                            />
                          ) : null}
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : null}
            </div>
          ) : connection?.provider === 'ZAPI' ? (
            <div className='flex flex-col gap-4'>
              <div className='flex flex-col gap-2'>
                <Label htmlFor='wa-text'>Mensagem</Label>
                <Textarea
                  id='wa-text'
                  rows={5}
                  value={draft.whatsappText ?? ''}
                  onChange={(e) => onChange({ whatsappText: e.target.value })}
                  placeholder={
                    'Oi {primeiro_nome}! Preparamos algo para você: {link}'
                  }
                />
                <p className='text-muted-foreground text-xs'>
                  Use {'{nome}'}, {'{primeiro_nome}'} e {'{link}'} (o link
                  rastreado da campanha — obrigatório).
                </p>
              </div>
              <div className='flex flex-col gap-2'>
                <Label htmlFor='wa-media'>
                  Imagem, vídeo ou PDF (opcional)
                </Label>
                <Input
                  id='wa-media'
                  type='url'
                  value={draft.whatsappMediaUrl ?? ''}
                  onChange={(e) =>
                    onChange({ whatsappMediaUrl: e.target.value })
                  }
                  placeholder='https://…'
                />
              </div>
            </div>
          ) : null}

          <div className='flex flex-col gap-2'>
            <Label htmlFor='wa-delay'>
              Enviar quantas horas depois do e-mail?
            </Label>
            <Input
              id='wa-delay'
              type='number'
              min={0}
              max={720}
              className='w-32'
              value={draft.whatsappDelayHours}
              onChange={(e) =>
                onChange({
                  whatsappDelayHours: Math.max(
                    0,
                    Math.min(720, Number(e.target.value) || 0),
                  ),
                })
              }
            />
            <p className='text-muted-foreground text-xs'>
              0 = junto com o e-mail. Respostas viram conversas na Comunicação,
              ligadas ao contato.
            </p>
          </div>
        </div>
      ) : null}
    </section>
  )
}
