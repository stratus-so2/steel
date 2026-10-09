import {
  Activity01Icon,
  CheckmarkCircle02Icon,
  Clock01Icon,
  FilterHorizontalIcon,
  GitBranchIcon,
  Layers01Icon,
  Mail01Icon,
  RepeatIcon,
  SignatureIcon,
  TimeScheduleIcon,
  UserGroupIcon,
  WebhookIcon,
} from '@hugeicons-pro/core-stroke-rounded'
import type { ProductPage } from '@/src/schemas/web-product-page.schema'

export const workflowsPage: ProductPage = {
  slug: 'workflows',
  kind: 'feature',
  template: 'rhythm',
  label: 'Workflows e Aprovações',
  meta: {
    title: 'Workflows, automações e aprovações por e-mail | Steel',
    description:
      'Workflows visuais no CRM, regras de automação no ServiceDesk e aprovações por e-mail ou pelo CAB, com histórico de cada execução.',
  },
  hero: {
    eyebrow: 'Workflows e Aprovações',
    title:
      'O trabalho repetitivo roda sozinho. O que importa espera a sua aprovação.',
    subtitle:
      'Desenhe o fluxo uma vez — gatilho, condições e ações — e acompanhe cada execução. Quando a decisão é de alguém, ela chega por e-mail com um link para aprovar.',
    window: {
      title: 'CRM',
      nav: ['Leads', 'Oportunidades', 'Workflows', 'Formulários', 'Relatórios'],
      active: 2,
      body: {
        kind: 'flow',
        steps: [
          {
            label: 'Quando: lead ganho',
            detail: 'Gatilho · registro atualizado',
            tone: 'success',
          },
          {
            label: 'Criar empresa',
            detail: 'Com os dados do lead',
            tone: 'info',
          },
          {
            label: 'Se valor > R$ 20 mil',
            detail: 'Condição',
            tone: 'warning',
          },
          {
            label: 'Criar tarefa de onboarding',
            detail: 'Para o gerente de contas',
            tone: 'brand',
          },
          {
            label: 'Enviar e-mail de boas-vindas',
            detail: 'Modelo: Boas-vindas',
            tone: 'brand',
          },
        ],
      },
      aside: {
        kind: 'timeline',
        items: [
          {
            actor: 'Execução #214',
            action: 'concluída · 5 passos',
            time: '10:42',
          },
          {
            actor: 'Execução #213',
            action: 'concluída · 3 passos',
            time: '09:15',
          },
          {
            actor: 'Execução #212',
            action: 'aguardando atraso de 2 dias',
            time: 'ontem',
          },
          {
            actor: 'Execução #211',
            action: 'falhou no passo 4',
            time: 'ontem',
          },
        ],
      },
    },
  },
  highlights: {
    eyebrow: 'Gatilho e execução',
    title: 'Cada fluxo com começo, meio e histórico',
    subtitle:
      'Do evento que dispara ao último passo executado, tudo fica registrado para você conferir.',
    items: [
      {
        title: 'Gatilhos para cada situação',
        description:
          'Registro criado, atualizado ou excluído, lead ganho ou perdido, agenda, webhook de outro sistema ou execução manual.',
        visual: {
          kind: 'list',
          title: 'Gatilhos',
          items: [
            { label: 'Registro criado ou atualizado', tone: 'brand' },
            { label: 'Lead mudou de etapa, ganho ou perdido', tone: 'success' },
            { label: 'Agenda', tone: 'info' },
            { label: 'Webhook', tone: 'neutral' },
          ],
        },
      },
      {
        title: 'Condições, laços e esperas',
        description:
          'Filtros, se/senão, iteração sobre registros encontrados e atrasos em minutos, horas ou dias.',
        visual: {
          kind: 'flow',
          steps: [
            { label: 'Buscar oportunidades paradas', tone: 'info' },
            { label: 'Para cada uma', tone: 'neutral' },
            { label: 'Esperar 2 dias', tone: 'warning' },
            { label: 'Rascunhar e-mail de follow-up', tone: 'brand' },
          ],
        },
      },
      {
        title: 'Versões sem susto',
        description:
          'Você edita sempre um rascunho. Ativar congela a versão, arquiva a anterior e mantém o histórico.',
        visual: {
          kind: 'list',
          title: 'Versões · Boas-vindas',
          items: [
            { label: 'v4 · rascunho', meta: 'Editando', tone: 'warning' },
            { label: 'v3 · ativa', meta: 'Desde 02/10', tone: 'success' },
            { label: 'v2 · arquivada', meta: '18/09', tone: 'neutral' },
          ],
        },
      },
    ],
  },
  rows: [
    {
      eyebrow: 'Automação no ServiceDesk',
      title: 'Regras que tratam o chamado no instante em que algo acontece',
      description:
        'Evento, condições e ações, avaliadas em ordem. Abriu, mudou de fase, chegou mensagem, a aprovação respondeu, o SLA entrou em risco ou estourou — a regra age.',
      bullets: [
        {
          icon: Activity01Icon,
          text: 'Sete eventos, do chamado criado ao SLA violado',
        },
        {
          icon: FilterHorizontalIcon,
          text: 'Condições por campo, com "parar aqui" para encerrar a avaliação',
        },
        {
          icon: UserGroupIcon,
          text: 'Atribuir, rodízio, notificar, tarefa, modelo, escalar',
        },
      ],
      visual: {
        kind: 'flow',
        steps: [
          { label: 'Quando: chamado criado', tone: 'info' },
          {
            label: 'Se cliente = Acme e prioridade = Crítica',
            tone: 'warning',
          },
          { label: 'Atribuir ao time N2 em rodízio', tone: 'brand' },
          { label: 'Notificar o líder', tone: 'success' },
        ],
      },
    },
    {
      eyebrow: 'Aprovações',
      title: 'Aprovar pelo e-mail, sem precisar de conta no Steel',
      description:
        'O aprovador recebe um link seguro, aprova ou reprova com comentário, e a resposta volta ao chamado como evento. Mudanças podem passar por rodadas do CAB antes de seguir.',
      bullets: [
        { icon: Mail01Icon, text: 'Link de aprovação com validade, sem login' },
        {
          icon: CheckmarkCircle02Icon,
          text: 'Fases que só avançam com aprovação vigente',
        },
        {
          icon: Layers01Icon,
          text: 'Rodadas de aprovação do CAB para mudanças',
        },
      ],
      visual: {
        kind: 'form',
        title: 'CHG-0087 · Atualizar firmware do firewall',
        fields: [
          { label: 'Janela', value: 'Sábado, 22:00 – 23:30' },
          {
            label: 'Comentário',
            value: 'De acordo, com rollback documentado.',
          },
        ],
        button: 'Aprovar mudança',
      },
    },
  ],
  ai: {
    eyebrow: 'Agentes e aprovações',
    title: 'Quando a automação precisa pensar, entram os Steel Agents',
    items: [
      {
        title: 'Agentes com aprovação por ferramenta',
        description:
          'Cada escrita de um agente é automática ou requer aprovação. Exclusão sempre requer, e a decisão acontece na caixa de entrada.',
        visual: {
          kind: 'chat',
          messages: [
            {
              from: 'ai',
              text: 'Execução do agente "Chamados sem responsável" aguardando aprovação.',
            },
          ],
          action: {
            title: 'Atribuir chamado · INC-1047',
            preview: 'Responsável: ninguém → Bruno Costa',
            confirm: 'Aprovar',
          },
        },
      },
      {
        title: 'Gatilhos por evento',
        description:
          'Agentes podem rodar quando um chamado é criado, um lead entra ou uma conversa é atribuída.',
        visual: {
          kind: 'list',
          title: 'Eventos',
          items: [
            { label: 'Chamado criado', tone: 'brand' },
            { label: 'Lead criado', tone: 'success' },
            { label: 'Conversa atribuída', tone: 'info' },
            { label: 'IA passou a conversa para humano', tone: 'neutral' },
          ],
        },
      },
      {
        title: 'Teste antes de ativar',
        description:
          'O botão "Testar agente" roda tudo de verdade nas leituras e só simula as escritas.',
        visual: {
          kind: 'list',
          title: 'O que o agente faria',
          items: [
            {
              label: 'Atribuir INC-1047 a Bruno',
              meta: 'Simulado',
              tone: 'neutral',
            },
            {
              label: 'Nota interna no INC-1042',
              meta: 'Simulado',
              tone: 'neutral',
            },
          ],
        },
      },
      {
        title: 'Aprovação vale por 72 h',
        description:
          'Aprovações de agente expiram em 72 horas, e ações do assistente avisam antes de vencer.',
        visual: {
          kind: 'meters',
          title: 'Pendências',
          items: [
            {
              label: 'Tempo restante',
              value: 35,
              tone: 'warning',
              meta: '25 h',
            },
          ],
        },
      },
      {
        title: 'Tudo registrado',
        description:
          'Cada passo do agente — chamada ao modelo, ferramenta e aprovação — fica na linha do tempo da execução.',
        visual: {
          kind: 'timeline',
          items: [
            { actor: 'Modelo', action: 'planejou 2 ações', time: '09:00' },
            {
              actor: 'Ferramenta',
              action: 'leu a fila sem responsável',
              time: '09:00',
            },
            { actor: 'Ana', action: 'aprovou a atribuição', time: '09:07' },
          ],
        },
      },
    ],
  },
  details: {
    eyebrow: 'Por dentro do motor',
    title: 'Automação que dá para confiar',
    subtitle: 'Os cuidados que evitam o fluxo que dispara sem parar.',
    items: [
      {
        title: 'Sem laço infinito',
        description:
          'Ações de automação do ServiceDesk não disparam novas automações.',
        icon: RepeatIcon,
      },
      {
        title: 'Histórico de execuções',
        description:
          'Cada execução de workflow com status e o resultado de cada passo.',
        icon: Clock01Icon,
      },
      {
        title: 'Agenda e webhook',
        description:
          'Workflows que rodam por horário ou quando outro sistema chama.',
        icon: WebhookIcon,
      },
      {
        title: 'Ramificações',
        description: 'Se/senão e filtros para tratar cada caso de um jeito.',
        icon: GitBranchIcon,
      },
      {
        title: 'Assinatura no encerramento',
        description:
          'Fases que exigem a assinatura do cliente para encerrar o chamado.',
        icon: SignatureIcon,
      },
      {
        title: 'Rotinas recorrentes',
        description:
          'Chamados que abrem sozinhos por agenda, no fuso de cada rotina.',
        icon: TimeScheduleIcon,
      },
    ],
  },
  connected: {
    eyebrow: 'Recursos conectados',
    title: 'Automação em todo o workspace',
    subtitle:
      'Workflows no CRM, regras no ServiceDesk e agentes acima de tudo.',
    items: [
      {
        title: 'CRM',
        description:
          'Workflows sobre empresas, pessoas, oportunidades, tarefas, notas e leads.',
        href: '/product/crm',
        visual: {
          kind: 'flow',
          steps: [
            { label: 'Oportunidade atualizada', tone: 'info' },
            { label: 'Se etapa = Negociação', tone: 'warning' },
            { label: 'Criar tarefa de proposta', tone: 'brand' },
          ],
        },
      },
      {
        title: 'ServiceDesk',
        description:
          'Regras de automação, escalonamento e aprovações no ciclo do chamado.',
        href: '/product/servicedesk',
        visual: {
          kind: 'fields',
          code: 'CHG-0087',
          title: 'Atualizar firmware do firewall',
          chips: [{ label: 'Aprovada', tone: 'success' }],
          rows: [
            { label: 'Aprovador', value: 'Carlos (CAB)' },
            { label: 'Respondido', value: 'por e-mail, 14:22' },
          ],
        },
      },
      {
        title: 'Steel AI',
        description:
          'Os Steel Agents trazem o raciocínio para as automações, com aprovação.',
        href: '/product/steel-ai',
        visual: {
          kind: 'stats',
          items: [
            { label: 'Execuções no mês', value: '312', tone: 'neutral' },
            { label: 'Aprovações pendentes', value: '3', tone: 'warning' },
          ],
        },
      },
      {
        title: 'SLA e OLA',
        description: 'Regras disparadas por "SLA em risco" e "SLA violado".',
        href: '/features/sla',
        visual: {
          kind: 'flow',
          steps: [
            { label: 'Quando: SLA violado', tone: 'danger' },
            { label: 'Escalar hierarquicamente', tone: 'brand' },
          ],
        },
      },
    ],
  },
  cta: {
    title: 'Automatize o repetitivo, aprove o que importa',
    subtitle:
      'Comece com uma regra simples no ServiceDesk ou um workflow no CRM — e vá crescendo.',
  },
}
