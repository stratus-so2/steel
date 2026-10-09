import {
  Alert02Icon,
  Calendar03Icon,
  Coins01Icon,
  FileAttachmentIcon,
  RepeatIcon,
  SignatureIcon,
} from '@hugeicons-pro/core-stroke-rounded'
import type { ProductPage } from '@/src/schemas/web-product-page.schema'

export const servicedeskPage: ProductPage = {
  slug: 'servicedesk',
  kind: 'product',
  template: 'object',
  label: 'ServiceDesk',
  meta: {
    title: 'ServiceDesk ITIL 4 | Steel',
    description:
      'Incidentes, requisições, mudanças e problemas num só motor, com SLA sobre calendário útil, CMDB, base de conhecimento e portal do solicitante.',
  },
  hero: {
    eyebrow: 'ServiceDesk',
    title:
      'Atendimento ITIL 4 que anda sozinho, do primeiro contato ao fechamento',
    subtitle:
      'Incidentes, requisições, mudanças e problemas no mesmo motor configurável. Cada chamado nasce priorizado, roteado e com o prazo correndo no calendário certo.',
    window: {
      title: 'ServiceDesk',
      nav: [
        'Início',
        'Chamados',
        'Incidentes',
        'Mudanças',
        'Base de conhecimento',
        'Painéis',
      ],
      active: 1,
      body: {
        kind: 'kanban',
        columns: [
          {
            title: 'Novo',
            tone: 'info',
            cards: [
              {
                title: 'INC-1042 · VPN da filial fora do ar',
                meta: 'Crítica · 25 min',
              },
              { title: 'REQ-0318 · Acesso ao ERP', meta: 'Baixa · 2 h' },
            ],
          },
          {
            title: 'Em atendimento',
            tone: 'warning',
            cards: [
              {
                title: 'INC-1039 · Impressora do 3º andar',
                meta: 'Média · SLA 72%',
              },
              {
                title: 'CHG-0087 · Janela de atualização do firewall',
                meta: 'Aguardando CAB',
              },
            ],
          },
          {
            title: 'Pausado',
            tone: 'neutral',
            cards: [
              { title: 'REQ-0311 · Notebook novo', meta: 'Aguardando cliente' },
            ],
          },
          {
            title: 'Resolvido',
            tone: 'success',
            cards: [
              {
                title: 'INC-1031 · E-mail não sincroniza',
                meta: 'Resolvido em 1 h 12 min',
              },
            ],
          },
        ],
      },
      aside: {
        kind: 'fields',
        code: 'INC-1042',
        title: 'VPN da filial fora do ar',
        chips: [
          { label: 'Crítica', tone: 'danger' },
          { label: 'Em risco', tone: 'warning' },
        ],
        rows: [
          { label: 'Impacto × urgência', value: 'Alto × Alta' },
          { label: 'Serviço', value: 'Rede › VPN' },
          { label: 'Departamento', value: 'N2 Infraestrutura' },
          { label: 'Prazo de solução', value: 'Hoje, 16:40', tone: 'warning' },
        ],
      },
    },
  },
  highlights: {
    eyebrow: 'Dentro de cada chamado',
    title: 'Não é só um ticket. É o histórico inteiro do atendimento.',
    subtitle:
      'Campos, conversa, tarefas, custos e assinatura no mesmo lugar — para quem atende entender o caso sem perguntar de novo.',
    items: [
      {
        title: 'Prioridade que se calcula sozinha',
        description:
          'A matriz impacto × urgência define a prioridade, e serviço, subcategoria ou categoria escolhem o departamento. O SLA começa a contar na abertura.',
        visual: {
          kind: 'fields',
          code: 'INC-1042',
          title: 'VPN da filial fora do ar',
          chips: [{ label: 'Incidente', tone: 'info' }],
          rows: [
            { label: 'Impacto', value: 'Alto' },
            { label: 'Urgência', value: 'Alta' },
            { label: 'Prioridade', value: 'Crítica', tone: 'danger' },
            { label: 'Roteado para', value: 'N2 Infraestrutura' },
          ],
        },
      },
      {
        title: 'Rastreabilidade que resiste à auditoria',
        description:
          'Toda mudança de campo, fase, responsável e mensagem vira um evento com autor e horário, numa linha do tempo que ninguém edita.',
        visual: {
          kind: 'timeline',
          items: [
            { actor: 'Portal', action: 'abriu o chamado', time: '09:02' },
            {
              actor: 'Motor',
              action: 'definiu prioridade Crítica',
              time: '09:02',
            },
            { actor: 'Ana', action: 'assumiu o chamado', time: '09:05' },
            {
              actor: 'Ana',
              action: 'moveu para Em atendimento',
              time: '09:06',
            },
          ],
        },
      },
      {
        title: 'Pai, filhos e problema',
        description:
          'Vincule incidentes repetidos a um problema, quebre uma mudança em tarefas e acompanhe tudo pela aba de itens filhos.',
        visual: {
          kind: 'list',
          title: 'PRB-0012 · Queda recorrente da VPN',
          items: [
            {
              label: 'INC-1042 · Filial Centro',
              meta: 'Em atendimento',
              tone: 'warning',
            },
            {
              label: 'INC-1036 · Filial Norte',
              meta: 'Resolvido',
              tone: 'success',
            },
            {
              label: 'INC-1029 · Filial Sul',
              meta: 'Resolvido',
              tone: 'success',
            },
          ],
        },
      },
    ],
  },
  ai: {
    eyebrow: 'IA no atendimento',
    title: 'Uma IA que lê o chamado inteiro antes de sugerir qualquer coisa',
    items: [
      {
        title: 'Copiloto dentro do chamado',
        description:
          'Resume a conversa, sugere a resposta e a solução com base no histórico e na base de conhecimento. O agente revisa e envia.',
        visual: {
          kind: 'chat',
          messages: [
            {
              from: 'user',
              text: 'Resuma o INC-1042 e sugira o próximo passo.',
            },
            {
              from: 'ai',
              text: 'Queda da VPN desde 08:50, três filiais afetadas. O artigo "Reiniciar túnel IPsec" resolveu os dois últimos casos. Sugiro aplicá-lo e vincular ao PRB-0012.',
            },
          ],
        },
      },
      {
        title: 'Triagem na abertura',
        description:
          'Com a triagem ligada, a IA sugere categoria, serviço e prioridade assim que o chamado chega, pelo portal, e-mail ou WhatsApp.',
        visual: {
          kind: 'fields',
          title: 'Sugestão da triagem',
          chips: [{ label: 'IA', tone: 'brand' }],
          rows: [
            { label: 'Categoria', value: 'Rede' },
            { label: 'Serviço', value: 'VPN' },
            { label: 'Prioridade', value: 'Alta' },
          ],
        },
      },
      {
        title: 'Pré-atendimento',
        description:
          'Antes de virar chamado, a IA tenta resolver com a base de conhecimento e entrega para um humano quando não consegue.',
        visual: {
          kind: 'chat',
          messages: [
            { from: 'contact', text: 'Não consigo acessar a VPN de casa.' },
            {
              from: 'ai',
              text: 'Tente o passo a passo do artigo "VPN fora do escritório". Resolveu?',
            },
          ],
        },
      },
      {
        title: 'Risco preditivo explicável',
        description:
          'Uma nota de risco sem caixa-preta: cada ponto vem com o motivo — fila cheia, cliente com histórico de violação, prazo curto.',
        visual: {
          kind: 'meters',
          title: 'Risco alto · 78',
          items: [
            {
              label: 'Fila do departamento acima da média',
              value: 80,
              tone: 'danger',
            },
            {
              label: 'Cliente com violações recentes',
              value: 55,
              tone: 'warning',
            },
            { label: 'Sem resposta há 40 min', value: 35, tone: 'warning' },
          ],
        },
      },
      {
        title: 'Artigo a partir do chamado',
        description:
          'Resolveu algo novo? A IA rascunha o artigo no formato KCS a partir do chamado, e um revisor publica.',
        visual: {
          kind: 'article',
          title: 'Reiniciar túnel IPsec da filial',
          tag: 'Rascunho da IA',
          lines: ['Sintoma', 'Causa', 'Solução'],
        },
      },
    ],
  },
  details: {
    eyebrow: 'Por baixo do capô',
    title: 'Feito para a operação real, não para a demonstração',
    subtitle: 'Os detalhes que um time de suporte sente falta no terceiro mês.',
    items: [
      {
        title: 'Contratos e horas',
        description:
          'Franquia, valor da hora por janela e cronômetro no chamado. O período fecha sozinho e cobra só o excedente.',
        icon: Coins01Icon,
      },
      {
        title: 'Mudanças com CAB',
        description:
          'Calendário de mudanças com janelas de manutenção e congelamento, conflitos destacados e aprovação em rodadas.',
        icon: Calendar03Icon,
      },
      {
        title: 'Chamados recorrentes',
        description:
          'Manutenção preventiva, backup e vistoria abrem chamado sozinhos, no fuso da rotina, sem duplicar o que ainda está aberto.',
        icon: RepeatIcon,
      },
      {
        title: 'Monitoramento',
        description:
          'Alertas do Zabbix ou de um webhook abrem e resolvem chamados, casando o host com o item de configuração.',
        icon: Alert02Icon,
      },
      {
        title: 'Assinatura digital',
        description:
          'O cliente assina na tela ao encerrar. O Steel guarda o hash da assinatura e do chamado naquele momento.',
        icon: SignatureIcon,
      },
      {
        title: 'Anexos e peças',
        description:
          'Imagens, vídeos e documentos até 25 MB por arquivo, mais custos e peças usadas lançados no próprio chamado.',
        icon: FileAttachmentIcon,
      },
    ],
  },
  connected: {
    eyebrow: 'Recursos conectados',
    title: 'O chamado conversa com o resto da operação',
    subtitle:
      'O ServiceDesk é o centro, mas não fica sozinho: prazos, conhecimento, inventário e o próprio cliente entram no mesmo fluxo.',
    items: [
      {
        title: 'Prazos com SLA e OLA',
        description:
          'Minutos úteis sobre o calendário do cliente, pausa por fase e escalonamento quando o prazo aperta.',
        href: '/features/sla',
        visual: {
          kind: 'meters',
          title: 'SLA do chamado',
          items: [
            {
              label: 'Primeira resposta',
              value: 100,
              tone: 'success',
              meta: 'Cumprido',
            },
            {
              label: 'Solução',
              value: 72,
              tone: 'warning',
              meta: '1 h 10 min úteis',
            },
          ],
        },
      },
      {
        title: 'Portal do solicitante',
        description:
          'O cliente abre, conversa, acompanha, assina e avalia o atendimento sem precisar de senha.',
        href: '/features/portal-do-solicitante',
        visual: {
          kind: 'form',
          title: 'Abrir chamado',
          fields: [
            { label: 'Serviço', value: 'Rede › VPN' },
            { label: 'Descrição', value: 'Sem acesso desde as 8h50' },
          ],
          button: 'Enviar',
        },
      },
      {
        title: 'CMDB',
        description:
          'O item de configuração afetado aparece no chamado, com o histórico de tudo o que já aconteceu com ele.',
        href: '/features/cmdb',
        visual: {
          kind: 'fields',
          code: 'CI-0231',
          title: 'Firewall da filial Centro',
          rows: [
            { label: 'Tipo', value: 'Firewall' },
            { label: 'Criticidade', value: 'Alta', tone: 'danger' },
            { label: 'IP', value: '10.20.0.1' },
          ],
        },
      },
      {
        title: 'Base de conhecimento',
        description:
          'Artigos sugeridos dentro do chamado, com métrica de reuso a cada vez que resolvem um caso.',
        href: '/features/base-de-conhecimento',
        visual: {
          kind: 'list',
          title: 'Artigos sugeridos',
          items: [
            {
              label: 'Reiniciar túnel IPsec',
              meta: 'Usado 14×',
              tone: 'brand',
            },
            {
              label: 'VPN fora do escritório',
              meta: 'Usado 9×',
              tone: 'neutral',
            },
          ],
        },
      },
    ],
  },
  cta: {
    title: 'Coloque o seu atendimento no ritmo do ITIL 4',
    subtitle:
      'O módulo já vem com fases, matriz de prioridade e dashboards semeados. Você ajusta o catálogo e começa.',
  },
}
