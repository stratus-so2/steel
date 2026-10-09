import {
  AiBrain01Icon,
  Analytics01Icon,
  Calendar03Icon,
  CheckmarkCircle02Icon,
  FileAttachmentIcon,
  InboxIcon,
  Mail01Icon,
  Search01Icon,
  Shield01Icon,
  SlidersHorizontalIcon,
  TimeScheduleIcon,
  UserLock01Icon,
} from '@hugeicons-pro/core-stroke-rounded'
import type { ProductPage } from '@/src/schemas/web-product-page.schema'

export const steelAiPage: ProductPage = {
  slug: 'steel-ai',
  kind: 'product',
  template: 'rhythm',
  label: 'Steel AI',
  meta: {
    title: 'Steel AI: assistente e agentes com confirmação | Steel',
    description:
      'Um assistente que lê o ServiceDesk, o CRM e o WhatsApp do seu workspace e executa ações com a sua confirmação, mais agentes que trabalham por agenda.',
  },
  hero: {
    eyebrow: 'Steel AI',
    title:
      'Uma IA que conhece o seu workspace, e pergunta antes de mudar qualquer coisa',
    subtitle:
      'Pergunte sobre chamados, vendas e conversas, peça um resumo ou mande fazer. Toda escrita mostra a prévia e espera o seu "confirmar".',
    window: {
      title: 'Steel AI',
      nav: ['Nova conversa', 'Skills', 'Agentes', 'Uso', 'Análises', 'Memória'],
      active: 0,
      body: {
        kind: 'chat',
        messages: [
          {
            from: 'user',
            text: 'Quais chamados críticos estão sem responsável? Atribua o mais antigo à Ana.',
          },
          {
            from: 'ai',
            text: 'Há 2 chamados críticos sem responsável: INC-1042 (aberto há 40 min) e INC-1047 (12 min). Preparei a atribuição do INC-1042.',
          },
        ],
        action: {
          title: 'Atribuir chamado · INC-1042',
          preview: 'Responsável: ninguém → Ana Ribeiro',
          confirm: 'Confirmar',
        },
      },
      aside: {
        kind: 'toggles',
        title: 'Modo da conversa',
        items: [
          { label: 'Ask · só consulta', on: false },
          { label: 'Build · propõe e confirma', on: true },
          { label: 'Autopilot · executa sozinho', on: false },
          { label: 'Teste · simula as escritas', on: false },
        ],
      },
    },
  },
  highlights: {
    eyebrow: 'Do pedido à ação',
    title: 'Quatro modos, um só controle: o seu',
    subtitle:
      'Você escolhe quanto a IA pode fazer em cada conversa, e o admin escolhe o que fica liberado no workspace.',
    items: [
      {
        title: 'Ask responde',
        description:
          'Só ferramentas de leitura. Perguntas sobre filas, funil e conversas, respondidas com os dados reais, nas suas permissões.',
        visual: {
          kind: 'chat',
          messages: [
            { from: 'user', text: 'Quanto temos em propostas abertas?' },
            {
              from: 'ai',
              text: 'R$ 174 mil em 9 propostas. 4 vencem esta semana.',
            },
          ],
        },
      },
      {
        title: 'Build propõe e espera',
        description:
          'Cada escrita vira uma ação pendente com prévia. Nada muda até você confirmar, e exclusão pede confirmação dupla.',
        visual: {
          kind: 'chat',
          messages: [{ from: 'ai', text: 'Vou criar a tarefa de retorno.' }],
          action: {
            title: 'Criar tarefa',
            preview: 'Retornar para Grupo Atlas · sexta, 14:00',
            confirm: 'Confirmar',
          },
        },
      },
      {
        title: 'Teste mostra o que faria',
        description:
          'Leituras de verdade, escritas simuladas no servidor. Você vê o plano inteiro antes de rodar em Build.',
        visual: {
          kind: 'list',
          title: 'Em modo teste · nada foi alterado',
          items: [
            { label: 'Faria: atribuir INC-1042 à Ana', tone: 'neutral' },
            { label: 'Faria: nota interna no INC-1042', tone: 'neutral' },
            { label: 'Executar de verdade em Build', tone: 'brand' },
          ],
        },
      },
    ],
  },
  rows: [
    {
      eyebrow: 'Steel Agents',
      title:
        'Agentes que trabalham por agenda, por evento ou quando você manda',
      description:
        'Configure as instruções, o gatilho e as ferramentas. O agente roda com as permissões do responsável, e cada escrita é automática ou espera aprovação na caixa de entrada.',
      bullets: [
        {
          icon: TimeScheduleIcon,
          text: 'Agenda com cron e fuso, evento do workspace ou execução manual',
        },
        {
          icon: CheckmarkCircle02Icon,
          text: 'Escrita automática ou com aprovação; exclusão sempre aprovada',
        },
        {
          icon: Calendar03Icon,
          text: 'Linha do tempo de cada execução, com custo e tokens',
        },
      ],
      visual: {
        kind: 'flow',
        steps: [
          { label: 'Agenda · dias úteis, 30 em 30 min', tone: 'info' },
          {
            label: 'Ler chamados com SLA em risco',
            detail: 'Leitura · automática',
            tone: 'neutral',
          },
          {
            label: 'Nota interna no INC-1042',
            detail: 'Escrita · requer aprovação',
            tone: 'warning',
          },
          { label: 'Aprovado na caixa de entrada', tone: 'success' },
        ],
      },
    },
    {
      eyebrow: 'Contexto',
      title: 'Skills, memória e anexos para a IA trabalhar do seu jeito',
      description:
        'Skills são instruções reutilizáveis chamadas com "/". A memória guarda fatos do workspace e seus, sempre revisáveis. E você anexa PDFs, planilhas em CSV e imagens à conversa.',
      bullets: [
        {
          icon: SlidersHorizontalIcon,
          text: '/my-work, /sla, /pipeline e as skills que o time criar',
        },
        {
          icon: AiBrain01Icon,
          text: 'Memória do workspace e pessoal, com busca e exclusão',
        },
        {
          icon: FileAttachmentIcon,
          text: 'Imagens, PDF, DOCX, TXT, CSV e Markdown como anexo',
        },
      ],
      visual: {
        kind: 'list',
        title: 'Skills',
        items: [
          { label: '/my-work · minha fila e minhas tarefas', tone: 'brand' },
          { label: '/sla · chamados em risco', tone: 'warning' },
          { label: '/pipeline · funil comercial', tone: 'info' },
          { label: '/resumo-semana · a semana do workspace', tone: 'neutral' },
        ],
      },
    },
  ],
  ai: {
    eyebrow: 'Agentes prontos',
    title: 'Modelos de agente para começar sem escrever prompt',
    items: [
      {
        title: 'Chamados sem responsável',
        description:
          'De hora em hora nos dias úteis, encontra chamados sem dono e propõe a atribuição, com aprovação.',
        visual: {
          kind: 'list',
          title: 'Proposto pelo agente',
          items: [
            { label: 'INC-1047 → Bruno', meta: 'Aguardando', tone: 'warning' },
            { label: 'REQ-0322 → Ana', meta: 'Aprovado', tone: 'success' },
          ],
        },
      },
      {
        title: 'Resumo executivo semanal',
        description:
          'Toda segunda às 7h, um resumo dos módulos habilitados para a diretoria ler em dois minutos.',
        visual: {
          kind: 'article',
          title: 'Semana 41 · resumo',
          tag: 'Steel Agent',
          lines: ['ServiceDesk', 'CRM', 'Comunicação'],
        },
      },
      {
        title: 'Conversas sem resposta',
        description:
          'Encontra conversas paradas no WhatsApp e sugere quem deve assumir.',
        visual: {
          kind: 'stats',
          items: [
            { label: 'Sem resposta', value: '6', tone: 'warning' },
            { label: 'Sugestões', value: '6', tone: 'brand' },
          ],
        },
      },
      {
        title: 'Oportunidades paradas',
        description:
          'Revisa o funil toda segunda e propõe uma tarefa para cada negociação sem movimento.',
        visual: {
          kind: 'list',
          title: 'Paradas há 14+ dias',
          items: [
            { label: 'Grupo Atlas', meta: '21 dias', tone: 'warning' },
            { label: 'Transportes Lima', meta: '16 dias', tone: 'warning' },
          ],
        },
      },
      {
        title: 'Consumo de IA acima do ritmo',
        description:
          'Todo dia às 9h, compara o gasto do mês com a cota e avisa se a projeção passa do limite.',
        visual: {
          kind: 'meters',
          title: 'Cota do mês',
          items: [
            { label: 'Consumido', value: 64, tone: 'brand', meta: '64%' },
            { label: 'Projeção', value: 92, tone: 'warning', meta: '92%' },
          ],
        },
      },
    ],
  },
  details: {
    eyebrow: 'Governança',
    title: 'IA com limites claros, e conta que fecha',
    subtitle: 'O que um admin precisa para ligar a IA sem perder o controle.',
    items: [
      {
        title: 'Roda com as suas permissões',
        description:
          'A IA chama os mesmos serviços das telas. O que você não pode ver ou mudar, ela também não pode.',
        icon: UserLock01Icon,
      },
      {
        title: 'Interruptores do admin',
        description:
          'Ligar a IA, os agentes, a memória e o Autopilot são decisões separadas, em Ajustes.',
        icon: Shield01Icon,
      },
      {
        title: 'Uso e análises',
        description:
          'Gasto por modelo, recurso, módulo e pessoa, com exportação em CSV e o custo real de cada modelo.',
        icon: Analytics01Icon,
      },
      {
        title: 'Resumo semanal por e-mail',
        description:
          'Toda segunda, o dono do workspace recebe o consumo da semana e a projeção do mês.',
        icon: Mail01Icon,
      },
      {
        title: 'Aprovações na caixa de entrada',
        description:
          'Pendências da IA e dos agentes aparecem na inbox, com prévia e prazo para decidir.',
        icon: InboxIcon,
      },
      {
        title: 'Busca global',
        description:
          'Ctrl+K encontra chamados, leads e conversas, e a mesma busca serve à IA.',
        icon: Search01Icon,
      },
    ],
  },
  connected: {
    eyebrow: 'Recursos conectados',
    title: 'Uma IA para os três módulos',
    subtitle:
      'A Steel AI usa as ferramentas de cada módulo habilitado no workspace, e só deles.',
    items: [
      {
        title: 'ServiceDesk',
        description:
          'Filas, SLA, chamados e a base de conhecimento, além do copiloto e da triagem dentro do chamado.',
        href: '/product/servicedesk',
        visual: {
          kind: 'chat',
          messages: [
            { from: 'user', text: '/sla' },
            {
              from: 'ai',
              text: '2 chamados em risco no N2 e 1 violado sem responsável.',
            },
          ],
        },
      },
      {
        title: 'CRM',
        description:
          'Leads, oportunidades, propostas e tarefas — com "Perguntar ao Steel AI" em cada registro.',
        href: '/product/crm',
        visual: {
          kind: 'chat',
          messages: [
            { from: 'user', text: '/pipeline' },
            {
              from: 'ai',
              text: 'R$ 174 mil em aberto; 3 oportunidades paradas em Proposta.',
            },
          ],
        },
      },
      {
        title: 'Comunicação',
        description:
          'Conversas e contatos do WhatsApp, com a mensagem ao cliente sempre tratada como ação que confirma.',
        href: '/product/comunicacao',
        visual: {
          kind: 'chat',
          messages: [{ from: 'ai', text: 'Preparei a resposta para a Carla.' }],
          action: {
            title: 'Enviar mensagem no WhatsApp',
            preview: '"Oi, Carla! O novo endereço já está no pedido 4521."',
            confirm: 'Enviar',
          },
        },
      },
    ],
  },
  cta: {
    title: 'Ponha a IA para trabalhar, sem abrir mão do controle',
    subtitle:
      'Comece no modo Ask, teste os agentes no modo Teste e libere a escrita quando o time estiver pronto.',
  },
}
