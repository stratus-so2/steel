import {
  Calendar03Icon,
  HierarchyIcon,
  Layers01Icon,
  Search01Icon,
  Shield01Icon,
  SlidersHorizontalIcon,
} from '@hugeicons-pro/core-stroke-rounded'
import type { ProductPage } from '@/src/schemas/web-product-page.schema'

export const cmdbPage: ProductPage = {
  slug: 'cmdb',
  kind: 'feature',
  template: 'object',
  label: 'CMDB',
  meta: {
    title: 'CMDB: itens de configuração ligados aos chamados | Steel',
    description:
      'Cadastre servidores, equipamentos e sistemas como itens de configuração, com tipo, criticidade, garantia e hierarquia, e veja cada chamado que os afetou.',
  },
  hero: {
    eyebrow: 'CMDB',
    title: 'Saiba o que quebrou, de quem é e tudo o que já aconteceu com ele',
    subtitle:
      'Cada item de configuração tem tipo, dono, criticidade e histórico. Quando um chamado chega, o item afetado já está no chamado, com contexto.',
    window: {
      title: 'ServiceDesk',
      nav: [
        'Chamados',
        'Clientes',
        'Contatos',
        'Itens de configuração',
        'Painéis',
      ],
      active: 3,
      body: {
        kind: 'table',
        columns: ['Item', 'Tipo', 'Status', 'Criticidade'],
        rows: [
          ['Firewall Centro', 'Firewall', 'Ativo', 'Alta'],
          ['SRV-ERP-01', 'Servidor', 'Ativo', 'Alta'],
          ['Impressora 3º andar', 'Impressora', 'Manutenção', 'Baixa'],
          ['Notebook TI-0412', 'Notebook', 'Em estoque', 'Média'],
          ['Switch Filial Norte', 'Switch', 'Ativo', 'Média'],
        ],
      },
      aside: {
        kind: 'fields',
        code: 'CI-0231',
        title: 'Firewall Centro',
        chips: [
          { label: 'Ativo', tone: 'success' },
          { label: 'Criticidade alta', tone: 'danger' },
        ],
        rows: [
          { label: 'Fabricante', value: 'Fortinet' },
          { label: 'IP', value: '10.20.0.1' },
          { label: 'Cliente', value: 'Acme Varejo' },
          { label: 'Garantia até', value: '03/2027' },
        ],
      },
    },
  },
  highlights: {
    eyebrow: 'Dentro de cada item',
    title: 'Não é uma planilha de patrimônio. É o mapa do que você atende.',
    subtitle:
      'Atributos por tipo, relação entre itens e o histórico de chamados num só registro.',
    items: [
      {
        title: 'Tipos com atributos próprios',
        description:
          'Servidor tem CPU e sistema; impressora tem modelo do toner. Cada tipo define os atributos que os itens dele preenchem.',
        visual: {
          kind: 'fields',
          title: 'Tipo · Servidor',
          rows: [
            { label: 'Sistema operacional', value: 'Lista' },
            { label: 'vCPUs', value: 'Número' },
            { label: 'Memória (GB)', value: 'Número' },
            { label: 'Ambiente', value: 'Produção / Homologação' },
          ],
        },
      },
      {
        title: 'Hierarquia entre itens',
        description:
          'Um item pode ter pai e filhos — o rack e os servidores, o servidor e os sistemas que rodam nele.',
        visual: {
          kind: 'list',
          title: 'Rack Matriz › SRV-ERP-01',
          items: [
            { label: 'ERP Fiscal', meta: 'Sistema', tone: 'brand' },
            { label: 'Banco do ERP', meta: 'Sistema', tone: 'brand' },
            { label: 'Backup diário', meta: 'Rotina', tone: 'neutral' },
          ],
        },
      },
      {
        title: 'Histórico de chamados',
        description:
          'Todos os incidentes, requisições e mudanças que tocaram o item, para enxergar o equipamento problemático.',
        visual: {
          kind: 'timeline',
          items: [
            { actor: 'INC-1042', action: 'VPN fora do ar', time: 'hoje' },
            {
              actor: 'CHG-0087',
              action: 'Atualização de firmware',
              time: '12/09',
            },
            { actor: 'INC-0961', action: 'Reinício inesperado', time: '28/08' },
          ],
        },
      },
    ],
  },
  ai: {
    eyebrow: 'Automação e IA',
    title: 'O inventário trabalhando a favor do atendimento',
    items: [
      {
        title: 'Monitoramento casa o host com o item',
        description:
          'Um alerta do Zabbix ou de webhook abre o chamado e o liga ao item pelo nome, código ou IP do host.',
        visual: {
          kind: 'flow',
          steps: [
            { label: 'Zabbix: host 10.20.0.1 sem resposta', tone: 'danger' },
            { label: 'Item encontrado: Firewall Centro', tone: 'info' },
            { label: 'Chamado aberto e vinculado', tone: 'success' },
          ],
        },
      },
      {
        title: 'Steel AI conhece o inventário',
        description:
          'Pergunte pelos itens de um cliente ou peça para vincular o item certo ao chamado, com confirmação.',
        visual: {
          kind: 'chat',
          messages: [
            {
              from: 'ai',
              text: 'Encontrei o Firewall Centro (10.20.0.1). Vincular ao INC-1042?',
            },
          ],
          action: {
            title: 'Vincular item de configuração',
            preview: 'INC-1042 ← Firewall Centro (CI-0231)',
            confirm: 'Confirmar',
          },
        },
      },
      {
        title: 'Rotinas preventivas por item',
        description:
          'Chamados recorrentes de manutenção são cadastrados com o item, e a aba Rotinas mostra o que incide sobre ele.',
        visual: {
          kind: 'list',
          title: 'Rotinas · SRV-ERP-01',
          items: [
            { label: 'Verificar backup', meta: 'Diária, 07:00', tone: 'brand' },
            {
              label: 'Aplicar atualizações',
              meta: 'Mensal, dia 10',
              tone: 'neutral',
            },
          ],
        },
      },
      {
        title: 'Mudança com impacto visível',
        description:
          'Na mudança, o item afetado aparece junto da janela de manutenção e da aprovação do CAB.',
        visual: {
          kind: 'fields',
          code: 'CHG-0087',
          title: 'Atualizar firmware do firewall',
          chips: [{ label: 'Aprovada pelo CAB', tone: 'success' }],
          rows: [
            { label: 'Item', value: 'Firewall Centro' },
            { label: 'Janela', value: 'Sáb, 22:00 – 23:30' },
          ],
        },
      },
      {
        title: 'Incidentes repetidos no mesmo item',
        description:
          'Incidentes parecidos em sequência viram sugestão de problema para atacar a causa.',
        visual: {
          kind: 'stats',
          items: [
            { label: 'Incidentes em 7 dias', value: '3', tone: 'warning' },
            { label: 'Sugestão', value: 'Problema', tone: 'brand' },
          ],
        },
      },
    ],
  },
  details: {
    eyebrow: 'Cadastro completo',
    title: 'Os campos que a operação usa de verdade',
    subtitle: 'Do patrimônio à garantia, sem planilha paralela.',
    items: [
      {
        title: 'Ciclo de vida',
        description:
          'Planejado, em estoque, ativo, em manutenção ou aposentado.',
        icon: Layers01Icon,
      },
      {
        title: 'Criticidade',
        description:
          'Baixa, média ou alta, para priorizar o que derruba a operação.',
        icon: Shield01Icon,
      },
      {
        title: 'Garantia e compra',
        description:
          'Data de compra, fim da garantia com filtro de garantia vencendo, fabricante, modelo e número de série.',
        icon: Calendar03Icon,
      },
      {
        title: 'Dono e localização',
        description:
          'Cliente, departamento, responsável, local e endereço IP de cada item.',
        icon: HierarchyIcon,
      },
      {
        title: 'Campos personalizados',
        description:
          'Além dos atributos do tipo, campos próprios do seu workspace.',
        icon: SlidersHorizontalIcon,
      },
      {
        title: 'Busca por código ou IP',
        description: 'Encontre o item pela etiqueta patrimonial, nome ou IP.',
        icon: Search01Icon,
      },
    ],
  },
  connected: {
    eyebrow: 'Recursos conectados',
    title: 'O item de configuração no centro do atendimento',
    subtitle: 'O CMDB não vive isolado: ele aparece onde a decisão acontece.',
    items: [
      {
        title: 'ServiceDesk',
        description:
          'O item afetado fica no chamado, com o histórico dele a um clique.',
        href: '/product/servicedesk',
        visual: {
          kind: 'fields',
          code: 'INC-1042',
          title: 'VPN da filial fora do ar',
          rows: [
            { label: 'Item afetado', value: 'Firewall Centro' },
            { label: 'Criticidade', value: 'Alta', tone: 'danger' },
          ],
        },
      },
      {
        title: 'SLA e OLA',
        description:
          'Itens críticos entram em chamados com prioridade e prazo à altura.',
        href: '/features/sla',
        visual: {
          kind: 'meters',
          title: 'INC-1042',
          items: [
            {
              label: 'Prazo de solução',
              value: 72,
              tone: 'warning',
              meta: '72%',
            },
          ],
        },
      },
      {
        title: 'Dashboards',
        description:
          'Chamados por item, por tipo e por cliente nos painéis do ServiceDesk.',
        href: '/features/dashboards',
        visual: {
          kind: 'chart',
          title: 'Incidentes por mês · firewalls',
          variant: 'bars',
          points: [20, 35, 25, 60, 30, 18],
        },
      },
    ],
  },
  cta: {
    title: 'Coloque o inventário dentro do atendimento',
    subtitle:
      'Cadastre os tipos e os itens e vincule-os aos chamados a partir de hoje.',
  },
}
