import type { Metadata } from 'next'
import { H1 } from '@/components/typography/heading/h1'
import { H2 } from '@/components/typography/heading/h2'
import { Muted } from '@/components/typography/text/muted'
import { P } from '@/components/typography/text/p'
import { PRIVACY_VERSION } from '@/lib/legal/versions'

export const metadata: Metadata = {
  title: 'Política de Privacidade | Steel',
  description: 'Como o Steel coleta, usa e protege seus dados.',
}

export default function PrivacyPolicyPage() {
  return (
    <main className='mx-auto flex max-w-3xl flex-col gap-6 px-6 py-16'>
      <header className='flex flex-col gap-2 text-left'>
        <H1 className='text-left'>Política de Privacidade</H1>
        <Muted>Versão {PRIVACY_VERSION}</Muted>
      </header>

      <P>
        Esta Política explica como <strong>Alexandre de Carvalho ME</strong>,
        nome fantasia <strong>Stratus Telecom</strong>, CNPJ nº
        04.554.476/0001-25, com sede na Av. Senador Feijó, 686, Sala 1402, Vila
        Matias, Santos/SP, CEP 11015-504 ("Stratus Telecom", "nós" ou
        "Contratada"), trata dados pessoais relacionados à plataforma{' '}
        <strong>Steel</strong> ("Plataforma"), em conformidade com a Lei Geral
        de Proteção de Dados (Lei nº 13.709/2018, "LGPD") e, para titulares
        localizados no Espaço Econômico Europeu, Reino Unido ou Suíça, com o
        Regulamento Geral de Proteção de Dados (Regulamento (UE) 2016/679,
        "GDPR").
      </P>
      <P>
        Esta Política complementa os Termos de Serviço, a Lista de
        Subprocessadores e, quando aplicável, o Acordo de Tratamento de Dados
        (DPA) firmado com o Cliente. Termos em maiúscula não definidos aqui têm
        o significado atribuído nos Termos de Serviço.
      </P>

      <section className='flex flex-col gap-4'>
        <div id='papel'>
          <H2>1. Papéis no tratamento de dados</H2>
          <P>
            <strong>Dados da relação com a Stratus Telecom.</strong> Somos
            controladores dos dados de pessoas que contratam, administram ou
            usam a Plataforma, na medida necessária para cadastro, autenticação,
            cobrança, suporte, segurança, cumprimento de obrigações legais e
            administração da relação contratual.
          </P>
          <P>
            <strong>Dados inseridos pelo Cliente na Plataforma.</strong> Em
            regra, o Cliente é o controlador dos contatos, leads, conversas,
            registros de CRM, tickets, anexos e demais dados que insere ou
            recebe no seu workspace. A Stratus Telecom atua como operadora,
            tratando esses dados em nome do Cliente e conforme suas instruções
            documentadas, os Termos e a legislação aplicável.
          </P>
          <P>
            Se você é contato, lead ou destinatário de mensagem de uma empresa
            que utiliza o Steel, procure diretamente essa empresa para exercer
            seus direitos ou esclarecer a origem e a finalidade do tratamento. A
            Stratus Telecom poderá auxiliá-la conforme as instruções do Cliente
            e a lei aplicável.
          </P>
        </div>

        <div id='dados-coletados'>
          <H2>2. Dados que podemos tratar</H2>
          <P>
            Conforme o modo como a Plataforma é utilizada, podemos tratar: dados
            de cadastro e acesso, como nome, e-mail, senha protegida por
            mecanismo criptográfico, foto e preferências, inclusive via login
            social com Google ou GitHub; dados de cobrança e assinatura, como
            dados cadastrais e identificadores de pagamento — dados completos de
            cartão são tratados diretamente pelo processador de pagamentos
            aplicável; dados técnicos e de segurança, como endereço IP,
            navegador, dispositivo, registros de acesso, auditoria, erro e
            desempenho; dados de suporte e comunicações enviadas à Stratus
            Telecom; Dados do Cliente, como cadastros de CRM, tickets, anexos,
            contatos, conversas, mensagens de WhatsApp e metadados recebidos ou
            enviados por canais conectados pelo Cliente; e dados
            disponibilizados por integrações que o Cliente optar por conectar
            (redes sociais, plataformas de anúncios), dentro do escopo de
            permissões concedidas por ele.
          </P>
          <P>
            O Cliente é responsável por assegurar que os Dados do Cliente
            inseridos na Plataforma sejam lícitos, adequados e necessários,
            incluindo a existência de base legal para contatos, campanhas,
            mensagens e integrações.
          </P>
        </div>

        <div id='finalidades'>
          <H2>3. Finalidades e bases legais</H2>
          <P>
            Tratamos dados pessoais quando necessário para: disponibilizar,
            autenticar, manter, dar suporte e proteger a Plataforma; administrar
            contas, assinaturas, cobrança e comunicações transacionais; prevenir
            fraude, abuso, incidentes e uso não autorizado; cumprir obrigações
            legais, regulatórias e solicitações legítimas de autoridades;
            analisar dados de uso agregados ou anonimizados para aperfeiçoar a
            Plataforma; e viabilizar funcionalidades opcionais solicitadas pelo
            Cliente, incluindo integrações e Recursos de IA.
          </P>
          <P>
            <strong>Sob a LGPD (art. 7º),</strong> as bases legais podem incluir
            execução de contrato e procedimentos preliminares, cumprimento de
            obrigação legal ou regulatória, exercício regular de direitos,
            legítimo interesse — após avaliação de necessidade e impacto — e
            consentimento, quando exigido.
          </P>
          <P>
            <strong>
              Sob o GDPR (art. 6º), para titulares no EEE/Reino Unido/Suíça,
            </strong>{' '}
            as mesmas hipóteses se aplicam sob os rótulos equivalentes: execução
            de contrato, interesses legítimos, consentimento e obrigação legal.
            Quando nos baseamos em interesses legítimos, realizamos um teste de
            balanceamento para assegurar que nossos interesses não se sobrepõem
            aos seus direitos e liberdades fundamentais.
          </P>
        </div>

        <div id='ia'>
          <H2>4. Comunicação, WhatsApp, redes sociais e IA</H2>
          <P>
            A Steel pode se conectar a WhatsApp/Meta, Z-API, redes sociais,
            plataformas de anúncios, e-mail e outros serviços escolhidos pelo
            Cliente. O Cliente decide quais canais conectar, quais dados inserir
            e quais comunicações realizar, respondendo pelo cumprimento das
            políticas de cada fornecedor, pela base legal e pelas solicitações
            de oposição, bloqueio ou descadastramento dos titulares.
          </P>
          <P>
            Recursos de IA são opcionais. Quando habilitados pelo Cliente, dados
            de entrada necessários para o recurso (por exemplo, o histórico da
            conversa ou o texto submetido) podem ser enviados ao provedor de IA
            indicado na Lista de Subprocessadores, exclusivamente para executar
            a solicitação. A Stratus Telecom não utiliza Dados do Cliente para
            treinar, ajustar ou melhorar modelos de IA de uso geral, próprios ou
            de terceiros. Saídas geradas por IA são tratadas como Dados do
            Cliente e recebem as mesmas proteções desta política. Você é
            responsável por revisar e validar qualquer saída de IA antes de
            utilizá-la.
          </P>
        </div>

        <div id='compartilhamento'>
          <H2>5. Compartilhamento e subprocessadores</H2>
          <P>
            Não vendemos dados pessoais e não compartilhamos dados pessoais para
            fins de publicidade comportamental entre contextos. Só
            compartilhamos dados, no limite necessário, com: fornecedores de
            infraestrutura, hospedagem, banco de dados, armazenamento,
            segurança, observabilidade, suporte, e-mail e pagamentos; provedores
            de integrações habilitadas pelo Cliente, como Meta/WhatsApp, Z-API,
            redes sociais e plataformas de marketing; provedores de IA, quando o
            recurso correspondente for habilitado; autoridades públicas ou
            terceiros, quando exigido por lei, ordem judicial ou para exercício
            regular de direitos; e sucessores ou potenciais adquirentes, em
            operação societária, observadas as salvaguardas aplicáveis.
          </P>
          <P>
            Os fornecedores que tratam dados pessoais em nosso nome ou em nome
            do Cliente estão descritos na nossa{' '}
            <a href='/legals/subprocessors' className='underline'>
              página de Subprocessadores
            </a>
            , que pode incluir fornecedores opcionais ativados somente mediante
            solicitação ou habilitação de recurso pelo Cliente. Ao conectar uma
            integração de terceiro ao Steel, os dados compartilhados com esse
            terceiro passam a ser regidos também pela política de privacidade
            dele; o Steel não é responsável pelas práticas de privacidade de
            serviços de terceiros que não opera.
          </P>
        </div>

        <div id='transferencia-internacional'>
          <H2>6. Transferências internacionais</H2>
          <P>
            <strong>Alexandre de Carvalho ME</strong> está sediada no Brasil.
            Alguns dos fornecedores e integrações listados na Seção 5 processam
            dados fora do Brasil, inclusive nos Estados Unidos. Essas
            transferências são feitas com base nas hipóteses do art. 33 da LGPD
            e, quando aplicável a titulares do EEE/Reino Unido/Suíça, mediante
            salvaguardas apropriadas reconhecidas pelo GDPR, como Cláusulas
            Contratuais Padrão (SCCs) aprovadas pela Comissão Europeia e, quando
            cabível, o UK International Data Transfer Agreement (IDTA). O
            Cliente reconhece que a ativação de integrações de terceiros pode
            envolver transferências internacionais adicionais, sujeitas às
            políticas do respectivo provedor.
          </P>
        </div>

        <div id='cookies'>
          <H2>7. Cookies e tecnologias semelhantes</H2>
          <P>
            Usamos cookies essenciais para autenticação e segurança de sessão
            (não podem ser desabilitados sem impedir o funcionamento do produto)
            e cookies funcionais e de análise para lembrar preferências de
            interface e entender como a Plataforma é usada. Não usamos cookies
            de publicidade ou de rastreamento de terceiros para fins de
            anúncios. Você pode revogar o consentimento a qualquer momento nas
            configurações da conta ou gerenciar cookies não essenciais nas
            configurações do seu navegador. Não respondemos atualmente a sinais
            de "Do Not Track", mas honramos sinais de Global Privacy Control
            (GPC) como manifestação válida de oposição, onde exigido por lei.
          </P>
        </div>

        <div id='retencao'>
          <H2>8. Retenção e eliminação</H2>
          <P>
            Mantemos dados pessoais pelo período necessário para as finalidades
            descritas nesta Política, para a vigência da conta ou contratação,
            para cumprimento de obrigações legais e para exercício regular de
            direitos. Sessões expiradas são removidas automaticamente após 30
            dias de sua expiração; códigos de verificação, 1 dia após expirarem.
          </P>
          <P>
            Após o encerramento da conta, os Dados do Cliente poderão permanecer
            disponíveis para exportação pelo período informado na Plataforma ou
            nos Termos; depois disso, poderão ser excluídos, salvo retenção
            legal, necessidade de segurança, prevenção a fraude ou ciclo técnico
            de cópias de segurança. O Cliente é responsável por exportar os
            Dados do Cliente antes do encerramento da conta. Registros de
            cobrança e dados cuja guarda seja exigida por lei são mantidos pelo
            prazo legal aplicável (tipicamente 5 anos, no caso de obrigações
            fiscais no Brasil).
          </P>
        </div>

        <div id='seguranca'>
          <H2>9. Segurança da informação</H2>
          <P>
            Adotamos medidas técnicas e organizacionais razoáveis e
            proporcionais para proteger dados pessoais, incluindo criptografia
            em trânsito (TLS) e cabeçalhos de segurança de aplicação, senhas
            armazenadas apenas com hash criptográfico, autenticação de dois
            fatores opcional, controle de acesso por papel dentro de cada
            workspace, isolamento lógico entre workspaces, limitação de
            tentativas de acesso (rate limiting) e monitoramento e registro de
            eventos de segurança. Detalhes adicionais estão na nossa página de{' '}
            <a href='/legals/security' className='underline'>
              Segurança
            </a>
            .
          </P>
          <P>
            Nossos controles de segurança buscam inspiração nos critérios de
            confiança do SOC 2 (Trust Services Criteria) — segurança,
            disponibilidade e confidencialidade — como referência de boas
            práticas. Essa referência não constitui certificação: o Steel não
            possui, até o momento, certificação SOC 2 (Type I ou Type II), ISO
            27001 ou equivalente, emitida por auditor independente, e esta
            Política não deve ser interpretada como garantia de conformidade com
            qualquer framework de certificação.
          </P>
          <P>
            Nenhum sistema é totalmente livre de riscos — você também é
            responsável por proteger suas credenciais de acesso. Em caso de
            incidente de segurança que possa acarretar risco ou dano relevante
            aos titulares, notificaremos os afetados e a Autoridade Nacional de
            Proteção de Dados (ANPD) conforme exigido pela LGPD e, quando
            aplicável, as autoridades supervisoras competentes sob o GDPR,
            dentro dos prazos legais.
          </P>
        </div>

        <div id='direitos'>
          <H2>10. Direitos dos titulares</H2>
          <P>
            Sob a LGPD (art. 18) e, quando aplicável, o GDPR, você pode a
            qualquer momento: confirmar a existência de tratamento; acessar seus
            dados; corrigir dados incompletos, inexatos ou desatualizados;
            solicitar anonimização, bloqueio, eliminação ou portabilidade de
            dados; revogar consentimento previamente dado; opor-se a tratamentos
            baseados em legítimo interesse; e obter informação sobre com quem
            compartilhamos seus dados.
          </P>
          <P>
            Para dados tratados pela Stratus Telecom como controladora, envie a
            solicitação ao canal indicado na Seção 12. Para Dados do Cliente
            tratados em nome de um Cliente do Steel, a solicitação deve ser
            encaminhada inicialmente ao Cliente controlador. Poderemos solicitar
            informações para confirmar a identidade e a legitimidade do pedido.
            A exportação dos seus dados de conta também pode ser solicitada
            diretamente nas configurações da conta.
          </P>
          <P>
            Se você está no EEE, Reino Unido ou Suíça, também tem o direito de
            apresentar reclamação à autoridade de proteção de dados do seu país
            (lista das autoridades da UE em edpb.europa.eu; no Reino Unido, o
            ICO; na Suíça, o FDPIC), sem prejuízo de outros recursos
            administrativos ou judiciais.
          </P>
        </div>

        <div id='criancas'>
          <H2>11. Crianças e adolescentes</H2>
          <P>
            A Plataforma não é destinada ao uso direto por menores de 18 anos e
            não coletamos intencionalmente dados pessoais de crianças. O Cliente
            não deve inserir dados de crianças e adolescentes sem observar as
            exigências legais aplicáveis e as salvaguardas adequadas. Caso
            tomemos conhecimento de tratamento irregular sob nosso controle
            direto, adotaremos medidas razoáveis e cabíveis, incluindo a
            exclusão das informações.
          </P>
        </div>

        <div id='contato'>
          <H2>12. Encarregado e contato</H2>
          <P>
            Nosso Encarregado pelo Tratamento de Dados Pessoais (DPO) pode ser
            contatado em <strong>alexandre@stratustelecom.com.br</strong>. Para
            dúvidas gerais sobre esta política, exercer seus direitos como
            titular, ou para assuntos jurídicos, escreva para{' '}
            <strong>juridico@stratustelecom.com.br</strong> — ou ligue para{' '}
            <strong>+55 11 5196-1069</strong> /{' '}
            <strong>+55 13 3467-3304</strong>. Se necessário sob o art. 27 do
            GDPR, os dados do nosso representante no EEE/Reino Unido serão
            informados mediante solicitação.
          </P>
        </div>

        <div id='alteracoes'>
          <H2>13. Alterações desta política</H2>
          <P>
            Podemos atualizar esta Política de Privacidade para refletir
            alterações legais, técnicas ou operacionais. Mudanças materiais
            serão comunicadas por e-mail e/ou aviso na Plataforma, com a versão
            vigente sempre identificada pela data no topo desta página. O uso
            continuado do Steel após a alteração entrar em vigor constitui
            aceite da versão atualizada.
          </P>
        </div>
      </section>
    </main>
  )
}
