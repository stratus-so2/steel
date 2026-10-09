import {
  ChartLineData01Icon,
  Csv01Icon,
  DashboardSquare01Icon,
  FilterHorizontalIcon,
  Globe02Icon,
  Layout01Icon,
  Note01Icon,
  PieChartIcon,
  RefreshIcon,
  RepeatIcon,
  Table01Icon,
  Tv01Icon,
} from '@hugeicons-pro/core-stroke-rounded'
import type { ProductPage } from '@/src/schemas/web-product-page.schema'

export const dashboardsPage: ProductPage = {
  slug: 'dashboards',
  kind: 'feature',
  template: 'rhythm',
  label: 'Dashboards e modo TV',
  meta: {
    title: 'Dashboards e modo TV para o time | Steel',
    description:
      'Painéis com gráficos, tabelas e indicadores sobre chamados, vendas e conversas, e um modo TV em tela cheia que se atualiza e alterna sozinho.',
  },
  hero: {
    eyebrow: 'Dashboards e modo TV',
    title: 'A operação inteira num painel que o time inteiro enxerga',
    subtitle:
      'Monte painéis com gráficos, tabelas e indicadores sobre os dados do ServiceDesk, do CRM e do WhatsApp. Coloque na TV da sala e deixe atualizar sozinho.',
    window: {
      title: 'ServiceDesk',
      nav: ['Início', 'Chamados', 'Painéis', 'Análise de risco'],
      active: 2,
      body: {
        kind: 'stats',
        items: [
          {
            label: 'Abertos agora',
            value: '38',
            delta: '−6 desde ontem',
            tone: 'success',
          },
          {
            label: 'SLA de solução',
            value: '91%',
            delta: '+3 pts no mês',
            tone: 'success',
          },
          {
            label: 'Em risco',
            value: '4',
            delta: '2 críticos',
            tone: 'warning',
          },
          { label: 'CSAT', value: '4,7', delta: 'de 5', tone: 'neutral' },
        ],
      },
      aside: {
        kind: 'chart',
        title: 'Chamados por dia',
        variant: 'area',
        points: [30, 42, 38, 55, 48, 62, 58, 44, 50, 66],
        caption: '10 dias',
      },
    },
  },
  highlights: {
    eyebrow: 'Indicador e progresso',
    title: 'Números que mostram, de relance, se o dia está bom',
    subtitle:
      'Cada módulo já vem com painéis prontos, e qualquer um pode ser ajustado ou criado do zero.',
    items: [
      {
        title: 'Gráficos de verdade',
        description:
          'Barras verticais e horizontais, linhas, pizza e números agregados, sobre as fontes de dados de cada módulo.',
        visual: {
          kind: 'chart',
          title: 'Chamados resolvidos por semana',
          variant: 'bars',
          points: [40, 52, 47, 61, 58, 72, 69, 80],
        },
      },
      {
        title: 'Painéis prontos',
        description:
          'O ServiceDesk chega com os painéis "Analítico" e "KPIs (TV)" semeados, prontos para usar no primeiro dia.',
        visual: {
          kind: 'list',
          title: 'Painéis do ServiceDesk',
          items: [
            { label: 'Analítico', meta: 'Padrão', tone: 'brand' },
            { label: 'KPIs (TV)', meta: 'Padrão', tone: 'brand' },
            { label: 'Fila do N2', meta: 'Criado pelo time', tone: 'neutral' },
          ],
        },
      },
      {
        title: 'Filtros por widget',
        description:
          'Cada widget tem a sua fonte e os seus filtros: por departamento, cliente, prioridade ou período.',
        visual: {
          kind: 'fields',
          title: 'Widget · SLA por departamento',
          rows: [
            { label: 'Fonte', value: 'Chamados' },
            { label: 'Tipo', value: 'Barras horizontais' },
            { label: 'Agrupar por', value: 'Departamento' },
            { label: 'Período', value: 'Últimos 30 dias' },
          ],
        },
      },
    ],
  },
  rows: [
    {
      eyebrow: 'Modo TV',
      title: 'Na parede da operação, sem ninguém mexer',
      description:
        'O modo TV abre o painel em tela cheia e se atualiza sozinho. Com vários painéis, ele alterna entre eles no intervalo que você definir.',
      bullets: [
        { icon: Tv01Icon, text: 'Tela cheia, pensada para leitura de longe' },
        { icon: RefreshIcon, text: 'Atualização automática dos números' },
        {
          icon: RepeatIcon,
          text: 'Rodízio entre painéis, com intervalo configurável',
        },
      ],
      visual: {
        kind: 'stats',
        items: [
          { label: 'Fila agora', value: '38', tone: 'neutral' },
          {
            label: 'Em risco',
            value: '4',
            delta: '2 críticos',
            tone: 'warning',
          },
          {
            label: 'SLA hoje',
            value: '94%',
            delta: 'meta 90%',
            tone: 'success',
          },
          { label: 'Violados', value: '1', delta: 'INC-1027', tone: 'danger' },
        ],
      },
    },
    {
      eyebrow: 'Layout',
      title: 'Arraste, redimensione e organize como quiser',
      description:
        'Os widgets ficam numa grade livre: gráficos, tabelas de registros, textos e páginas incorporadas, do tamanho que a informação pede.',
      bullets: [
        { icon: Layout01Icon, text: 'Grade com arrastar e redimensionar' },
        {
          icon: Table01Icon,
          text: 'Tabelas de registros ao lado dos gráficos',
        },
        { icon: Note01Icon, text: 'Blocos de texto e páginas incorporadas' },
      ],
      visual: {
        kind: 'kanban',
        columns: [
          {
            title: 'Gráfico',
            tone: 'brand',
            cards: [
              { title: 'Chamados por dia', meta: 'Linha' },
              { title: 'Por prioridade', meta: 'Pizza' },
            ],
          },
          {
            title: 'Tabela',
            tone: 'info',
            cards: [{ title: 'Chamados em risco', meta: 'Registros' }],
          },
          {
            title: 'Texto',
            tone: 'neutral',
            cards: [{ title: 'Avisos do turno', meta: 'Texto rico' }],
          },
        ],
      },
    },
  ],
  ai: {
    eyebrow: 'Números com contexto',
    title: 'Do gráfico à pergunta, sem trocar de tela',
    items: [
      {
        title: 'Peça um painel à Steel AI',
        description:
          'Descreva o que quer acompanhar e a Steel AI propõe o dashboard do CRM — você confirma antes de criar.',
        visual: {
          kind: 'chat',
          messages: [
            {
              from: 'user',
              text: 'Crie um painel com receita ganha por mês e conversão por etapa.',
            },
          ],
          action: {
            title: 'Criar dashboard',
            preview: 'Vendas · 2 widgets: receita por mês, conversão por etapa',
            confirm: 'Confirmar',
          },
        },
      },
      {
        title: 'Pergunte o porquê',
        description:
          'O número subiu? Pergunte à Steel AI, que lê os mesmos dados do painel.',
        visual: {
          kind: 'chat',
          messages: [
            { from: 'user', text: 'Por que o SLA caiu ontem?' },
            {
              from: 'ai',
              text: '3 incidentes críticos de VPN entraram juntos às 9h no N2, que estava com 2 pessoas.',
            },
          ],
        },
      },
      {
        title: 'Risco preditivo',
        description:
          'A tela de análise de risco ordena a fila pela chance de violar, com o motivo de cada nota.',
        visual: {
          kind: 'meters',
          title: 'Fila por risco',
          items: [
            { label: 'Alto', value: 15, tone: 'danger', meta: '4' },
            { label: 'Médio', value: 30, tone: 'warning', meta: '11' },
            { label: 'Baixo', value: 55, tone: 'success', meta: '23' },
          ],
        },
      },
      {
        title: 'Resumo executivo',
        description:
          'Um agente pronto escreve, toda segunda, o resumo da semana dos módulos habilitados.',
        visual: {
          kind: 'article',
          title: 'Semana 41',
          tag: 'Steel Agent',
          lines: ['Destaques', 'Pontos de atenção'],
        },
      },
      {
        title: 'Relatório de SLA no e-mail',
        description:
          'O que o painel mostra por dentro, o relatório agendado leva ao cliente em PDF e CSV.',
        visual: {
          kind: 'list',
          title: 'Relatórios agendados',
          items: [
            {
              label: 'Acme Varejo · mensal',
              meta: 'Dia 1, 08:00',
              tone: 'brand',
            },
            {
              label: 'Rede Sol · mensal',
              meta: 'Dia 3, 09:00',
              tone: 'neutral',
            },
          ],
        },
      },
    ],
  },
  details: {
    eyebrow: 'Em todos os módulos',
    title: 'Um motor de painéis para o workspace inteiro',
    subtitle: 'O mesmo editor no ServiceDesk, no CRM e na Comunicação.',
    items: [
      {
        title: 'Painéis por módulo',
        description:
          'Cada módulo lista os próprios painéis, sobre as próprias fontes de dados.',
        icon: DashboardSquare01Icon,
      },
      {
        title: 'Cinco tipos de gráfico',
        description:
          'Barras verticais, barras horizontais, linha, pizza e número agregado.',
        icon: PieChartIcon,
      },
      {
        title: 'Relatórios do CRM',
        description:
          'Relatórios salvos com filtros e colunas, além dos painéis.',
        icon: ChartLineData01Icon,
      },
      {
        title: 'Relatórios da Comunicação',
        description:
          'Relatórios próprios sobre as conversas e mensagens do WhatsApp.',
        icon: Csv01Icon,
      },
      {
        title: 'Filtros por widget',
        description: 'Cada widget com a própria fonte, agrupamento e filtros.',
        icon: FilterHorizontalIcon,
      },
      {
        title: 'Páginas incorporadas',
        description:
          'Traga para o painel uma página externa que o time já acompanha.',
        icon: Globe02Icon,
      },
    ],
  },
  connected: {
    eyebrow: 'Recursos conectados',
    title: 'Todo módulo vira número',
    subtitle: 'Os painéis leem os mesmos dados que o time usa no dia a dia.',
    items: [
      {
        title: 'ServiceDesk',
        description:
          'Fila, SLA, MTTR, CSAT e chamados por cliente, departamento e prioridade.',
        href: '/product/servicedesk',
        visual: {
          kind: 'stats',
          items: [
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
        title: 'CRM',
        description:
          'Receita, funil, conversão por etapa e previsão de vendas.',
        href: '/product/crm',
        visual: {
          kind: 'chart',
          title: 'Receita ganha por mês',
          variant: 'area',
          points: [30, 38, 35, 50, 58, 55, 70, 78],
          caption: 'R$ mil',
        },
      },
      {
        title: 'Comunicação',
        description:
          'Volume de conversas e mensagens do WhatsApp nos painéis da Comunicação.',
        href: '/product/comunicacao',
        visual: {
          kind: 'chart',
          title: 'Conversas por dia',
          variant: 'bars',
          points: [45, 60, 52, 70, 66, 30, 22],
        },
      },
      {
        title: 'SLA e OLA',
        description:
          'Os indicadores de prazo no painel são os mesmos do relatório que o cliente recebe.',
        href: '/features/sla',
        visual: {
          kind: 'meters',
          title: 'SLA do mês',
          items: [
            { label: 'Primeira resposta', value: 97, tone: 'success' },
            { label: 'Solução', value: 91, tone: 'success' },
          ],
        },
      },
    ],
  },
  cta: {
    title: 'Ponha os números da operação na parede',
    subtitle:
      'Os painéis padrão já vêm prontos. Abra o modo TV e veja a operação em tempo real.',
  },
}
