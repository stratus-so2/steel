import type { Metadata } from 'next'
import { H1 } from '@/components/typography/heading/h1'
import { H2 } from '@/components/typography/heading/h2'
import { Muted } from '@/components/typography/text/muted'
import { P } from '@/components/typography/text/p'

export const metadata: Metadata = {
  title: 'Controle de Acesso | Steel',
  description: 'Políticas de controle de acesso aos dados do Steel.',
}

export default function AccessControlPage() {
  return (
    <main className='mx-auto flex max-w-3xl flex-col gap-6 px-6 py-16'>
      <header className='flex flex-col gap-2 text-left'>
        <H1 className='text-left'>Controle de Acesso</H1>
        <Muted>Atualizado em 11 de agosto de 2026</Muted>
      </header>

      <P>
        Esta página descreve como o acesso à plataforma Steel e aos dados dentro
        de cada workspace é autenticado, autorizado e isolado.
      </P>

      <section className='flex flex-col gap-4'>
        <div>
          <H2>Autenticação de usuários</H2>
          <P>
            O acesso é feito por e-mail e senha (armazenada apenas com hash
            criptográfico), login social via Google ou GitHub, ou código de
            verificação enviado por e-mail. A autenticação de dois fatores é
            opcional e pode ser ativada pelo próprio usuário nas configurações
            da conta.
          </P>
        </div>

        <div>
          <H2>Sessões</H2>
          <P>
            Sessões autenticadas expiram automaticamente e são armazenadas em um
            cookie protegido, verificado a cada requisição na borda da aplicação
            antes de qualquer rota privada ser processada. Rotas de API sem
            sessão válida retornam erro de autenticação; rotas de interface
            redirecionam para o login. Sessões expiradas são removidas dos
            nossos sistemas após um período de retenção — veja a página de{' '}
            <a href='/legals/trust/data-retention' className='underline'>
              Retenção de Dados
            </a>
            .
          </P>
        </div>

        <div>
          <H2>Isolamento entre workspaces</H2>
          <P>
            A Steel é uma plataforma multi-tenant: cada workspace é logicamente
            isolado dos demais. Todo acesso a dados de CRM, Service Desk e
            Comunicação é escopado ao workspace do usuário autenticado — não há
            acesso cruzado entre workspaces de Clientes diferentes por meio da
            aplicação.
          </P>
        </div>

        <div>
          <H2>Papéis e permissões</H2>
          <P>
            Dentro de um workspace, cada usuário recebe um papel (proprietário,
            administrador, membro ou visualizador) que determina quais ações
            pode executar. A administração de papéis, convites e remoção de
            membros é responsabilidade dos administradores do próprio workspace,
            conforme descrito nos Termos de Serviço.
          </P>
        </div>

        <div>
          <H2>Chaves de API</H2>
          <P>
            Credenciais geradas para integrar sistemas externos ao workspace do
            Cliente são escopadas a esse workspace e de responsabilidade do
            Cliente, que deve protegê-las e revogá-las quando não forem mais
            necessárias.
          </P>
        </div>

        <div>
          <H2>Revisão de acesso</H2>
          <P>
            Recomendamos que administradores de workspace revisem periodicamente
            a lista de membros e convites pendentes. Convites não aceitos dentro
            do prazo configurado expiram automaticamente.
          </P>
        </div>
      </section>
    </main>
  )
}
