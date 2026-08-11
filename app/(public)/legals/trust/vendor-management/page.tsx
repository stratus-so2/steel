import type { Metadata } from 'next'
import { H1 } from '@/components/typography/heading/h1'
import { H2 } from '@/components/typography/heading/h2'
import { Muted } from '@/components/typography/text/muted'
import { P } from '@/components/typography/text/p'

export const metadata: Metadata = {
  title: 'Gerenciamento de Fornecedores | Steel',
  description: 'Como o Steel avalia e gerencia fornecedores terceiros.',
}

export default function VendorManagementPage() {
  return (
    <main className='mx-auto flex max-w-3xl flex-col gap-6 px-6 py-16'>
      <header className='flex flex-col gap-2 text-left'>
        <H1 className='text-left'>Gerenciamento de Fornecedores</H1>
        <Muted>Atualizado em 11 de agosto de 2026</Muted>
      </header>

      <P>
        O Steel depende de um número limitado de fornecedores terceiros
        ("subprocessadores") para operar módulos específicos da plataforma, como
        mensageria, autenticação social, pagamentos, e-mail transacional,
        observabilidade e Recursos de IA.
      </P>

      <section className='flex flex-col gap-4'>
        <div>
          <H2>Critérios de seleção</H2>
          <P>
            Antes de integrar um novo fornecedor, avaliamos a finalidade e a
            necessidade da integração, o tipo e volume de dados que seriam
            compartilhados, os termos contratuais e políticas de privacidade do
            fornecedor, e sua localização, para efeitos de transferência
            internacional de dados.
          </P>
        </div>

        <div>
          <H2>Lista de subprocessadores</H2>
          <P>
            A lista atualizada de subprocessadores, com finalidade, dados
            tratados e localização de cada um, está disponível na nossa{' '}
            <a href='/legals/subprocessors' className='underline'>
              página de Subprocessadores
            </a>
            . Alguns fornecedores só são ativados quando o Cliente solicita ou
            habilita o recurso opcional correspondente.
          </P>
        </div>

        <div>
          <H2>Acompanhamento contínuo</H2>
          <P>
            Revisamos periodicamente a lista de subprocessadores e a atualizamos
            sempre que um novo fornecedor é adicionado ou uma relação é
            encerrada. Alterações materiais são comunicadas conforme descrito na{' '}
            <a href='/legals/privacy' className='underline'>
              Política de Privacidade
            </a>
            .
          </P>
        </div>

        <div>
          <H2>Responsabilidade contratual</H2>
          <P>
            Subprocessadores são contratados para tratar dados apenas conforme
            nossas instruções e a legislação aplicável. O Steel não controla
            esses fornecedores e não é responsável por indisponibilidades,
            alterações de política ou decisões que estejam fora do seu controle
            razoável, conforme detalhado nos Termos de Serviço.
          </P>
        </div>
      </section>
    </main>
  )
}
