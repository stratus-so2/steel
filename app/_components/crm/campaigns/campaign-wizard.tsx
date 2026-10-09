'use client'

import {
  ArrowLeft01Icon,
  ArrowRight01Icon,
  CheckmarkCircle02Icon,
  FloppyDiskIcon,
  SentIcon,
} from '@hugeicons-pro/core-stroke-rounded'
import Link from 'next/link'
import { useState } from 'react'
import { SteelIcon } from '@/components/icon/icon'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Switch } from '@/components/ui/switch'
import { notify } from '@/lib/notify'
import { cn } from '@/lib/utils'
import {
  useCrmCampaignEmailPreview,
  useLaunchCrmCampaign,
  useTestSendCrmCampaign,
  useUpdateCrmCampaign,
} from '@/src/hooks/use-crm-campaigns'
import type {
  CrmCampaignDetailDTO,
  CrmCampaignOptionsDTO,
} from '@/types/crm-campaign'
import { CampaignAudienceStep } from './campaign-audience-step'
import {
  type CampaignDraft,
  draftFromCampaign,
  draftToPatch,
} from './campaign-draft'
import {
  fromLocalInput,
  LEGAL_BASIS_LABEL,
  toLocalInput,
  WIZARD_STEPS,
} from './campaign-labels'
import { ContentStep, DestinationStep } from './campaign-steps'

