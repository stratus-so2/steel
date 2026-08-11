import type { Metadata } from 'next'
import { H1 } from '@/components/typography/heading/h1'
import { H2 } from '@/components/typography/heading/h2'
import { Muted } from '@/components/typography/text/muted'
import { P } from '@/components/typography/text/p'

export const metadata: Metadata = {
  title: 'Gerenciamento de Incidentes | Steel',
  description: 'Como o Steel detecta, responde e comunica incidentes.',
}

export default function IncidentManagementPage() {
  return (
    <main className='mx-auto flex max-w-3xl flex-col gap-6 px-6 py-16'>
      <header className='flex flex-col gap-2 text-left'>
        <H1 className='text-left'>Gerenciamento de Incidentes</H1>
        <Muted>Atualizado em 11 de agosto de 2026</Muted>
      </header>

      <P>
        Esta página resume como identificamos, respondemos e comunicamos
        incidentes que afetam a disponibilidade da plataforma ou a segurança de
        dados.
      </P>

      <section className='flex flex-col gap-4'>
        <div>
          <H2>Detecção</H2>
          <P>
            Sondas automatizadas monitoram continuamente os principais
            componentes da plataforma — aplicação, banco de dados, cache,
            autenticação, pagamento, e-mail e armazenamento — classificando cada
            um como operacional, degradado ou em interrupção maior, conforme
            latência e disponibilidade observadas. O status é público em{' '}
            <a href='/status' className='underline'>
              /status
            </a>
            . Eventos de autenticação e mutações sensíveis também são
            registrados em uma trilha de auditoria estruturada, usada para
            investigação de incidentes.
          </P>
        </div>

        <div>
          <H2>Resposta</H2>
          <P>
            Ao identificar um incidente, a equipe prioriza a contenção e o
            restabelecimento do serviço, seguidos da investigação da causa raiz.
            Quando um incidente de segurança envolve risco ou dano relevante a
            titulares de dados, notificamos os afetados e a Autoridade Nacional
            de Proteção de Dados (ANPD), e, quando aplicável, as autoridades
            supervisoras competentes sob o GDPR, dentro dos prazos exigidos pela
            legislação.
          </P>
        </div>

        <div>
          <H2>Comunicação</H2>
          <P>
            Interrupções relevantes de disponibilidade são publicadas na página
            de status, com linha do tempo do incidente. Clientes materialmente
            afetados por um incidente de segurança são notificados diretamente
            pelos canais de contato indicados na{' '}
            <a href='/legals/privacy' className='underline'>
              Política de Privacidade
            </a>
            .
          </P>
        </div>

        <div>
          <H2>Reporte de vulnerabilidades</H2>
          <P>
            Se você identificar uma potencial falha de segurança, avise-nos em{' '}
            <strong>juridico@stratustelecom.com.br</strong> antes de divulgá-la
            publicamente. Veja mais detalhes na página de{' '}
            <a href='/legals/security' className='underline'>
              Segurança
            </a>
            .
          </P>
        </div>
      </section>
    </main>
  )
}
