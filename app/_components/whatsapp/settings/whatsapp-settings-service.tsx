'use client'

import { type FormEvent, useEffect, useState } from 'react'
import { useIsPrivileged } from '@/app/_components/workspace/workspace-permissions'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { notify } from '@/lib/notify'
import { useWhatsAppAssignableMembers } from '@/src/hooks/use-whatsapp-conversations'
import {
  useUpdateWhatsAppSettings,
  useWhatsAppSettings,
} from '@/src/hooks/use-whatsapp-settings'

const MAX_HOURS = 720
const MAX_COOLDOWN_HOURS = 168
const NO_SUPERVISOR = 'none'

/** Limites de média de sentimento oferecidos (escala -1 a 1). */
const THRESHOLD_OPTIONS = [
  { value: '-0.1', label: 'Levemente negativo (≤ -0,1)' },
  { value: '-0.3', label: 'Negativo (≤ -0,3) — padrão' },
  { value: '-0.5', label: 'Bem negativo (≤ -0,5)' },
  { value: '-0.7', label: 'Muito negativo (≤ -0,7)' },
]

function isWholeNumberIn(value: string, min: number, max: number): boolean {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed >= min && parsed <= max
}

/**
 * Configurações de atendimento (OWNER/ADMIN): fechamento automático por
 * inatividade e alerta de sentimento negativo aos supervisores.
 */
