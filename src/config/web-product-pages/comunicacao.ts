import {
  Alert02Icon,
  Analytics01Icon,
  Clock01Icon,
  Csv01Icon,
  Message01Icon,
  Notification01Icon,
  Shield01Icon,
  UserGroupIcon,
  UserSwitchIcon,
  WhatsappBusinessIcon,
  ZapIcon,
} from '@hugeicons-pro/core-stroke-rounded'
import type { ProductPage } from '@/src/schemas/web-product-page.schema'

export const comunicacaoPage: ProductPage = {
  slug: 'comunicacao',
  kind: 'product',
  template: 'rhythm',
  label: 'Comunicação',
  meta: {
    title: 'WhatsApp Business com caixa de entrada e disparos | Steel',
    description:
      'Atendimento no WhatsApp Business pela API oficial da Meta ou pela Z-API: caixa de entrada em tempo real, templates, respostas rápidas, disparos e IA.',
  },
  hero: {
    eyebrow: 'Comunicação',
    title: 'O WhatsApp da empresa num ritmo que o time consegue acompanhar',
    subtitle:
      'Todas as conversas numa caixa de entrada em tempo real, com dono, status e histórico. A IA responde o que sabe e passa para um humano o que não sabe.',
    window: {
      title: 'Comunicação',
      nav: [
        'Conversas',
        'Contatos',
        'Grupos',
        'Templates',
        'Respostas rápidas',
        'Transmissões',
      ],
      active: 0,
      body: {
        kind: 'chat',
        messages: [
          { from: 'contact', text: 'Oi! Meu pedido 4521 ainda não chegou.' },
          {
            from: 'ai',
            text: 'Olá, Carla! O pedido 4521 saiu para entrega hoje às 9h. Quer que eu chame um atendente?',
          },
          { from: 'contact', text: 'Quero sim, preciso trocar o endereço.' },
          {
            from: 'agent',
            text: 'Oi, Carla, aqui é o Rafael. Me passa o novo endereço que eu ajusto agora.',
          },
        ],
      },
      aside: {
        kind: 'list',
        title: 'Conversas',
        items: [
          { label: 'Carla Menezes', meta: 'Em andamento', tone: 'warning' },
          { label: 'Loja Bom Preço', meta: 'Nova', tone: 'info' },
          { label: 'Diego Rocha', meta: 'Nova', tone: 'info' },
          { label: 'Ana Paula', meta: 'Encerrada', tone: 'success' },
        ],
      },
    },
  },
  highlights: {
    eyebrow: 'Conversa e progresso',
    title: 'Cada conversa com dono, status e fim',
    subtitle:
      'Nova, em andamento, encerrada. O time sabe o que está esperando resposta, e nada se perde no celular de alguém.',
    items: [
      {
        title: 'Caixa de entrada em tempo real',
        description:
          'Mensagens chegam na hora para todo o time, com mídia, áudio, documentos e localização, sem atualizar a página.',
        visual: {
          kind: 'list',
          title: 'Caixa de entrada',
          items: [
            { label: 'Carla Menezes · áudio', meta: 'agora', tone: 'brand' },
            { label: 'Loja Bom Preço · foto', meta: '2 min', tone: 'info' },
            { label: 'Diego Rocha · documento', meta: '5 min', tone: 'info' },
          ],
        },
      },
      {
        title: 'Atribuição e histórico',
        description:
          'Atribua a conversa a quem vai atender. Encerrar, reabrir e transferir aparecem na linha do tempo, entre as mensagens.',
        visual: {
          kind: 'timeline',
          items: [
            {
              actor: 'Carla',
              action: 'enviou a primeira mensagem',
              time: '09:12',
            },
            {
              actor: 'IA',
              action: 'respondeu e passou para humano',
              time: '09:13',
            },
            { actor: 'Rafael', action: 'assumiu a conversa', time: '09:15' },
            { actor: 'Rafael', action: 'encerrou a conversa', time: '09:31' },
          ],
        },
      },
      {
        title: 'Encerramento por inatividade',
        description:
          'Conversa parada há horas encerra sozinha, e reabre no momento em que o contato volta a escrever.',
        visual: {
          kind: 'toggles',
          title: 'Conexão · Atendimento',
          items: [
            { label: 'Encerrar após 24 h sem resposta', on: true },
            { label: 'Resposta automática da IA', on: true },
            { label: 'IA lê imagens e transcreve áudios', on: false },
          ],
        },
      },
    ],
  },
  rows: [
    {
      eyebrow: 'Conexões',
      title: 'API oficial da Meta ou Z-API, você escolhe',
      description:
        'Conecte o número pela WhatsApp Cloud API da Meta, com templates aprovados, ou pela Z-API, lendo um QR code. O ServiceDesk pode ter a própria conexão, separada da do comercial.',
      bullets: [
        {
          icon: WhatsappBusinessIcon,
          text: 'Meta Cloud API com templates aprovados',
        },
        { icon: ZapIcon, text: 'Z-API para começar em minutos' },
        { icon: Notification01Icon, text: 'Estado da conexão sempre visível' },
      ],
      visual: {
        kind: 'list',
        title: 'Conexões',
        items: [
          {
            label: 'Comercial · Meta Cloud API',
            meta: 'Conectada',
            tone: 'success',
          },
          { label: 'Suporte · Z-API', meta: 'Conectada', tone: 'success' },
          { label: 'Cobrança · Z-API', meta: 'Desconectada', tone: 'danger' },
        ],
      },
    },
    {
      eyebrow: 'Transmissões',
      title: 'Disparos em massa que respeitam quem pediu para sair',
      description:
        'Importe a lista por CSV, escolha o template e agende o envio. Quem respondeu com a palavra de descadastro fica de fora, como manda a LGPD.',
      bullets: [
        { icon: Csv01Icon, text: 'Lista de contatos importada por CSV' },
        {
          icon: Clock01Icon,
          text: 'Envio agendado e acompanhamento por contato',
        },
        {
          icon: Shield01Icon,
          text: 'Descadastro por palavra-chave respeitado no disparo',
        },
      ],
      visual: {
        kind: 'meters',
        title: 'Transmissão · Promoção de outubro',
        items: [
          {
            label: 'Enviadas',
            value: 92,
            tone: 'success',
            meta: '1.840 de 2.000',
          },
          { label: 'Com falha', value: 3, tone: 'danger', meta: '58' },
          {
            label: 'Descadastradas (puladas)',
            value: 5,
            tone: 'neutral',
            meta: '102',
          },
        ],
      },
    },
  ],
  ai: {
    eyebrow: 'IA na conversa',
    title: 'Uma IA que responde com o que a sua empresa sabe',
    items: [
      {
        title: 'Resposta automática com base de conhecimento',
        description:
          'Suba documentos com as políticas, preços e prazos. A IA responde a partir deles, com as instruções que você escrever.',
        visual: {
          kind: 'chat',
          messages: [
            { from: 'contact', text: 'Vocês entregam no sábado?' },
            {
              from: 'ai',
              text: 'Entregamos sim, das 8h às 12h, para pedidos feitos até sexta às 16h.',
            },
          ],
        },
      },
      {
        title: 'Passa para um humano na hora certa',
        description:
          'Quando a pergunta foge do que a IA sabe, ela entrega a conversa ao time — e um Steel Agent pode ser acionado por esse evento.',
        visual: {
          kind: 'flow',
          steps: [
            { label: 'IA sem resposta segura', tone: 'warning' },
            { label: 'Conversa vai para a fila', tone: 'info' },
            { label: 'Atendente assume', tone: 'success' },
          ],
        },
      },
      {
        title: 'Análise de sentimento',
        description:
          'Cada mensagem recebe um sentimento, e uma conversa que azeda gera um alerta na linha do tempo.',
        visual: {
          kind: 'meters',
          title: 'Sentimento da conversa',
          items: [
            { label: 'Positivo', value: 20, tone: 'success' },
            { label: 'Negativo', value: 65, tone: 'danger', meta: 'Alerta' },
          ],
        },
      },
      {
        title: 'Imagens e áudios',
        description:
          'Ligue a leitura de mídia e a IA entende a foto do produto e transcreve o áudio do cliente.',
        visual: {
          kind: 'chat',
          messages: [
            { from: 'contact', text: 'Áudio · 0:14' },
            {
              from: 'ai',
              text: 'Transcrição: "a caixa chegou amassada, dá para trocar?"',
            },
          ],
        },
      },
      {
        title: 'Conversas sem resposta',
        description:
          'Um agente pronto percorre a caixa de hora em hora nos dias úteis e propõe a atribuição das conversas esquecidas.',
        visual: {
          kind: 'stats',
          items: [
            { label: 'Sem resposta', value: '6', tone: 'warning' },
            { label: 'Atribuições sugeridas', value: '6', tone: 'brand' },
          ],
        },
      },
    ],
  },
  details: {
    eyebrow: 'Além da conversa',
    title: 'Pensado para quem atende o dia inteiro',
    subtitle: 'Os detalhes que fazem o atendimento render sem virar bagunça.',
    items: [
      {
        title: 'Respostas rápidas',
        description:
          'Textos prontos para as perguntas de sempre, a um clique de distância.',
        icon: Message01Icon,
      },
      {
        title: 'Templates da Meta',
        description:
          'Templates aprovados pela Meta para iniciar conversa fora da janela de 24 horas.',
        icon: WhatsappBusinessIcon,
      },
      {
        title: 'Contatos e grupos',
        description:
          'Agenda de contatos do workspace e acompanhamento dos grupos da conexão.',
        icon: UserGroupIcon,
      },
      {
        title: 'Transferência entre atendentes',
        description:
          'Passe a conversa para outra pessoa sem perder nada do que já foi dito.',
        icon: UserSwitchIcon,
      },
      {
        title: 'Painéis e relatórios',
        description:
          'Painéis e relatórios do módulo sobre conversas, mensagens e atendimento.',
        icon: Analytics01Icon,
      },
      {
        title: 'Alerta de humor',
        description:
          'Conversas com sentimento negativo ganham destaque antes de virar reclamação.',
        icon: Alert02Icon,
      },
    ],
  },
  connected: {
    eyebrow: 'Recursos conectados',
    title: 'A conversa não termina no WhatsApp',
    subtitle:
      'O que começa numa mensagem pode virar venda, chamado ou tarefa, no mesmo workspace.',
    items: [
      {
        title: 'ServiceDesk',
        description:
          'Com a conexão do ServiceDesk, a mensagem abre o chamado ou entra no chamado aberto do contato, na aba WhatsApp.',
        href: '/product/servicedesk',
        visual: {
          kind: 'fields',
          code: 'INC-1051',
          title: 'Troca de produto avariado',
          chips: [{ label: 'Canal WhatsApp', tone: 'success' }],
          rows: [
            { label: 'Contato', value: 'Carla Menezes' },
            { label: 'Fase', value: 'Em atendimento' },
          ],
        },
      },
      {
        title: 'CRM',
        description:
          'A conversa comercial segue no funil, com a oportunidade e a proposta do cliente.',
        href: '/product/crm',
        visual: {
          kind: 'fields',
          title: 'Loja Bom Preço',
          chips: [{ label: 'Negociação', tone: 'brand' }],
          rows: [
            { label: 'Valor', value: 'R$ 9.800' },
            { label: 'Responsável', value: 'Rafael' },
          ],
        },
      },
      {
        title: 'Steel AI',
        description:
          'Pergunte à Steel AI sobre a conversa direto do cabeçalho, ou peça um resumo da caixa de entrada.',
        href: '/product/steel-ai',
        visual: {
          kind: 'chat',
          messages: [
            { from: 'user', text: 'Resuma as conversas de hoje.' },
            {
              from: 'ai',
              text: '41 conversas, 3 com sentimento negativo. A dúvida mais comum foi prazo de entrega.',
            },
          ],
        },
      },
    ],
  },
  cta: {
    title: 'Tire o atendimento do celular de alguém',
    subtitle:
      'Conecte o número, convide o time e tenha todas as conversas no mesmo lugar ainda hoje.',
  },
}
