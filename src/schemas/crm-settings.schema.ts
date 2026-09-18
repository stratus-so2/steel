import z from 'zod'

/**
 * Etapas abertas do painel de leads — destinos válidos para reabrir um lead
 * perdido (CLOSED fica de fora: reabrir é justamente sair dela).
 */
export const CRM_LEAD_OPEN_STAGES = [
  'RECEIVED',
  'IN_CONTACT',
  'QUALIFIED',
  'OPPORTUNITY',
  'PROPOSAL',
] as const

export const CrmLeadOpenStageEnum = z.enum(CRM_LEAD_OPEN_STAGES)

export type CrmLeadOpenStage = z.infer<typeof CrmLeadOpenStageEnum>

export const CRM_PROPOSAL_VALIDITY_DAYS_MIN = 1
export const CRM_PROPOSAL_VALIDITY_DAYS_MAX = 365

/**
 * Valores iniciais das configurações do CRM. Uma workspace sem linha em
 * `crm_settings` usa exatamente estes valores (espelhados nos `@default` do
 * model `CrmSettings`).
 */
export const CRM_SETTINGS_DEFAULTS = {
  leadReopenStage: 'RECEIVED',
  proposalValidityDays: 15,
  notifyProposalExpiry: true,
} as const satisfies {
  leadReopenStage: CrmLeadOpenStage
  proposalValidityDays: number
  notifyProposalExpiry: boolean
}

export const UpdateCrmSettingsSchema = z
  .object({
    leadReopenStage: CrmLeadOpenStageEnum.optional(),
    proposalValidityDays: z
      .number()
      .int('Informe um número inteiro de dias')
      .min(
        CRM_PROPOSAL_VALIDITY_DAYS_MIN,
        `A validade mínima é de ${CRM_PROPOSAL_VALIDITY_DAYS_MIN} dia`,
      )
      .max(
        CRM_PROPOSAL_VALIDITY_DAYS_MAX,
        `A validade máxima é de ${CRM_PROPOSAL_VALIDITY_DAYS_MAX} dias`,
      )
      .optional(),
    notifyProposalExpiry: z.boolean().optional(),
  })
  .refine((dto) => Object.values(dto).some((value) => value !== undefined), {
    message: 'Informe ao menos uma configuração',
  })

export type UpdateCrmSettingsDTO = z.infer<typeof UpdateCrmSettingsSchema>
