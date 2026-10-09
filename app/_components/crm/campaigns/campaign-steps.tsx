'use client'

import {
  BrowserIcon,
  Copy01Icon,
  FormIcon,
  LinkSquare02Icon,
  RefreshIcon,
} from '@hugeicons-pro/core-stroke-rounded'
import { SteelIcon } from '@/components/icon/icon'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
import { cn } from '@/lib/utils'
import {
  buildDestinationUrl,
  CAMPAIGN_FIRST_NAME_MERGE_TAG,
  CAMPAIGN_LINK_MERGE_TAG,
  withCampaignParams,
} from '@/src/lib/crm-campaign/campaign-url'
import type {
  CrmCampaignDetailDTO,
  CrmCampaignEmailPreviewDTO,
  CrmCampaignOptionsDTO,
} from '@/types/crm-campaign'
import type { CampaignDraft, DraftChange } from './campaign-draft'
import { CampaignWhatsAppPanel } from './campaign-whatsapp-panel'

/** Public links per channel, computed from the draft (no save needed). */
export function campaignLinks(
  draft: CampaignDraft,
  slug: string,
  options: CrmCampaignOptionsDTO,
): { email: string; whatsapp: string } | null {
  const token =
    draft.destinationType === 'FORM'
      ? options.forms.find((f) => f.id === draft.formId)?.publicToken
      : options.landingPages.find((p) => p.id === draft.landingPageId)
          ?.shareToken
  if (!draft.destinationType || !token) return null
  const destination = buildDestinationUrl(options.baseUrl, {
    type: draft.destinationType,
    token,
  })
  const params = { medium: draft.utmMedium || 'campanha', campaign: slug }
  return {
    email: withCampaignParams(destination, { ...params, source: 'email' }),
    whatsapp: withCampaignParams(destination, {
      ...params,
      source: 'whatsapp',
    }),
  }
}

export function CopyLinkRow({ label, url }: { label: string; url: string }) {
  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      notify.success('Link copiado')
    } catch {
      notify.error('Não foi possível copiar o link')
    }
  }
  return (
    <div className='flex min-w-0 flex-col gap-1'>
      <span className='text-muted-foreground text-xs'>{label}</span>
      <div className='flex min-w-0 items-center gap-2'>
        <code className='min-w-0 flex-1 truncate rounded-md bg-muted px-2 py-1.5 text-xs'>
          {url}
        </code>
        <Button
          type='button'
          size='sm'
          variant='outline'
          onClick={copy}
          aria-label={`Copiar ${label.toLowerCase()}`}
        >
          <SteelIcon icon={Copy01Icon} /> Copiar
        </Button>
      </div>
    </div>
  )
}

