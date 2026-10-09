import {
  AlarmClockIcon,
  Alert02Icon,
  ArrowUp01Icon,
  Calendar03Icon,
  Csv01Icon,
  Mail01Icon,
  Notification01Icon,
  PauseCircleIcon,
  Route01Icon,
  Target01Icon,
  TimeScheduleIcon,
  UserSwitchIcon,
} from '@hugeicons-pro/core-stroke-rounded'
import type { ProductPage } from '@/src/schemas/web-product-page.schema'

export const slaPage: ProductPage = {
  slug: 'sla',
  kind: 'feature',
  template: 'rhythm',
  label: 'SLA e OLA',
  meta: {
    title: 'SLA e OLA sobre calendário útil | Steel',
    description:
      'Prazos de resposta e solução contados em minutos úteis, com pausa por fase, alerta de risco, escalonamento automático e relatório de SLA agendado.',
  },
  hero: {
    eyebrow: 'SLA e OLA',
    title: 'Prazos que contam o tempo certo, e avisam antes de estourar',
    subtitle:
      'O relógio do Steel conhece o expediente, os feriados e as pausas de cada cliente. Quem atende vê o risco cedo, e o líder fica sabendo antes da violação.',
    window: {
      title: 'ServiceDesk',
      nav: [
        'Início',
        'Chamados',
        'Análise de risco',
        'Painéis',
        'Configurações',
      ],
      active: 0,
      body: {
        kind: 'table',
        columns: ['Chamado', 'Prioridade', 'Resposta', 'Solução'],
        rows: [
          ['INC-1042', 'Crítica', 'Cumprido', 'Em risco · 40 min'],
          ['INC-1039', 'Média', 'Cumprido', '3 h 20 min úteis'],
          ['REQ-0318', 'Baixa', '1 h 05 min', '2 dias úteis'],
          ['REQ-0311', 'Baixa', 'Cumprido', 'Pausado'],
          ['INC-1027', 'Alta', 'Cumprido', 'Violado há 15 min'],
        ],
      },
      aside: {
        kind: 'meters',
        title: 'SLA do mês',
        items: [
          { label: 'Primeira resposta', value: 97, tone: 'success' },
          { label: 'Solução', value: 91, tone: 'success' },
          {
            label: 'Em risco agora',
            value: 12,
            tone: 'warning',
            meta: '4 chamados',
          },
          {
            label: 'Violados no mês',
            value: 4,
            tone: 'danger',
            meta: '6 chamados',
          },
        ],
      },
    },
  },
  highlights: {
    eyebrow: 'Prazo e progresso',
    title: 'Cada minuto contado no calendário de quem você atende',
    subtitle:
      'Política de SLA por condição, calendário de expediente e risco verificado a cada minuto.',
    items: [
      {
        title: 'Minutos úteis, não minutos corridos',
        description:
          'Expediente por dia da semana, feriados e fuso do calendário. Um prazo de 4 horas aberto às 17h de sexta vence na segunda.',
        visual: {
          kind: 'fields',
          title: 'Calendário · Matriz São Paulo',
          rows: [
            { label: 'Fuso', value: 'America/Sao_Paulo' },
            { label: 'Seg a sex', value: '08:00 – 18:00' },
            { label: 'Sábado', value: '08:00 – 12:00' },
            { label: 'Feriados', value: '12 cadastrados' },
          ],
        },
      },
      {
        title: 'Pausa onde faz sentido',
        description:
          'Fases como "Aguardando cliente" param o relógio. Quando o chamado volta, os minutos pausados entram no prazo sozinhos.',
        visual: {
          kind: 'timeline',
          items: [
            { actor: 'Relógio', action: 'iniciado na abertura', time: '09:02' },
            {
              actor: 'Ana',
              action: 'moveu para Aguardando cliente',
              time: '10:15',
            },
            { actor: 'Relógio', action: 'pausado', time: '10:15' },
            {
              actor: 'Cliente',
              action: 'respondeu · relógio retomado',
              time: '14:40',
            },
          ],
        },
      },
      {
        title: 'Risco antes da violação',
        description:
          'A partir do percentual de risco da política, o chamado ganha o selo "Em risco" e o responsável e os líderes são avisados.',
        visual: {
          kind: 'meters',
          title: 'INC-1042 · prazo de solução',
          items: [
            {
              label: 'Consumido',
              value: 82,
              tone: 'warning',
              meta: '82% · em risco',
            },
            {
              label: 'Primeira resposta',
              value: 100,
              tone: 'success',
              meta: 'Cumprida',
            },
          ],
        },
      },
    ],
  },
  rows: [
    {
      eyebrow: 'Políticas',
      title: 'Um SLA para cada contrato, escolhido sozinho',
      description:
        'As políticas são avaliadas em ordem pelas condições do chamado — cliente, tipo, prioridade, categoria, departamento ou canal. A primeira que casa define as metas; sem nenhuma, vale a do catálogo ou a padrão.',
      bullets: [
        {
          icon: Route01Icon,
          text: 'Condições por cliente, tipo, prioridade, categoria e canal',
        },
        {
          icon: Target01Icon,
          text: 'Metas de primeira resposta e de solução por prioridade',
        },
        {
          icon: Calendar03Icon,
          text: 'Calendário próprio ou 24×7 por política',
        },
      ],
      visual: {
        kind: 'list',
        title: 'Políticas de SLA',
        items: [
          { label: 'Contrato Ouro · 24×7', meta: '1º lugar', tone: 'brand' },
          { label: 'Clientes de saúde', meta: '2º lugar', tone: 'info' },
          { label: 'Mudanças', meta: '3º lugar', tone: 'neutral' },
          { label: 'Padrão do workspace', meta: 'Reserva', tone: 'neutral' },
        ],
      },
    },
    {
      eyebrow: 'Escalonamento',
      title: 'Quando o prazo aperta, o chamado sobe sozinho',
      description:
        'Regras de escalonamento rodam no relógio do worker: passam o chamado para outro time, avisam o líder ou chamam quem está de plantão fora do expediente.',
      bullets: [
        { icon: ArrowUp01Icon, text: 'Escalonamento funcional e hierárquico' },
        {
          icon: UserSwitchIcon,
          text: 'Plantão com rodízio, camadas e trocas pontuais',
        },
        {
          icon: Notification01Icon,
          text: 'Aviso no app, por e-mail ou WhatsApp, conforme a preferência',
        },
      ],
      visual: {
        kind: 'flow',
        steps: [
          {
            label: 'SLA em 80%',
            detail: 'INC-1042 · Crítica',
            tone: 'warning',
          },
          {
            label: 'Avisar líder de N2',
            detail: 'No app e por e-mail',
            tone: 'info',
          },
          {
            label: 'Passar para o plantão',
            detail: 'Camada 1 · Bruno',
            tone: 'brand',
          },
          {
            label: 'SLA cumprido',
            detail: 'Resolvido com 12 min de folga',
            tone: 'success',
          },
        ],
      },
    },
  ],
  ai: {
    eyebrow: 'Inteligência no prazo',
    title: 'Saber o que vai atrasar, e por quê',
    items: [
      {
        title: 'Risco preditivo com motivo',
        description:
          'Uma nota de 0 a 100 recalculada a cada 10 minutos, sempre com os fatores que pesaram — nunca um número solto.',
        visual: {
          kind: 'meters',
          title: 'Risco alto · 78',
          items: [
            { label: 'Fila do time acima da média', value: 80, tone: 'danger' },
            { label: 'Prazo restante curto', value: 60, tone: 'warning' },
            {
              label: 'Cliente com violações recentes',
              value: 45,
              tone: 'warning',
            },
          ],
        },
      },
      {
        title: 'Agente "SLA em risco"',
        description:
          'Um modelo pronto de Steel Agent percorre a fila a cada 30 minutos em dias úteis e propõe uma nota interna nos chamados apertados.',
        visual: {
          kind: 'chat',
          messages: [
            {
              from: 'ai',
              text: '3 chamados passam de 80% do prazo nas próximas 2 horas. Proponho uma nota interna em cada um.',
            },
          ],
          action: {
            title: 'Nota interna · INC-1042',
            preview:
              'Prazo de solução vence às 16:40. Prioridade crítica, sem resposta há 40 min.',
            confirm: 'Aprovar',
          },
        },
      },
      {
        title: 'Pergunte em linguagem natural',
        description:
          'A skill /sla responde quais chamados estão em risco agora, por time ou por cliente.',
        visual: {
          kind: 'chat',
          messages: [
            { from: 'user', text: '/sla do time N2' },
            {
              from: 'ai',
              text: '2 em risco e 1 violado. O INC-1027 venceu há 15 min e está sem responsável.',
            },
          ],
        },
      },
      {
        title: 'Incidentes repetidos',
        description:
          'Três incidentes parecidos em 7 dias viram sugestão de problema, para atacar a causa e não só o prazo.',
        visual: {
          kind: 'list',
          title: 'Sugestão de problema',
          items: [
            {
              label: 'VPN fora do ar · 3 incidentes',
              meta: '7 dias',
              tone: 'warning',
            },
            { label: 'Abrir problema', meta: 'PRB', tone: 'brand' },
          ],
        },
      },
      {
        title: 'Resumo diário',
        description:
          'Quem quiser recebe, no horário local do workspace, o resumo da própria fila com o que vence hoje.',
        visual: {
          kind: 'stats',
          items: [
            { label: 'Vencem hoje', value: '7', tone: 'warning' },
            { label: 'Em risco', value: '3', tone: 'danger' },
          ],
        },
      },
    ],
  },
  details: {
    eyebrow: 'Além do relógio',
    title: 'O SLA como contrato, não como enfeite da tela',
    subtitle: 'Do cálculo ao relatório que o cliente recebe no começo do mês.',
    items: [
      {
        title: 'Relatório de SLA agendado',
        description:
          'PDF e CSV com volume, % de SLA, violações, MTTR e CSAT, enviados aos destinatários no dia e fuso que você escolher.',
        icon: Csv01Icon,
      },
      {
        title: 'OLA entre times',
        description:
          'Políticas do tipo OLA e calendário próprio por departamento, para os times combinarem prazos entre si.',
        icon: TimeScheduleIcon,
      },
      {
        title: 'Fechamento automático',
        description:
          'Chamados resolvidos que o cliente não reabriu são encerrados sozinhos no prazo configurado.',
        icon: AlarmClockIcon,
      },
      {
        title: 'Pausa por fase',
        description:
          'Você decide quais fases param o relógio, tipo a tipo, no editor de fluxos.',
        icon: PauseCircleIcon,
      },
      {
        title: 'Aviso de violação',
        description:
          'Risco e violação são marcados uma única vez por chamado, sem enxurrada de notificações.',
        icon: Alert02Icon,
      },
      {
        title: 'Envio sem duplicar',
        description:
          'Cada período do relatório é gerado uma vez só, mesmo se o job rodar de novo.',
        icon: Mail01Icon,
      },
    ],
  },
  connected: {
    eyebrow: 'Recursos conectados',
    title: 'O prazo atravessa o atendimento inteiro',
    subtitle:
      'O SLA nasce no chamado, aparece nos painéis e chega ao cliente no relatório.',
    items: [
      {
        title: 'Chamados do ServiceDesk',
        description:
          'Prioridade pela matriz impacto × urgência e política de SLA definida na abertura.',
        href: '/product/servicedesk',
        visual: {
          kind: 'fields',
          code: 'INC-1042',
          title: 'VPN da filial fora do ar',
          chips: [{ label: 'Em risco', tone: 'warning' }],
          rows: [
            { label: 'Política', value: 'Contrato Ouro · 24×7' },
            { label: 'Solução até', value: 'Hoje, 16:40', tone: 'warning' },
          ],
        },
      },
      {
        title: 'Dashboards e modo TV',
        description:
          'SLA cumprido, em risco e violado na parede da operação, atualizando sozinho.',
        href: '/features/dashboards',
        visual: {
          kind: 'stats',
          items: [
            {
              label: 'SLA de solução',
              value: '91%',
              delta: '+3 pts',
              tone: 'success',
            },
            { label: 'Em risco', value: '4', delta: 'agora', tone: 'warning' },
            {
              label: 'MTTR',
              value: '2 h 40',
              delta: '−18 min',
              tone: 'success',
            },
            { label: 'CSAT', value: '4,7', delta: 'de 5', tone: 'neutral' },
          ],
        },
      },
      {
        title: 'Workflows e aprovações',
        description:
          'Automações disparadas por "SLA em risco" e "SLA violado" fazem o resto do trabalho.',
        href: '/features/workflows',
        visual: {
          kind: 'flow',
          steps: [
            { label: 'Quando: SLA em risco', tone: 'warning' },
            { label: 'Se prioridade = Crítica', tone: 'info' },
            { label: 'Notificar gestor e marcar tag', tone: 'brand' },
          ],
        },
      },
    ],
  },
  cta: {
    title: 'Pare de descobrir a violação no relatório do mês',
    subtitle:
      'Configure o calendário e as metas uma vez. O Steel conta, avisa e escala.',
  },
}