export function WhatsappSettingsService({
  workspaceId,
}: {
  workspaceId: string
}) {
  const isAdmin = useIsPrivileged()
  const settings = useWhatsAppSettings(workspaceId, isAdmin)
  const members = useWhatsAppAssignableMembers(workspaceId)
  const update = useUpdateWhatsAppSettings(workspaceId)

  const [hours, setHours] = useState('24')
  const [alertEnabled, setAlertEnabled] = useState(true)
  const [threshold, setThreshold] = useState('-0.3')
  const [notifyInApp, setNotifyInApp] = useState(true)
  const [notifyEmail, setNotifyEmail] = useState(false)
  const [recipientIds, setRecipientIds] = useState<Set<string>>(new Set())
  const [assignToId, setAssignToId] = useState<string>(NO_SUPERVISOR)
  const [cooldown, setCooldown] = useState('6')

  useEffect(() => {
    const data = settings.data
    if (!data) return
    setHours(String(data.autoCloseAfterHours))
    setAlertEnabled(data.sentimentAlertEnabled)
    setThreshold(String(data.sentimentAlertThreshold))
    setNotifyInApp(data.sentimentAlertNotifyInApp)
    setNotifyEmail(data.sentimentAlertNotifyEmail)
    setRecipientIds(new Set(data.sentimentAlertRecipientIds))
    setAssignToId(data.sentimentAlertAssignToId ?? NO_SUPERVISOR)
    setCooldown(String(data.sentimentAlertCooldownHours))
  }, [settings.data])

  if (!isAdmin) {
    return (
      <p className='text-muted-foreground text-sm'>
        Somente proprietários e administradores podem alterar as configurações
        de atendimento.
      </p>
    )
  }

  const thresholdOptions = THRESHOLD_OPTIONS.some((o) => o.value === threshold)
    ? THRESHOLD_OPTIONS
    : [
        ...THRESHOLD_OPTIONS,
        { value: threshold, label: `Personalizado (≤ ${threshold})` },
      ]

  const assignOptions = [
    { value: NO_SUPERVISOR, label: 'Não atribuir automaticamente' },
    ...(members.data ?? []).map((member) => ({
      value: member.id,
      label: member.name,
    })),
  ]

  function toggleRecipient(userId: string) {
    setRecipientIds((current) => {
      const next = new Set(current)
      if (next.has(userId)) next.delete(userId)
      else next.add(userId)
      return next
    })
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!isWholeNumberIn(hours, 0, MAX_HOURS)) {
      notify.error(`Informe um número inteiro de horas entre 0 e ${MAX_HOURS}`)
      return
    }
    if (!isWholeNumberIn(cooldown, 1, MAX_COOLDOWN_HOURS)) {
      notify.error(
        `O intervalo entre alertas deve ser de 1 a ${MAX_COOLDOWN_HOURS} horas`,
      )
      return
    }
    if (alertEnabled && !notifyInApp && !notifyEmail) {
      notify.error('Escolha ao menos um canal de aviso (no app ou e-mail)')
      return
    }
    update.mutate(
      {
        autoCloseAfterHours: Number(hours),
        sentimentAlertEnabled: alertEnabled,
        sentimentAlertThreshold: Number(threshold),
        sentimentAlertNotifyInApp: notifyInApp,
        sentimentAlertNotifyEmail: notifyEmail,
        sentimentAlertRecipientIds: Array.from(recipientIds),
        sentimentAlertAssignToId:
          assignToId === NO_SUPERVISOR ? null : assignToId,
        sentimentAlertCooldownHours: Number(cooldown),
      },
      {
        onSuccess: () => notify.success('Configurações de atendimento salvas'),
        onError: (error) => notify.error(error, 'Não foi possível salvar'),
      },
    )
  }

  return (
    <form onSubmit={handleSubmit} className='max-w-lg space-y-8'>
      <section className='space-y-4'>
        <div>
          <h3 className='font-medium text-sm'>Fechamento automático</h3>
          <p className='text-muted-foreground text-xs'>
            Conversas sem nenhuma mensagem pelo tempo abaixo são fechadas
            automaticamente e saem da caixa de entrada ativa. Se o contato
            voltar a escrever, a conversa é reaberta.
          </p>
        </div>

        <div className='space-y-1.5'>
          <Label htmlFor='autoCloseAfterHours'>
            Fechar após quantas horas sem mensagens
          </Label>
          <Input
            id='autoCloseAfterHours'
            type='number'
            min={0}
            max={MAX_HOURS}
            step={1}
            value={hours}
            onChange={(event) => setHours(event.target.value)}
            className='w-40'
          />
          <p className='text-muted-foreground text-xs'>
            Use 0 para desligar. Padrão: 24 horas.
          </p>
        </div>
      </section>

      <section className='space-y-4'>
        <div className='flex items-center justify-between gap-3 rounded-md border p-3'>
          <div>
            <p className='font-medium text-sm'>Alerta de sentimento negativo</p>
            <p className='text-muted-foreground text-xs'>
              Quando o humor médio de uma conversa fica negativo, avisa os
              supervisores para agirem antes que o cliente desista.
            </p>
          </div>
          <Switch
            aria-label='Alerta de sentimento negativo'
            checked={alertEnabled}
            onCheckedChange={setAlertEnabled}
          />
        </div>

        {alertEnabled ? (
          <div className='space-y-4'>
            <div className='space-y-1.5'>
              <Label htmlFor='sentimentThreshold'>
                Avisar quando a média for
              </Label>
              <Select
                items={thresholdOptions}
                value={threshold}
                onValueChange={(value) => setThreshold(value ?? '-0.3')}
              >
                <SelectTrigger id='sentimentThreshold' className='w-full'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent alignItemWithTrigger={false}>
                  <SelectGroup>
                    {thresholdOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            <fieldset className='space-y-2'>
              <legend className='mb-1 font-medium text-sm'>Canais</legend>
              <label
                htmlFor='notifyInApp'
                className='flex items-center gap-2 text-sm'
              >
                <Checkbox
                  id='notifyInApp'
                  checked={notifyInApp}
                  onCheckedChange={(checked) =>
                    setNotifyInApp(checked === true)
                  }
                />
                Notificação no app (caixa de entrada)
              </label>
              <label
                htmlFor='notifyEmail'
                className='flex items-center gap-2 text-sm'
              >
                <Checkbox
                  id='notifyEmail'
                  checked={notifyEmail}
                  onCheckedChange={(checked) =>
                    setNotifyEmail(checked === true)
                  }
                />
                E-mail
              </label>
            </fieldset>

            <fieldset className='space-y-1.5'>
              <legend className='mb-1 font-medium text-sm'>Quem avisar</legend>
              <p className='text-muted-foreground text-xs'>
                Nenhum selecionado = todos os proprietários e administradores.
              </p>
              <div className='max-h-48 space-y-1 overflow-y-auto rounded-md border p-2'>
                {(members.data ?? []).map((member) => (
                  <label
                    key={member.id}
                    htmlFor={`alert-recipient-${member.id}`}
                    className='flex items-center gap-2 py-1 text-sm'
                  >
                    <Checkbox
                      id={`alert-recipient-${member.id}`}
                      checked={recipientIds.has(member.id)}
                      onCheckedChange={() => toggleRecipient(member.id)}
                    />
                    <span className='min-w-0 flex-1 truncate'>
                      {member.name}
                    </span>
                    <span className='truncate text-muted-foreground text-xs'>
                      {member.email}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            <div className='space-y-1.5'>
              <Label htmlFor='sentimentAssignTo'>
                Atribuir conversas sem atendente a
              </Label>
              <Select
                items={assignOptions}
                value={assignToId}
                onValueChange={(value) => setAssignToId(value ?? NO_SUPERVISOR)}
              >
                <SelectTrigger id='sentimentAssignTo' className='w-full'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent alignItemWithTrigger={false}>
                  <SelectGroup>
                    <SelectItem value={NO_SUPERVISOR}>
                      Não atribuir automaticamente
                    </SelectItem>
                    {(members.data ?? []).map((member) => (
                      <SelectItem key={member.id} value={member.id}>
                        {member.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            <div className='space-y-1.5'>
              <Label htmlFor='sentimentCooldown'>
                Intervalo mínimo entre alertas da mesma conversa (horas)
              </Label>
              <Input
                id='sentimentCooldown'
                type='number'
                min={1}
                max={MAX_COOLDOWN_HOURS}
                step={1}
                value={cooldown}
                onChange={(event) => setCooldown(event.target.value)}
                className='w-40'
              />
            </div>
          </div>
        ) : null}
      </section>

      <Button type='submit' disabled={update.isPending || settings.isLoading}>
        {update.isPending ? 'Salvando...' : 'Salvar'}
      </Button>
    </form>
  )
}
