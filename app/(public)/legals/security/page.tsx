import type { Metadata } from 'next'
import { H1 } from '@/components/typography/heading/h1'
import { H2 } from '@/components/typography/heading/h2'
import { Muted } from '@/components/typography/text/muted'
import { P } from '@/components/typography/text/p'

export const metadata: Metadata = {
  title: 'Segurança | Steel',
  description: 'Práticas de segurança adotadas pelo Steel.',
}

const TRUST_PAGES = [
  {
    href: '/legals/trust/information-security',
    title: 'Segurança da Informação',
    description:
      'Controles de proteção de dados, autenticação, monitoramento e o pipeline de segurança que roda antes de cada deploy.',
  },
  {
    href: '/legals/trust/access-control',
    title: 'Controle de Acesso',
    description:
      'Como autenticamos usuários, isolamos workspaces e definimos papéis e permissões dentro da plataforma.',
  },
  {
    href: '/legals/trust/data-retention',
    title: 'Retenção de Dados',
    description:
      'Por quanto tempo mantemos dados de sessão, verificação, conta e Dados do Cliente, e como funciona a exclusão.',
  },
  {
    href: '/legals/trust/incident-management',
    title: 'Gerenciamento de Incidentes',
    description:
      'Como detectamos, respondemos e comunicamos incidentes de disponibilidade e segurança.',
  },
  {
    href: '/legals/trust/disaster-recovery',
    title: 'Recuperação de Desastres',
    description:
      'Hospedagem, redundância e continuidade operacional da plataforma.',
  },
  {
    href: '/legals/trust/vendor-management',
    title: 'Gerenciamento de Fornecedores',
    description:
      'Critérios de seleção e acompanhamento dos subprocessadores que oferecem serviço ao Steel.',
  },
] as const

export default function SecurityPage() {
  return (
    <main className='mx-auto flex max-w-3xl flex-col gap-6 px-6 py-16'>
      <header className='flex flex-col gap-2 text-left'>
        <H1 className='text-left'>Segurança</H1>
        <Muted>Atualizado em 11 de agosto de 2026</Muted>
      </header>

      <P>
        A segurança dos Dados do Cliente e dos dados de conta é tratada como
        requisito de produto, não como algo posterior. Esta página resume nossa
        postura de segurança e reúne links para o detalhamento de cada área —
        parte do processo de revisão contínua da plataforma, à medida que novos
        controles são adicionados.
      </P>
      <P>
        Nossos controles buscam inspiração em frameworks reconhecidos, como SOC
        2 (Trust Services Criteria), ISO 27001 e os princípios de minimização e
        proporcionalidade da LGPD/GDPR, como referência de boas práticas. Isso
        não representa certificação: o Steel não possui, até o momento,
        certificação SOC 2, ISO 27001 ou equivalente emitida por auditor
        independente.
      </P>

      <section className='flex flex-col gap-4'>
        {TRUST_PAGES.map((page) => (
          <div key={page.href}>
            <H2>
              <a href={page.href} className='underline'>
                {page.title}
              </a>
            </H2>
            <P>{page.description}</P>
          </div>
        ))}
      </section>

      <section className='flex flex-col gap-4'>
        <div>
          <H2>Divulgação responsável de vulnerabilidades</H2>
          <P>
            Se você identificar uma vulnerabilidade de segurança na plataforma,
            pedimos que nos avise em{' '}
            <strong>juridico@stratustelecom.com.br</strong> antes de divulgá-la
            publicamente, com detalhes suficientes para reproduzi-la. Não
            acesse, modifique ou exporte dados de outros workspaces além do
            estritamente necessário para demonstrar a falha. Investigaremos e
            responderemos dentro de um prazo razoável.
          </P>
        </div>
      </section>
    </main>
  )
}
