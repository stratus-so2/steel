import {
  Clock01Icon,
  FormIcon,
  Layout01Icon,
  Mail01Icon,
  Shield01Icon,
  UserGroupIcon,
} from '@hugeicons-pro/core-stroke-rounded'
import type { ProductPage } from '@/src/schemas/web-product-page.schema'

export const campaignsPage: ProductPage = {
  slug: 'campanhas',
  kind: 'feature',
  template: 'object',
  label: 'Campanhas e landing pages',
  meta: {
    title: 'Campanhas de e-mail, landing pages e formulários | Steel',
    description:
      'Crie landing pages a partir de modelos, publique formulários que viram leads no CRM e envie campanhas de e-mail com descadastro conforme a LGPD.',
  },
  hero: {
    eyebrow: 'Campanhas e landing pages',
    title: 'Do clique no anúncio ao lead no funil, sem ferramenta de fora',
    subtitle:
      'Landing pages, formulários e campanhas de e-mail feitos dentro do CRM. Quem preenche vira lead com origem, e quem pede para sair nunca mais recebe.',
    window: {
      title: 'CRM',
      nav: [
        'Leads',
        'Campanhas de e-mail',
        'Modelos de e-mail',
        'Listas',
        'Landing pages',
        'Formulários',
      ],
      active: 1,
      body: {
        kind: 'table',
        columns: ['Campanha', 'Destinatários', 'Status'],
        rows: [
          ['Lançamento do plano anual', '1.240', 'Enviada'],
          ['Convite para o webinar', '860', 'Agendada · sex 09:00'],
          ['Novidades de outubro', 'Todos', 'Rascunho'],
          ['Reengajamento de leads frios', '312', 'Enviada'],
        ],
      },
      aside: {
        kind: 'fields',
        title: 'Convite para o webinar',
        chips: [{ label: 'Agendada', tone: 'info' }],
        rows: [
          { label: 'Remetente', value: 'Marketing · Acme' },
          { label: 'Listas', value: 'Clientes ativos, Webinar' },
          { label: 'Envio', value: 'Sexta, 09:00' },
          { label: 'Descadastrados', value: 'Excluídos sozinhos' },
        ],
      },
    },
  },
  highlights: {
    eyebrow: 'Dentro de cada campanha',
    title: 'Captação e nutrição no mesmo lugar que a venda',
    subtitle:
      'A página capta, o formulário qualifica e o e-mail acompanha — tudo ligado ao mesmo cadastro de leads e pessoas.',
    items: [
      {
        title: 'Landing pages a partir de modelos',
        description:
          'Escolha um dos modelos e edite as seções — hero, serviços, depoimentos, preços, FAQ, passos — e publique com um link.',
        visual: {
          kind: 'list',
          title: 'Seções da página',
          items: [
            { label: 'Hero com chamada', meta: 'Topo', tone: 'brand' },
            { label: 'Serviços', tone: 'neutral' },
            { label: 'Depoimentos', tone: 'neutral' },
            { label: 'Perguntas frequentes', tone: 'neutral' },
          ],
        },
      },
      {
        title: 'Formulários que viram lead',
        description:
          'Formulários em uma ou várias etapas, com campos mapeados para lead, pessoa ou empresa. Cada envio cria o registro no CRM.',
        visual: {
          kind: 'form',
          title: 'Fale com um especialista',
          fields: [
            { label: 'Nome', value: 'Carlos Pereira' },
            { label: 'Cargo', value: 'Diretor pedagógico' },
            { label: 'Empresa', value: 'Colégio Vértice' },
          ],
          button: 'Quero conversar',
        },
      },
      {
        title: 'Campanhas para quem importa',
        description:
          'Envie para todos ou combine pessoas, listas e e-mails avulsos numa campanha só, agora ou agendada.',
        visual: {
          kind: 'fields',
          title: 'Destinatários',
          rows: [
            { label: 'Listas', value: 'Clientes ativos · 980' },
            { label: 'Pessoas', value: '24 selecionadas' },
            { label: 'E-mails avulsos', value: '6' },
            { label: 'Total, sem duplicados', value: '1.004' },
          ],
        },
      },
    ],
  },
  ai: {
    eyebrow: 'Automação e IA',
    title: 'O lead chega, e o resto acontece sozinho',
    items: [
      {
        title: 'Lead pontuado e roteado',
        description:
          'O lead do formulário passa pelas regras de pontuação e roteamento do CRM e chega ao vendedor certo.',
        visual: {
          kind: 'fields',
          title: 'Carlos Pereira · Colégio Vértice',
          chips: [{ label: '64 pontos', tone: 'brand' }],
          rows: [
            { label: 'Origem', value: 'Formulário do site' },
            { label: 'Responsável', value: 'Pedro Lima' },
          ],
        },
      },
      {
        title: 'Workflow de boas-vindas',
        description:
          'Um workflow disparado pelo novo lead cria a tarefa de contato e envia o e-mail de boas-vindas.',
        visual: {
          kind: 'flow',
          steps: [
            { label: 'Lead criado', tone: 'info' },
            { label: 'Criar tarefa para o responsável', tone: 'brand' },
            { label: 'Enviar e-mail de boas-vindas', tone: 'success' },
          ],
        },
      },
      {
        title: 'Steel AI cria o formulário',
        description:
          'Descreva os campos e a Steel AI propõe o formulário — você confirma antes de criar.',
        visual: {
          kind: 'chat',
          messages: [
            {
              from: 'user',
              text: 'Crie um formulário de inscrição no webinar com nome, e-mail e cargo.',
            },
          ],
          action: {
            title: 'Criar formulário',
            preview: 'Inscrição no webinar · 3 campos · cria lead',
            confirm: 'Confirmar',
          },
        },
      },
      {
        title: 'Agente para novos leads',
        description:
          'Um Steel Agent pode ser acionado a cada lead criado para revisar e propor o próximo passo.',
        visual: {
          kind: 'chat',
          messages: [
            {
              from: 'ai',
              text: 'Novo lead do Colégio Vértice. Proponho agendar a ligação para amanhã às 10h.',
            },
          ],
        },
      },
      {
        title: 'Visitas na página',
        description:
          'Cada landing page conta as visitas, para comparar com os leads que ela gerou.',
        visual: {
          kind: 'stats',
          items: [
            { label: 'Visitas', value: '2.481', tone: 'neutral' },
            {
              label: 'Leads',
              value: '186',
              delta: '7,5% de conversão',
              tone: 'success',
            },
          ],
        },
      },
    ],
  },
  details: {
    eyebrow: 'Detalhes',
    title: 'Marketing com as regras certas desde o começo',
    subtitle: 'O que mantém a lista limpa e o envio dentro da lei.',
    items: [
      {
        title: 'Descadastro LGPD',
        description:
          'Link de descadastro no rodapé e descadastro em um clique pelo provedor. Quem saiu é excluído das próximas campanhas.',
        icon: Shield01Icon,
      },
      {
        title: 'Listas de e-mail',
        description:
          'Listas montadas com as pessoas do CRM, reutilizadas em várias campanhas.',
        icon: UserGroupIcon,
      },
      {
        title: 'Modelos de e-mail',
        description:
          'Modelos reutilizáveis para não começar toda campanha do zero.',
        icon: Mail01Icon,
      },
      {
        title: 'Envio agendado',
        description:
          'Escolha o dia e a hora; o envio sai sozinho no horário marcado.',
        icon: Clock01Icon,
      },
      {
        title: 'Formulários em etapas',
        description:
          'Até 10 etapas, com campos de texto, e-mail, telefone, seleção, data e mais.',
        icon: FormIcon,
      },
      {
        title: 'Modelos de landing page',
        description:
          'Agência, SaaS, e-commerce, consultoria, produto e outros pontos de partida.',
        icon: Layout01Icon,
      },
    ],
  },
  connected: {
    eyebrow: 'Recursos conectados',
    title: 'A campanha alimenta a venda',
    subtitle:
      'Tudo o que a campanha capta entra no mesmo CRM em que o time vende.',
    items: [
      {
        title: 'CRM',
        description:
          'Leads e pessoas captados entram no funil, com origem registrada.',
        href: '/product/crm',
        visual: {
          kind: 'kanban',
          columns: [
            {
              title: 'Novos leads',
              tone: 'info',
              cards: [{ title: 'Colégio Vértice', meta: 'Formulário' }],
            },
            {
              title: 'Qualificados',
              tone: 'brand',
              cards: [{ title: 'Clínica Horizonte', meta: 'Landing page' }],
            },
          ],
        },
      },
      {
        title: 'Workflows',
        description: 'Automatize o que acontece depois do envio do formulário.',
        href: '/features/workflows',
        visual: {
          kind: 'flow',
          steps: [
            { label: 'Pessoa criada', tone: 'info' },
            { label: 'Se cargo contém "Diretor"', tone: 'warning' },
            { label: 'Criar oportunidade', tone: 'success' },
          ],
        },
      },
      {
        title: 'Dashboards',
        description:
          'Leads por origem e conversão das campanhas nos painéis do CRM.',
        href: '/features/dashboards',
        visual: {
          kind: 'chart',
          title: 'Leads por semana',
          variant: 'bars',
          points: [22, 30, 28, 45, 52, 48, 61],
        },
      },
    ],
  },
  cta: {
    title: 'Capte, nutra e venda no mesmo workspace',
    subtitle:
      'Publique a primeira landing page hoje e veja os leads chegarem direto no funil.',
  },
}