function ReviewStep({
  campaign,
  draft,
  onChange,
  options,
  workspaceId,
  dirty,
}: {
  campaign: CrmCampaignDetailDTO
  draft: CampaignDraft
  onChange: (patch: Partial<CampaignDraft>) => void
  options: CrmCampaignOptionsDTO
  workspaceId: string
  dirty: boolean
}) {
  const [testEmail, setTestEmail] = useState('')
  const [testPhone, setTestPhone] = useState('')
  const test = useTestSendCrmCampaign(workspaceId, campaign.id)
  const scheduled = draft.scheduledAt !== null
  const windowOn = draft.sendWindowStartHour !== null

  const destination =
    draft.destinationType === 'FORM'
      ? options.forms.find((f) => f.id === draft.formId)?.name
      : options.landingPages.find((p) => p.id === draft.landingPageId)?.title
  const template = options.emailTemplates.find(
    (t) => t.id === draft.emailTemplateId,
  )?.name
  const connection = options.whatsapp.connections.find(
    (c) => c.id === draft.whatsappConnectionId,
  )

  function sendTest() {
    test.mutate(
      {
        email: testEmail.trim() || undefined,
        phone: testPhone.trim() || undefined,
      },
      {
        onSuccess: (result) => {
          if (result.errors.length > 0) notify.error(result.errors.join(' · '))
          else notify.success('Teste enviado')
        },
        onError: (error) => notify.error(error, 'Erro ao enviar o teste'),
      },
    )
  }

  const summary = [
    {
      label: 'Destino',
      value: destination ?? '—',
    },
    {
      label: 'E-mail',
      value: draft.emailSubject
        ? `“${draft.emailSubject}” · ${template ?? 'sem visual'}`
        : '—',
    },
    {
      label: 'WhatsApp',
      value: draft.whatsappEnabled
        ? `${connection?.label ?? 'sem conexão'} · ${
            draft.whatsappDelayHours > 0
              ? `${draft.whatsappDelayHours} h depois do e-mail`
              : 'junto com o e-mail'
          }`
        : 'Desligado',
    },
    {
      label: 'Base legal',
      value:
        [
          draft.emailLegalBasis
            ? `E-mail: ${LEGAL_BASIS_LABEL[draft.emailLegalBasis]}`
            : null,
          draft.whatsappEnabled && draft.whatsappLegalBasis
            ? `WhatsApp: ${LEGAL_BASIS_LABEL[draft.whatsappLegalBasis]}`
            : null,
        ]
          .filter(Boolean)
          .join(' · ') || '—',
    },
  ]

  return (
    <div className='grid gap-6 lg:grid-cols-2'>
      <div className='flex min-w-0 flex-col gap-6'>
        <dl className='flex flex-col gap-3 rounded-xl border p-4'>
          {summary.map((row) => (
            <div key={row.label} className='flex min-w-0 flex-col'>
              <dt className='text-muted-foreground text-xs'>{row.label}</dt>
              <dd className='break-words text-sm'>{row.value}</dd>
            </div>
          ))}
        </dl>

        {campaign.issues.length > 0 || dirty ? (
          <div
            role='alert'
            className='flex flex-col gap-2 rounded-xl border border-destructive/40 bg-destructive/5 p-4'
          >
            <p className='font-medium text-sm'>Antes de enviar</p>
            {dirty ? (
              <p className='text-sm'>Há alterações não salvas.</p>
            ) : null}
            <ul className='list-disc pl-5 text-sm'>
              {campaign.issues.map((issue) => (
                <li key={issue.message}>{issue.message}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className='flex flex-col gap-3 rounded-xl border p-4'>
          <p className='font-medium text-sm'>Envio de teste</p>
          <div className='grid gap-2 sm:grid-cols-2'>
            <Input
              aria-label='E-mail de teste'
              type='email'
              placeholder='voce@empresa.com.br'
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
            />
            {draft.whatsappEnabled ? (
              <Input
                aria-label='WhatsApp de teste'
                placeholder='(11) 99999-0000'
                value={testPhone}
                onChange={(e) => setTestPhone(e.target.value)}
              />
            ) : null}
          </div>
          <Button
            type='button'
            variant='outline'
            className='self-start'
            disabled={dirty || test.isPending || (!testEmail && !testPhone)}
            onClick={sendTest}
          >
            Enviar teste
          </Button>
        </div>
      </div>

      <div className='flex min-w-0 flex-col gap-6'>
        <RadioGroup
          value={scheduled ? 'schedule' : 'now'}
          onValueChange={(value) =>
            onChange({
              scheduledAt:
                value === 'schedule'
                  ? new Date(Date.now() + 60 * 60 * 1000).toISOString()
                  : null,
            })
          }
          className='flex flex-col gap-3'
        >
          <Label className='flex items-center gap-2 font-normal'>
            <RadioGroupItem value='now' /> Enviar agora
          </Label>
          <Label className='flex items-center gap-2 font-normal'>
            <RadioGroupItem value='schedule' /> Agendar
          </Label>
        </RadioGroup>
        {scheduled ? (
          <div className='flex flex-col gap-2'>
            <Label htmlFor='scheduled-at'>Data e hora (Brasília)</Label>
            <Input
              id='scheduled-at'
              type='datetime-local'
              className='sm:w-64'
              value={toLocalInput(draft.scheduledAt)}
              onChange={(e) =>
                onChange({ scheduledAt: fromLocalInput(e.target.value) })
              }
            />
          </div>
        ) : null}

        <div className='flex flex-col gap-3 rounded-xl border p-4'>
          <Label className='flex items-center justify-between gap-4 font-normal'>
            <span>
              <span className='block font-medium'>Janela de envio</span>
              <span className='text-muted-foreground text-xs'>
                Fora dela os envios esperam o próximo horário (Brasília).
              </span>
            </span>
            <Switch
              checked={windowOn}
              onCheckedChange={(checked) =>
                onChange(
                  checked
                    ? {
                        sendWindowStartHour: 8,
                        sendWindowEndHour: 18,
                        sendWeekdaysOnly: true,
                      }
                    : {
                        sendWindowStartHour: null,
                        sendWindowEndHour: null,
                        sendWeekdaysOnly: false,
                      },
                )
              }
            />
          </Label>
          {windowOn ? (
            <div className='flex flex-wrap items-end gap-3'>
              <div className='flex flex-col gap-1'>
                <Label htmlFor='window-start'>Das</Label>
                <Input
                  id='window-start'
                  type='number'
                  min={0}
                  max={23}
                  className='w-20'
                  value={draft.sendWindowStartHour ?? 8}
                  onChange={(e) =>
                    onChange({
                      sendWindowStartHour: Math.min(
                        23,
                        Math.max(0, Number(e.target.value) || 0),
                      ),
                    })
                  }
                />
              </div>
              <div className='flex flex-col gap-1'>
                <Label htmlFor='window-end'>às</Label>
                <Input
                  id='window-end'
                  type='number'
                  min={1}
                  max={24}
                  className='w-20'
                  value={draft.sendWindowEndHour ?? 18}
                  onChange={(e) =>
                    onChange({
                      sendWindowEndHour: Math.min(
                        24,
                        Math.max(1, Number(e.target.value) || 1),
                      ),
                    })
                  }
                />
              </div>
              <Label className='flex items-center gap-2 pb-2 font-normal'>
                <Checkbox
                  checked={draft.sendWeekdaysOnly}
                  onCheckedChange={(checked) =>
                    onChange({ sendWeekdaysOnly: checked === true })
                  }
                />
                Só dias úteis
              </Label>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export function CrmCampaignWizard({
  workspaceId,
  workspaceSlug,
  campaign,
  options,
  onRefreshOptions,
}: {
  workspaceId: string
  workspaceSlug: string
  campaign: CrmCampaignDetailDTO
  options: CrmCampaignOptionsDTO
  onRefreshOptions: () => void
}) {
  const [step, setStep] = useState(0)
  const [draft, setDraft] = useState<CampaignDraft>(() =>
    draftFromCampaign(campaign),
  )
  const [dirty, setDirty] = useState(false)
  const [consent, setConsent] = useState(false)
  const update = useUpdateCrmCampaign(workspaceId, campaign.id)
  const launch = useLaunchCrmCampaign(workspaceId, campaign.id)
  const preview = useCrmCampaignEmailPreview(workspaceId, campaign)

  function change(patch: Partial<CampaignDraft>) {
    setDraft((current) => ({ ...current, ...patch }))
    setDirty(true)
  }

  async function save(): Promise<boolean> {
    if (!dirty) return true
    try {
      const saved = await update.mutateAsync(draftToPatch(draft))
      setDraft(draftFromCampaign(saved))
      setDirty(false)
      return true
    } catch (error) {
      notify.error(error, 'Erro ao salvar a campanha')
      return false
    }
  }

  async function goTo(next: number) {
    if (await save()) setStep(next)
  }

  async function handleSaveDraft() {
    if (await save()) notify.success('Rascunho salvo')
  }

  function handleLaunch() {
    launch.mutate(undefined, {
      onSuccess: (launched) =>
        notify.success(
          launched.status === 'SCHEDULED'
            ? 'Campanha agendada'
            : 'Campanha enviada para a fila de envio',
        ),
      onError: (error) => notify.error(error, 'Erro ao enviar a campanha'),
    })
  }

  const stepIssues = (key: string) =>
    campaign.issues.some((issue) => issue.step === key)
  const last = step === WIZARD_STEPS.length - 1
  const canLaunch = !dirty && campaign.issues.length === 0 && consent

  return (
    <div className='flex min-w-0 flex-col gap-6 p-4 sm:p-6'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <div className='flex min-w-0 flex-1 items-center gap-2'>
          <Button
            variant='ghost'
            size='icon'
            nativeButton={false}
            aria-label='Voltar para campanhas'
            render={
              <Link href={`/${workspaceSlug}/crm/campaigns`}>
                <SteelIcon icon={ArrowLeft01Icon} />
              </Link>
            }
          />
          <Input
            aria-label='Nome da campanha'
            value={draft.name}
            maxLength={120}
            onChange={(e) => change({ name: e.target.value })}
            className='min-w-0 flex-1 border-transparent font-semibold text-lg shadow-none sm:max-w-md'
          />
        </div>
        <Button
          variant='outline'
          onClick={handleSaveDraft}
          disabled={!dirty || update.isPending}
        >
          <SteelIcon icon={FloppyDiskIcon} /> Salvar rascunho
        </Button>
      </div>

      <nav aria-label='Passos da campanha' className='flex flex-col gap-3'>
        <div
          className='h-1.5 w-full overflow-hidden rounded-full bg-muted'
          role='progressbar'
          aria-valuemin={1}
          aria-valuemax={WIZARD_STEPS.length}
          aria-valuenow={step + 1}
          aria-label={`Passo ${step + 1} de ${WIZARD_STEPS.length}`}
        >
          <div
            className='h-full rounded-full bg-primary transition-all'
            style={{ width: `${((step + 1) / WIZARD_STEPS.length) * 100}%` }}
          />
        </div>
        <ol className='grid grid-cols-2 gap-2 sm:grid-cols-4'>
          {WIZARD_STEPS.map((item, index) => {
            const done = index !== step && !stepIssues(item.key)
            return (
              <li key={item.key}>
                <button
                  type='button'
                  onClick={() => goTo(index)}
                  aria-current={index === step ? 'step' : undefined}
                  className={cn(
                    'flex w-full min-w-0 items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted',
                    index === step && 'bg-muted font-medium',
                  )}
                >
                  <span
                    className={cn(
                      'flex size-5 shrink-0 items-center justify-center rounded-full border text-xs',
                      index === step && 'border-primary text-primary',
                    )}
                  >
                    {done && item.key !== 'review' ? (
                      <SteelIcon icon={CheckmarkCircle02Icon} size={14} />
                    ) : (
                      index + 1
                    )}
                  </span>
                  <span className='truncate'>{item.label}</span>
                </button>
              </li>
            )
          })}
        </ol>
      </nav>

      <div className='min-w-0'>
        {step === 0 ? (
          <DestinationStep
            draft={draft}
            onChange={change}
            options={options}
            campaign={campaign}
            workspaceSlug={workspaceSlug}
            onRefreshOptions={onRefreshOptions}
          />
        ) : step === 1 ? (
          <ContentStep
            draft={draft}
            onChange={change}
            options={options}
            workspaceSlug={workspaceSlug}
            preview={preview.data}
            previewLoading={preview.isLoading}
          />
        ) : step === 2 ? (
          <CampaignAudienceStep
            workspaceId={workspaceId}
            draft={draft}
            onChange={change}
            options={options}
          />
        ) : (
          <ReviewStep
            campaign={campaign}
            draft={draft}
            onChange={change}
            options={options}
            workspaceId={workspaceId}
            dirty={dirty}
          />
        )}
      </div>

      <div className='flex flex-col-reverse gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between'>
        <Button
          variant='ghost'
          onClick={() => goTo(step - 1)}
          disabled={step === 0}
        >
          <SteelIcon icon={ArrowLeft01Icon} /> Voltar
        </Button>
        {last ? (
          <div className='flex flex-col gap-3 sm:flex-row sm:items-center'>
            <Label className='flex items-start gap-2 font-normal text-sm'>
              <Checkbox
                checked={consent}
                onCheckedChange={(checked) => setConsent(checked === true)}
              />
              Confirmo a base legal (LGPD) para enviar a este público.
            </Label>
            <Button
              onClick={handleLaunch}
              disabled={!canLaunch || launch.isPending}
            >
              <SteelIcon icon={SentIcon} />
              {draft.scheduledAt ? 'Agendar campanha' : 'Enviar campanha'}
            </Button>
          </div>
        ) : (
          <Button onClick={() => goTo(step + 1)} disabled={update.isPending}>
            Continuar <SteelIcon icon={ArrowRight01Icon} />
          </Button>
        )}
      </div>
    </div>
  )
}
