import type { Metadata } from 'next'
import { H1 } from '@/components/typography/heading/h1'
import { H2 } from '@/components/typography/heading/h2'
import { Muted } from '@/components/typography/text/muted'
import { P } from '@/components/typography/text/p'

export const metadata: Metadata = {
  title: 'Recuperação de Desastres | Steel',
  description: 'Planos de recuperação e continuidade do Steel.',
}

export default function DisasterRecoveryPage() {
  return (
    <main className='mx-auto flex max-w-3xl flex-col gap-6 px-6 py-16'>
      <header className='flex flex-col gap-2 text-left'>
        <H1 className='text-left'>Recuperação de Desastres</H1>
        <Muted>Atualizado em 11 de agosto de 2026</Muted>
      </header>

      <P>
        Esta página descreve, em linhas gerais, como a infraestrutura do Steel é
        hospedada e como buscamos manter a continuidade do serviço diante de
        falhas ou interrupções.
      </P>

      <section className='flex flex-col gap-4'>
        <div>
          <H2>Hospedagem</H2>
          <P>
            A aplicação, o banco de dados e o armazenamento de arquivos são
            hospedados por um provedor de infraestrutura no Brasil, listado na
            nossa{' '}
            <a href='/legals/subprocessors' className='underline'>
              página de Subprocessadores
            </a>
            . Rotinas de backup e redundância de infraestrutura são operadas
            pelo provedor de hospedagem conforme suas próprias práticas
            operacionais.
          </P>
        </div>

        <div>
          <H2>Implantação controlada</H2>
          <P>
            Alterações só chegam à produção após passar por uma pipeline de
            integração contínua — lint, verificação de tipos, testes e
            varreduras de segurança. Um deploy só é disparado a partir de uma
            execução bem-sucedida dessa pipeline, o que reduz o risco de uma
            alteração com defeito interromper o serviço.
          </P>
        </div>

        <div>
          <H2>Resposta a interrupções</H2>
          <P>
            Interrupções de disponibilidade são identificadas por sondas
            automatizadas e comunicadas na página pública de{' '}
            <a href='/status' className='underline'>
              status
            </a>
            . A equipe prioriza o restabelecimento do serviço; incidentes
            relevantes são detalhados na página de{' '}
            <a href='/legals/trust/incident-management' className='underline'>
              Gerenciamento de Incidentes
            </a>
            .
          </P>
        </div>

        <div>
          <H2>Limitações</H2>
          <P>
            O Steel não garante um tempo específico de recuperação (RTO) ou de
            perda máxima de dados (RPO) para todo e qualquer cenário. Eventos
            fora do nosso controle razoável — incluindo falhas do provedor de
            hospedagem, desastres naturais ou ataques cibernéticos em larga
            escala — são tratados conforme a cláusula de força maior dos Termos
            de Serviço.
          </P>
        </div>
      </section>
    </main>
  )
}
