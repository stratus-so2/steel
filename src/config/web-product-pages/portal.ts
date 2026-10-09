import {
  Book02Icon,
  FileAttachmentIcon,
  LockKeyIcon,
  Notification01Icon,
  SignatureIcon,
  ThumbsUpIcon,
} from '@hugeicons-pro/core-stroke-rounded'
import type { ProductPage } from '@/src/schemas/web-product-page.schema'

export const portalPage: ProductPage = {
  slug: 'portal-do-solicitante',
  kind: 'feature',
  template: 'object',
  label: 'Portal do solicitante',
  meta: {
    title: 'Portal do solicitante para abrir chamados | Steel',
    description:
      'Seus clientes abrem, acompanham e avaliam chamados num portal próprio, entram por link no e-mail e encontram respostas na base de conhecimento.',
  },
  hero: {
    eyebrow: 'Portal do solicitante',
    title: 'Um lugar para o seu cliente pedir ajuda, e saber em que pé está',
    subtitle:
      'Sem ligar, sem cobrar por e-mail. O solicitante abre o chamado, conversa com quem atende, acompanha a fase e avalia o atendimento — tudo num portal com a cara do seu suporte.',
    window: {
      title: 'Portal de atendimento',
      nav: ['Meus chamados', 'Abrir chamado', 'Base de conhecimento'],
      active: 0,
      body: {
        kind: 'table',
        columns: ['Chamado', 'Assunto', 'Fase'],
        rows: [
          ['REQ-0318', 'Acesso ao ERP', 'Em atendimento'],
          ['INC-1031', 'E-mail não sincroniza', 'Resolvido'],
          ['REQ-0302', 'Novo usuário no sistema', 'Encerrado'],
          ['INC-0997', 'Lentidão na rede', 'Encerrado'],
        ],
      },
      aside: {
        kind: 'chat',
        messages: [
          { from: 'agent', text: 'Liberei o acesso. Consegue testar agora?' },
          { from: 'user', text: 'Funcionou, obrigado!' },
        ],
      },
    },
  },
  highlights: {
    eyebrow: 'Dentro do portal',
    title: 'Abrir, acompanhar e encerrar, sem depender de ninguém',
    subtitle:
      'O solicitante vê só o que é dele — os próprios chamados, as mensagens públicas e os artigos liberados para o portal.',
    items: [
      {
        title: 'Abertura guiada pelo catálogo',
        description:
          'O cliente escolhe o serviço e descreve o problema. O chamado já nasce com categoria, prioridade e departamento certos.',
        visual: {
          kind: 'form',
          title: 'Abrir chamado',
          fields: [
            { label: 'Serviço', value: 'Sistemas › Acesso ao ERP' },
            {
              label: 'O que aconteceu?',
              value: 'Preciso de acesso ao módulo fiscal',
            },
            { label: 'Anexo', value: 'print-erro.png' },
          ],
          button: 'Enviar chamado',
        },
      },
      {
        title: 'Conversa no próprio chamado',
        description:
          'Mensagens e anexos ficam no histórico do chamado. Notas internas do time nunca aparecem para o solicitante.',
        visual: {
          kind: 'chat',
          messages: [
            { from: 'contact', text: 'Segue o print do erro.' },
            {
              from: 'agent',
              text: 'Obrigada! Já encaminhei para o time de sistemas.',
            },
          ],
        },
      },
      {
        title: 'Fase, prazo e avaliação',
        description:
          'O solicitante acompanha a fase em tempo real, assina quando o encerramento exige e avalia o atendimento com uma nota.',
        visual: {
          kind: 'fields',
          code: 'REQ-0318',
          title: 'Acesso ao ERP',
          chips: [{ label: 'Resolvido', tone: 'success' }],
          rows: [
            { label: 'Responsável', value: 'Ana Ribeiro' },
            { label: 'Resolvido em', value: '1 h 12 min' },
            { label: 'Sua avaliação', value: '5 de 5', tone: 'success' },
          ],
        },
      },
    ],
  },
  ai: {
    eyebrow: 'IA no portal',
    title: 'Resolver antes de abrir, quando der',
    items: [
      {
        title: 'Pré-atendimento com IA',
        description:
          'Com o pré-atendimento ligado, a IA conversa com o solicitante e tenta resolver com a base de conhecimento antes de abrir o chamado.',
        visual: {
          kind: 'chat',
          messages: [
            { from: 'contact', text: 'Esqueci a senha do ERP.' },
            {
              from: 'ai',
              text: 'Você pode redefinir pelo link "Esqueci minha senha" na tela de login. Quer que eu abra um chamado se não funcionar?',
            },
          ],
        },
      },
      {
        title: 'Passa para um humano',
        description:
          'Quando a IA não resolve, o chamado é aberto com a conversa inteira anexada, e ninguém pergunta tudo de novo.',
        visual: {
          kind: 'flow',
          steps: [
            { label: 'Conversa com a IA', tone: 'brand' },
            { label: 'Sem solução', tone: 'warning' },
            { label: 'Chamado aberto com o histórico', tone: 'success' },
          ],
        },
      },
      {
        title: 'Artigos certos na hora certa',
        description:
          'Os artigos marcados como "portal" ficam disponíveis para o solicitante pesquisar sozinho.',
        visual: {
          kind: 'list',
          title: 'Base de conhecimento',
          items: [
            { label: 'Como redefinir a senha do ERP', tone: 'brand' },
            { label: 'Configurar a VPN em casa', tone: 'neutral' },
            { label: 'Solicitar um equipamento', tone: 'neutral' },
          ],
        },
      },
      {
        title: 'Triagem automática',
        description:
          'O que o solicitante escreve vira sugestão de categoria e prioridade para quem atende.',
        visual: {
          kind: 'fields',
          title: 'Sugestão da triagem',
          chips: [{ label: 'IA', tone: 'brand' }],
          rows: [
            { label: 'Categoria', value: 'Sistemas' },
            { label: 'Prioridade', value: 'Média' },
          ],
        },
      },
      {
        title: 'Copiloto para quem responde',
        description:
          'Do outro lado, o agente recebe resumo e sugestão de resposta para devolver mais rápido ao portal.',
        visual: {
          kind: 'chat',
          messages: [
            {
              from: 'ai',
              text: 'Sugestão: "Liberei o acesso ao módulo fiscal. Pode testar?"',
            },
          ],
        },
      },
    ],
  },
  details: {
    eyebrow: 'Detalhes que contam',
    title: 'Simples para o cliente, seguro para você',
    subtitle: 'O portal mostra o necessário e protege o resto.',
    items: [
      {
        title: 'Entrada por link no e-mail',
        description:
          'O contato externo informa o e-mail e recebe um link de acesso. Sem senha para esquecer.',
        icon: LockKeyIcon,
      },
      {
        title: 'Só o que é dele',
        description:
          'Cada solicitante vê os próprios chamados; notas internas e custos ficam com o time.',
        icon: Notification01Icon,
      },
      {
        title: 'Anexos',
        description: 'Prints, documentos e vídeos anexados direto no chamado.',
        icon: FileAttachmentIcon,
      },
      {
        title: 'Assinatura no encerramento',
        description:
          'Quando a fase exige, o solicitante assina na tela para encerrar.',
        icon: SignatureIcon,
      },
      {
        title: 'Avaliação do atendimento',
        description:
          'Nota de satisfação (CSAT) depois da resolução, somada aos relatórios de SLA.',
        icon: ThumbsUpIcon,
      },
      {
        title: 'Ajuda self-service',
        description:
          'A base de conhecimento do portal responde as dúvidas comuns sem abrir chamado.',
        icon: Book02Icon,
      },
    ],
  },
  connected: {
    eyebrow: 'Recursos conectados',
    title: 'O portal é a porta de entrada do ServiceDesk',
    subtitle:
      'Tudo o que entra pelo portal segue o mesmo motor de chamados, prazos e conhecimento.',
    items: [
      {
        title: 'ServiceDesk',
        description:
          'Chamados do portal caem na fila com prioridade e departamento definidos.',
        href: '/product/servicedesk',
        visual: {
          kind: 'kanban',
          columns: [
            {
              title: 'Novo',
              tone: 'info',
              cards: [{ title: 'REQ-0318 · Acesso ao ERP', meta: 'Portal' }],
            },
            {
              title: 'Em atendimento',
              tone: 'warning',
              cards: [{ title: 'INC-1039 · Impressora', meta: 'E-mail' }],
            },
          ],
        },
      },
      {
        title: 'SLA e OLA',
        description:
          'O prazo começa a contar quando o solicitante envia, no calendário do contrato dele.',
        href: '/features/sla',
        visual: {
          kind: 'meters',
          title: 'Prazos do REQ-0318',
          items: [
            {
              label: 'Primeira resposta',
              value: 100,
              tone: 'success',
              meta: 'Cumprido',
            },
            { label: 'Solução', value: 45, tone: 'brand', meta: '45%' },
          ],
        },
      },
      {
        title: 'Base de conhecimento',
        description:
          'Os artigos de visibilidade "portal" alimentam a ajuda self-service e o pré-atendimento.',
        href: '/features/base-de-conhecimento',
        visual: {
          kind: 'article',
          title: 'Como redefinir a senha do ERP',
          tag: 'Portal',
          lines: ['Passo a passo'],
          checklist: [
            { label: 'Abrir a tela de login', done: true },
            { label: 'Clicar em "Esqueci minha senha"', done: true },
            { label: 'Seguir o link do e-mail', done: false },
          ],
        },
      },
    ],
  },
  cta: {
    title: 'Dê ao seu cliente um portal que responde',
    subtitle:
      'O portal vem pronto com o ServiceDesk. É só cadastrar os contatos e mandar o link.',
  },
}
