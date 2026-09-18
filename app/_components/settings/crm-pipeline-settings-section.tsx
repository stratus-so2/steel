'use client'

import { useEffect, useState } from 'react'
import { STAGE_LABELS } from '@/app/_components/crm/crm-lead-stage'
import { useIsPrivileged } from '@/app/_components/workspace/workspace-permissions'
import { Muted } from '@/components/typography/text/muted'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
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
import {
  useCrmSettings,
  useUpdateCrmSettings,
} from '@/src/hooks/use-crm-settings'
import {
  CRM_LEAD_OPEN_STAGES,
  CRM_PROPOSAL_VALIDITY_DAYS_MAX,
  CRM_PROPOSAL_VALIDITY_DAYS_MIN,
  type CrmLeadOpenStage,
} from '@/src/schemas/crm-settings.schema'

/**
 * Regras do funil e das propostas: valores iniciais sensatos que OWNER/ADMIN
 * podem customizar por workspace. Os demais membros só visualizam.
 */
export function CrmPipelineSettingsSection({
  workspaceId,
}: {
  workspaceId: string
}) {
  const isPrivileged = useIsPrivileged()
  const { data: settings, isLoading } = useCrmSettings(workspaceId)
  const update = useUpdateCrmSettings(workspaceId)

  const [reopenStage, setReopenStage] = useState<CrmLeadOpenStage>('RECEIVED')
  const [validityDays, setValidityDays] = useState('15')
  const [notifyExpiry, setNotifyExpiry] = useState(true)

  useEffect(() => {
    if (!settings) return
    setReopenStage(settings.leadReopenStage)
    setValidityDays(String(settings.proposalValidityDays))
    setNotifyExpiry(settings.notifyProposalExpiry)
  }, [settings])

  const days = Number(validityDays)
  const daysValid =
    Number.isInteger(days) &&
    days >= CRM_PROPOSAL_VALIDITY_DAYS_MIN &&
    days <= CRM_PROPOSAL_VALIDITY_DAYS_MAX
  const dirty =
    !!settings &&
    (reopenStage !== settings.leadReopenStage ||
      days !== settings.proposalValidityDays ||
      notifyExpiry !== settings.notifyProposalExpiry)

  async function handleSave() {
    if (!daysValid) {
      notify.error(
        `Informe uma validade entre ${CRM_PROPOSAL_VALIDITY_DAYS_MIN} e ${CRM_PROPOSAL_VALIDITY_DAYS_MAX} dias.`,
      )
      return
    }
    try {
      await update.mutateAsync({
        leadReopenStage: reopenStage,
        proposalValidityDays: days,
        notifyProposalExpiry: notifyExpiry,
      })
      notify.success('Configurações salvas')
    } catch (err) {
      notify.error(err)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Funil e propostas</CardTitle>
      </CardHeader>
      <CardContent className='flex flex-col gap-4'>
        {isLoading || !settings ? (
          <Muted>Carregando...</Muted>
        ) : (
          <>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor='crm-reopen-stage'>
                  Etapa ao reabrir um lead perdido
                </FieldLabel>
                <Select
                  value={reopenStage}
                  onValueChange={(v) =>
                    setReopenStage((v as CrmLeadOpenStage) ?? reopenStage)
                  }
                  disabled={!isPrivileged}
                >
                  <SelectTrigger id='crm-reopen-stage' className='w-full'>
                    <SelectValue>{STAGE_LABELS[reopenStage]}</SelectValue>
                  </SelectTrigger>
                  <SelectContent alignItemWithTrigger={false}>
                    <SelectGroup>
                      {CRM_LEAD_OPEN_STAGES.map((stage) => (
                        <SelectItem key={stage} value={stage}>
                          {STAGE_LABELS[stage]}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <FieldDescription>
                  O lead nunca pula uma etapa: se ainda não tiver os registros
                  exigidos por ela, volta para a etapa mais avançada que eles
                  permitem.
                </FieldDescription>
              </Field>

              <Field>
                <FieldLabel htmlFor='crm-proposal-validity'>
                  Validade padrão das propostas (dias)
                </FieldLabel>
                <Input
                  id='crm-proposal-validity'
                  type='number'
                  min={CRM_PROPOSAL_VALIDITY_DAYS_MIN}
                  max={CRM_PROPOSAL_VALIDITY_DAYS_MAX}
                  value={validityDays}
                  onChange={(e) => setValidityDays(e.target.value)}
                  disabled={!isPrivileged}
                  aria-invalid={!daysValid}
                  className='max-w-40'
                />
                <FieldDescription>
                  Aplicada às propostas novas; cada proposta pode ter a própria
                  data no editor. Propostas antigas sem validade não expiram.
                </FieldDescription>
              </Field>

              <Field orientation='horizontal'>
                <Switch
                  id='crm-proposal-expiry-notify'
                  checked={notifyExpiry}
                  onCheckedChange={(checked) =>
                    setNotifyExpiry(checked === true)
                  }
                  disabled={!isPrivileged}
                />
                <FieldLabel htmlFor='crm-proposal-expiry-notify'>
                  Avisar o responsável por e-mail quando a proposta expirar
                </FieldLabel>
              </Field>
            </FieldGroup>

            {isPrivileged ? (
              <div className='flex justify-end'>
                <Button
                  onClick={handleSave}
                  disabled={!dirty || update.isPending}
                >
                  {update.isPending ? 'Salvando...' : 'Salvar'}
                </Button>
              </div>
            ) : (
              <Muted>
                Somente proprietários e administradores podem alterar estas
                configurações.
              </Muted>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
