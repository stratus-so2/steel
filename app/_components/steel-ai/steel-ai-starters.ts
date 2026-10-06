import {
  Ticket01Icon,
  UserGroupIcon,
  WhatsappBusinessIcon,
} from '@hugeicons-pro/core-stroke-rounded'
import type { AiConversationModeDTO, AiModuleDTO } from '@/types/steel-ai'

export interface SteelAiStarter {
  module: AiModuleDTO
  label: string
  prompt: string
  mode: AiConversationModeDTO
}

export const STEEL_AI_MODULE_META: Record<
  AiModuleDTO,
  { label: string; icon: typeof Ticket01Icon }
> = {
  SERVICE_DESK: { label: 'ServiceDesk', icon: Ticket01Icon },
  CRM: { label: 'CRM', icon: UserGroupIcon },
  COMMUNICATION: { label: 'Comunicação', icon: WhatsappBusinessIcon },
}

const STARTERS: SteelAiStarter[] = [
  {
    module: 'SERVICE_DESK',
    label: 'Chamados com SLA em risco',
    prompt: 'Quais chamados abertos estão com o SLA em risco hoje?',
    mode: 'EXPLORE',
  },
  {
    module: 'SERVICE_DESK',
    label: 'Resumo dos incidentes da semana',
    prompt: 'Resuma os incidentes abertos nesta semana por prioridade.',
    mode: 'EXPLORE',
  },
  {
    module: 'CRM',
    label: 'Pipeline por estágio',
    prompt: 'Qual o valor total do meu pipeline por estágio?',
    mode: 'EXPLORE',
  },
  {
    module: 'CRM',
    label: 'Criar tarefas de follow-up',
    prompt:
      'Crie tarefas de follow-up para as minhas oportunidades sem atividade há mais de 7 dias.',
    mode: 'AGENT',
  },
  {
    module: 'COMMUNICATION',
    label: 'Conversas aguardando resposta',
    prompt:
      'Quais conversas do WhatsApp estão aguardando resposta há mais tempo?',
    mode: 'EXPLORE',
  },
  {
    module: 'COMMUNICATION',
    label: 'Sentimento dos clientes',
    prompt:
      'Como está o sentimento dos clientes nas conversas dos últimos 7 dias?',
    mode: 'EXPLORE',
  },
]

/** Prompt starters for the modules enabled in the workspace. */
export function steelAiStartersFor(
  modules: AiModuleDTO[],
  agentModeEnabled: boolean,
): SteelAiStarter[] {
  return STARTERS.filter(
    (starter) =>
      modules.includes(starter.module) &&
      (starter.mode === 'EXPLORE' || agentModeEnabled),
  )
}