export function DestinationStep({
  draft,
  onChange,
  options,
  campaign,
  workspaceSlug,
  onRefreshOptions,
}: {
  draft: CampaignDraft
  onChange: DraftChange
  options: CrmCampaignOptionsDTO
  campaign: CrmCampaignDetailDTO
  workspaceSlug: string
  onRefreshOptions: () => void
}) {
  const isForm = draft.destinationType === 'FORM'
  const items = isForm
    ? options.forms.map((f) => ({
        value: f.id,
        label: f.name,
        published: f.published,
      }))
    : options.landingPages.map((p) => ({
        value: p.id,
        label: p.title,
        published: p.published,
      }))
  const selectedId = isForm ? draft.formId : draft.landingPageId
  const selected = items.find((item) => item.value === selectedId)
  const links = campaignLinks(draft, campaign.slug, options)

  const types = [
    {
      value: 'LANDING_PAGE' as const,
      label: 'Landing page',
      description: 'Uma página de oferta publicada no Steel.',
      icon: BrowserIcon,
    },
    {
      value: 'FORM' as const,
      label: 'Formulário',
      description: 'Captura o contato e já cria o lead.',
      icon: FormIcon,
    },
  ]

  return (
    <div className='flex flex-col gap-6'>
      <div className='grid gap-3 sm:grid-cols-2'>
        {types.map((type) => (
          <button
            key={type.value}
            type='button'
            aria-pressed={draft.destinationType === type.value}
            onClick={() =>
              onChange({
                destinationType: type.value,
                landingPageId: null,
                formId: null,
              })
            }
            className={cn(
              'flex min-w-0 items-start gap-3 rounded-xl border p-4 text-left transition-colors hover:bg-muted/40',
              draft.destinationType === type.value &&
                'border-primary ring-1 ring-primary',
            )}
          >
            <SteelIcon icon={type.icon} size={20} className='text-primary' />
            <span className='min-w-0'>
              <span className='block font-medium'>{type.label}</span>
              <span className='text-muted-foreground text-xs'>
                {type.description}
              </span>
            </span>
          </button>
        ))}
      </div>

      {draft.destinationType ? (
        <div className='flex flex-col gap-2'>
          <Label htmlFor='destination'>
            {isForm ? 'Formulário' : 'Landing page'}
          </Label>
          <div className='flex flex-col gap-2 sm:flex-row'>
            <Select
              items={items.map(({ value, label }) => ({ value, label }))}
              value={selectedId}
              onValueChange={(value) =>
                onChange(
                  isForm
                    ? { formId: value as string }
                    : { landingPageId: value as string },
                )
              }
            >
              <SelectTrigger id='destination' className='w-full sm:flex-1'>
                <SelectValue
                  placeholder={
                    items.length === 0 ? 'Nenhum criado ainda' : 'Escolha…'
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {items.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                    {item.published ? '' : ' (rascunho)'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className='flex gap-2'>
              <Button
                variant='outline'
                nativeButton={false}
                render={
                  <a
                    href={`/${workspaceSlug}/crm/${isForm ? 'forms' : 'landing-pages'}`}
                    target='_blank'
                    rel='noopener noreferrer'
                  >
                    <SteelIcon icon={LinkSquare02Icon} />
                    {isForm ? 'Criar formulário' : 'Criar página'}
                  </a>
                }
              />
              <Button
                type='button'
                variant='ghost'
                onClick={onRefreshOptions}
                aria-label='Atualizar lista'
              >
                <SteelIcon icon={RefreshIcon} />
              </Button>
            </div>
          </div>
          {selected && !selected.published ? (
            <p className='text-muted-foreground text-xs'>
              <Badge variant='outline'>Rascunho</Badge> Publique antes de enviar
              — senão o link abre uma página indisponível.
            </p>
          ) : null}
        </div>
      ) : null}

      <div className='flex flex-col gap-2'>
        <Label htmlFor='utm-medium'>utm_medium</Label>
        <Input
          id='utm-medium'
          className='sm:w-64'
          value={draft.utmMedium}
          onChange={(e) =>
            onChange({ utmMedium: e.target.value.replace(/[^a-z0-9_-]/gi, '') })
          }
        />
        <p className='text-muted-foreground text-xs'>
          utm_source é o canal (email ou whatsapp) e utm_campaign é{' '}
          <code>{campaign.slug}</code>.
        </p>
      </div>

      {links ? (
        <div className='flex flex-col gap-3 rounded-xl border bg-muted/30 p-4'>
          <p className='font-medium text-sm'>Links da campanha</p>
          <CopyLinkRow label='Link do e-mail' url={links.email} />
          <CopyLinkRow label='Link do WhatsApp' url={links.whatsapp} />
          <p className='text-muted-foreground text-xs'>
            Nos envios, cada contato recebe a própria versão rastreada destes
            links — é ela que conta cliques e conversões.
          </p>
        </div>
      ) : null}
    </div>
  )
}

export function ContentStep({
  draft,
  onChange,
  options,
  workspaceSlug,
  preview,
  previewLoading,
}: {
  draft: CampaignDraft
  onChange: DraftChange
  options: CrmCampaignOptionsDTO
  workspaceSlug: string
  preview: CrmCampaignEmailPreviewDTO | undefined
  previewLoading: boolean
}) {
  return (
    <div className='flex flex-col gap-6'>
      <div className='grid gap-6 lg:grid-cols-2'>
        <div className='flex min-w-0 flex-col gap-4'>
          <div className='flex flex-col gap-2'>
            <Label htmlFor='email-from'>Remetente</Label>
            <Input
              id='email-from'
              type='email'
              value={draft.emailFrom ?? ''}
              onChange={(e) => onChange({ emailFrom: e.target.value })}
              placeholder='marketing@suaempresa.com.br'
            />
          </div>
          <div className='flex flex-col gap-2'>
            <Label htmlFor='email-subject'>Assunto</Label>
            <Input
              id='email-subject'
              value={draft.emailSubject ?? ''}
              maxLength={200}
              onChange={(e) => onChange({ emailSubject: e.target.value })}
            />
          </div>
          <div className='flex flex-col gap-2'>
            <Label htmlFor='email-preheader'>Pré-cabeçalho</Label>
            <Input
              id='email-preheader'
              value={draft.emailPreheader ?? ''}
              maxLength={200}
              onChange={(e) => onChange({ emailPreheader: e.target.value })}
              placeholder='Aparece ao lado do assunto na caixa de entrada'
            />
          </div>
          <div className='flex flex-col gap-2'>
            <Label htmlFor='email-template'>Visual do e-mail</Label>
            <div className='flex flex-col gap-2 sm:flex-row'>
              <Select
                items={options.emailTemplates.map((t) => ({
                  value: t.id,
                  label: t.name,
                }))}
                value={draft.emailTemplateId}
                onValueChange={(value) =>
                  onChange({ emailTemplateId: value as string })
                }
              >
                <SelectTrigger id='email-template' className='w-full sm:flex-1'>
                  <SelectValue
                    placeholder={
                      options.emailTemplates.length === 0
                        ? 'Nenhum visual criado'
                        : 'Escolha o visual'
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {options.emailTemplates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className='flex gap-2'>
                <Button
                  variant='outline'
                  nativeButton={false}
                  render={
                    <a
                      href={
                        draft.emailTemplateId
                          ? `/${workspaceSlug}/crm/email-templates/${draft.emailTemplateId}`
                          : `/${workspaceSlug}/crm/email-templates/new`
                      }
                      target='_blank'
                      rel='noopener noreferrer'
                    >
                      <SteelIcon icon={LinkSquare02Icon} />
                      {draft.emailTemplateId
                        ? 'Abrir no editor'
                        : 'Criar visual'}
                    </a>
                  }
                />
                {draft.emailTemplateId ? (
                  <Button
                    variant='ghost'
                    nativeButton={false}
                    render={
                      <a
                        href={`/${workspaceSlug}/crm/email-templates/new`}
                        target='_blank'
                        rel='noopener noreferrer'
                      >
                        Galeria
                      </a>
                    }
                  />
                ) : null}
              </div>
            </div>
            <p className='text-muted-foreground text-xs'>
              No editor, escolha <strong>Link da campanha</strong> (
              <code>{CAMPAIGN_LINK_MERGE_TAG}</code>) no botão para levar ao
              destino, e use <code>{CAMPAIGN_FIRST_NAME_MERGE_TAG}</code> para
              personalizar. Depois de salvar no editor, volte e atualize a
              prévia.
            </p>
          </div>
        </div>
        <div className='flex min-w-0 flex-col gap-2'>
          <span className='font-medium text-sm'>Prévia</span>
          {draft.emailTemplateId ? (
            previewLoading ? (
              <div className='h-80 animate-pulse rounded-xl bg-muted' />
            ) : preview ? (
              <iframe
                title='Prévia do e-mail'
                sandbox=''
                srcDoc={preview.html}
                className='h-80 w-full rounded-xl border bg-white lg:h-[28rem]'
              />
            ) : (
              <p className='text-muted-foreground text-sm'>
                Salve para ver a prévia.
              </p>
            )
          ) : (
            <p className='rounded-xl border border-dashed p-6 text-center text-muted-foreground text-sm'>
              Escolha o visual para ver a prévia.
            </p>
          )}
        </div>
      </div>

      <CampaignWhatsAppPanel
        draft={draft}
        onChange={onChange}
        options={options}
      />
    </div>
  )
}
