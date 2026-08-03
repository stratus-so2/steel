import type { Metadata } from 'next'
import { H1 } from '@/components/typography/heading/h1'
import { H2 } from '@/components/typography/heading/h2'
import { Muted } from '@/components/typography/text/muted'
import { P } from '@/components/typography/text/p'
import { TERMS_VERSION } from '@/lib/legal/versions'

export const metadata: Metadata = {
  title: 'Termos de Serviço | Steel',
  description: 'Os termos que regem o uso do Steel.',
}

export default function ServiceTermPage() {
  return (
    <main className='mx-auto flex max-w-3xl flex-col gap-6 px-6 py-16'>
      <header className='flex flex-col gap-2 text-left'>
        <H1 className='text-left'>Termos de Serviço</H1>
        <Muted>Versão {TERMS_VERSION}</Muted>
      </header>

      <div className='rounded-md border border-dashed border-muted-foreground/40 bg-muted/30 p-4'>
        <P className='mt-0 text-sm'>
          Este documento está em rascunho e pendente de revisão jurídica —
          nenhuma versão gerada automaticamente deve ser publicada como final
          sem validação de um advogado.
        </P>
      </div>

      <P>
        Estes Termos de Serviço ("Termos") regem o acesso e uso da plataforma
        Steel, incluindo seus módulos de Service Desk, CRM e Comunicação
        (WhatsApp), disponibilizada por{' '}
        <strong>Alexandre de Carvalho ME</strong> (nome fantasia{' '}
        <strong>Stratus Telecom</strong>), inscrita no CNPJ sob o nº{' '}
        <strong>04.554.476/0001-25</strong>, com sede na{' '}
        <strong>
          Av. Senador Feijó, 686, Sala 1402, Vila Matias, Santos - SP, CEP
          11015-504
        </strong>{' '}
        ("Steel", "nós", "nossa"), pela pessoa física ou jurídica que acessa ou
        utiliza o serviço ("Cliente", "você"). Ao criar uma conta, marcar a
        caixa de aceite na interface do produto ou simplesmente usar o Steel,
        você concorda em se vincular a estes Termos. Se você está aceitando em
        nome de uma empresa, declara ter poderes para vinculá-la.
      </P>
      <P>
        A "Data de Vigência" é a data do seu primeiro acesso ao Steel ou a data
        de assinatura de uma proposta comercial que referencie estes Termos, o
        que ocorrer primeiro.
      </P>

      <section className='flex flex-col gap-4'>
        <div>
          <H2>1. Definições</H2>
          <P>
            <strong>"Conta"</strong> é o cadastro individual de um usuário no
            Steel. <strong>"Workspace"</strong> é o ambiente isolado de um
            Cliente dentro da plataforma, ao qual usuários autorizados têm
            acesso. <strong>"Usuário Autorizado"</strong> é qualquer pessoa que
            o Cliente permite acessar seu workspace, incluindo funcionários,
            contratados e agentes.
          </P>
          <P>
            <strong>"Dados do Cliente"</strong> são quaisquer dados, conteúdos,
            arquivos ou mensagens inseridos, enviados ou recebidos por ou em
            nome do Cliente através do Steel — incluindo registros de CRM,
            tickets de Service Desk, e conversas, contatos e mensagens de
            WhatsApp processadas via Meta (WhatsApp Business Platform) ou Z-API.
            Dados do Cliente não incluem Dados de Uso.
          </P>
          <P>
            <strong>"Dados de Uso"</strong> são informações técnicas,
            diagnósticas e de uso sobre a utilização do Steel pelo Cliente e por
            Usuários Autorizados, incluindo padrões de uso de funcionalidades,
            métricas de desempenho e logs de sistema. Dados de Uso não incluem
            Dados do Cliente.
          </P>
          <P>
            <strong>"Provedores Integrados"</strong> são os terceiros cujos
            serviços o Steel utiliza ou conecta para operar, incluindo, sem
            limitação, Meta Platforms, Inc. (WhatsApp Business Platform), Z-API,
            provedores de redes sociais (Instagram, Facebook, TikTok, YouTube,
            LinkedIn, X/Twitter, Google Ads/Analytics), provedores de
            inteligência artificial, processador de pagamentos e provedor de
            e-mail transacional.
          </P>
        </div>

        <div>
          <H2>2. Aceite e elegibilidade</H2>
          <P>
            Você precisa ter pelo menos 18 anos e capacidade legal para celebrar
            contratos para usar o Steel. Ao se cadastrar, você confirma que as
            informações fornecidas são verdadeiras e completas, e se compromete
            a mantê-las atualizadas.
          </P>
          <P>
            O Steel é uma plataforma multi-tenant: cada workspace é logicamente
            isolado dos demais clientes. O aceite destes Termos é individual por
            usuário e fica registrado com data, hora, versão do documento e IP
            de origem, para fins de comprovação de consentimento.
          </P>
          <P>
            O Steel reúne módulos opcionais — Service Desk, CRM e Comunicação —
            habilitáveis por workspace conforme o plano contratado. Estes Termos
            se aplicam a todos os módulos habilitados para sua conta, ainda que
            módulos específicos possam estar sujeitos a condições adicionais
            informadas na interface do produto.
          </P>
        </div>

        <div>
          <H2>3. Acesso, conta e segurança</H2>
          <P>
            Você é responsável por manter a confidencialidade das credenciais de
            acesso à sua conta (senha, chaves de API, tokens de sessão) e por
            toda atividade realizada sob sua conta. Recomendamos fortemente a
            ativação da autenticação de dois fatores, disponível na plataforma.
          </P>
          <P>
            Você deve nos notificar imediatamente em caso de uso não autorizado
            da sua conta ou qualquer outra violação de segurança. O Steel não
            será responsável por perdas decorrentes do uso não autorizado de
            credenciais que não foram devidamente protegidas por você.
          </P>
          <P>
            Você pode permitir que colaboradores e contratados de sua empresa
            atuem como Usuários Autorizados, desde que permaneça responsável
            pelo cumprimento destes Termos por parte deles e que o uso seja
            exclusivamente em benefício do seu workspace.
          </P>
        </div>

        <div>
          <H2>4. Módulos do serviço e provedores integrados</H2>
          <P>
            <strong>4.1 Comunicação (WhatsApp).</strong> O módulo de Comunicação
            permite conectar números de WhatsApp através da{' '}
            <strong>Meta (WhatsApp Business Platform, API oficial)</strong> ou
            da <strong>Z-API (integração não oficial via WhatsApp Web)</strong>.
            Ao conectar um número, você declara ter autorização para fazê-lo e é
            responsável por manter essa conexão em conformidade com os termos
            comerciais da Meta e/ou do Z-API. O uso da Z-API está sujeito a
            limitações inerentes a integrações não oficiais (incluindo risco de
            bloqueio do número pelo WhatsApp), sobre as quais o Steel não tem
            controle e não presta garantias.
          </P>
          <P>
            <strong>4.2 Redes sociais e marketing.</strong> O módulo de CRM
            permite conectar contas de redes sociais (Instagram, Facebook,
            TikTok, YouTube, LinkedIn, X, Google Ads/Analytics) via OAuth, e
            enviar campanhas de e-mail marketing. Você é responsável por cumprir
            os termos de uso de cada plataforma conectada e a legislação
            aplicável ao envio de comunicações de marketing (incluindo LGPD e
            leis anti-spam), inclusive garantindo base legal e, quando exigido,
            consentimento dos destinatários.
          </P>
          <P>
            <strong>4.3 Integrações via API.</strong> O módulo de "Chaves de
            API" permite gerar credenciais para integrar sistemas externos ao
            seu workspace. Você é responsável por proteger essas chaves e por
            toda atividade realizada através delas.
          </P>
          <P>
            <strong>4.4 Disponibilidade de terceiros.</strong> A revogação de
            uma autorização em um Provedor Integrado, mudanças em suas políticas
            ou APIs, ou indisponibilidade desses provedores pode interromper
            funcionalidades correspondentes no Steel, sem que isso configure
            falha do serviço por parte do Steel.
          </P>
        </div>

        <div>
          <H2>5. Dados do Cliente</H2>
          <P>
            <strong>5.1 Propriedade.</strong> Entre as partes, o Cliente mantém
            todos os direitos sobre os Dados do Cliente. O Cliente concede ao
            Steel uma licença não exclusiva, mundial e gratuita para acessar,
            usar, processar, copiar e exibir os Dados do Cliente exclusivamente
            para: (a) prestar, manter e melhorar o serviço; (b) prevenir ou
            resolver problemas técnicos, de segurança ou fraude; (c) responder a
            solicitações de suporte; (d) cumprir obrigações legais; e (e)
            conforme autorizado pelo Cliente por escrito.
          </P>
          <P>
            <strong>5.2 Responsabilidades do Cliente.</strong> Você declara que:
            (a) obteve todos os direitos, consentimentos e permissões
            necessários para inserir Dados do Cliente no Steel — incluindo, no
            caso de conversas de WhatsApp, o cumprimento das exigências legais
            aplicáveis ao tratamento de dados de terceiros (contatos, leads);
            (b) os Dados do Cliente não violam direitos de terceiros nem a
            legislação aplicável; e (c) seu uso do Steel cumpre a LGPD, o Marco
            Civil da Internet e demais Leis aplicáveis.
          </P>
          <P>
            <strong>5.3 Dados sensíveis.</strong> Você não deve inserir no Steel
            dados classificados como sensíveis pelo art. 5º, II, da LGPD (origem
            racial ou étnica, convicção religiosa, opinião política, dado de
            saúde ou vida sexual, dado genético ou biométrico) ou categorias
            especiais equivalentes sob outras leis, salvo se o Steel tiver
            expressamente concordado em tratá-los mediante acordo específico e
            as salvaguardas adicionais aplicáveis.
          </P>
        </div>

        <div>
          <H2>6. Recursos de Inteligência Artificial</H2>
          <P>
            O Steel oferece recursos assistidos por IA, incluindo um assistente
            de IA no CRM, resposta automática e análise de sentimento de
            mensagens de WhatsApp ("Recursos de IA"). Esses recursos são
            fornecidos para auxiliar, e não substituir, a tomada de decisão
            humana.
          </P>
          <P>
            O Steel não utiliza Dados do Cliente para treinar modelos de IA de
            uso geral, próprios ou de terceiros. Dados do Cliente processados
            pelos Recursos de IA são usados exclusivamente para gerar a resposta
            solicitada pelo próprio Cliente e não são compartilhados com ou
            usados em benefício de outros clientes. O Steel pode utilizar
            provedores terceirizados de IA para viabilizar esses recursos,
            conforme detalhado na Política de Privacidade.
          </P>
          <P>
            Você é responsável por revisar e avaliar qualquer saída gerada pelos
            Recursos de IA antes de utilizá-la ou de tomar decisões com base
            nela. Saídas de IA podem ser imprecisas, incompletas ou inadequadas
            ao seu propósito. O Steel não garante a exatidão, integridade ou
            adequação de qualquer saída gerada por IA.
          </P>
        </div>

        <div>
          <H2>7. Planos, cobrança e cancelamento</H2>
          <P>
            O Steel é oferecido por assinatura, com planos e preços descritos na
            página de planos do produto. Novas contas podem ter direito a um
            período de teste gratuito, sem necessidade de cartão de crédito e
            sem cobrança automática ao final do trial — o acesso aos recursos
            pagos é encerrado ou reduzido ao plano gratuito se nenhuma
            assinatura for contratada.
          </P>
          <P>
            Assinaturas pagas são processadas por um provedor de pagamentos
            terceirizado (AbacatePay ou outro que venha a substituí-lo). O Steel
            não armazena dados completos de cartão de crédito — apenas o
            provedor de pagamento tem acesso a essas informações, conforme suas
            próprias políticas de segurança.
          </P>
          <P>
            Assinaturas renovam automaticamente ao final de cada período de
            cobrança, salvo cancelamento prévio pelo Cliente através das
            configurações da conta. O cancelamento interrompe a renovação
            futura, mas o acesso pago permanece ativo até o fim do período já
            pago. Salvo disposição legal em contrário, direito de arrependimento
            aplicável (art. 49 do CDC, quando cabível) ou erro de cobrança
            comprovado, valores pagos não são reembolsáveis na proporção do
            período já utilizado.
          </P>
          <P>
            Reajustes de preço em renovações serão comunicados com antecedência
            mínima de <strong>60 dias</strong>. O não pagamento de valores
            devidos pode resultar em suspensão do acesso aos recursos pagos após
            aviso prévio, sem prejuízo da cobrança dos valores em aberto.
          </P>
        </div>

        <div>
          <H2>8. Uso aceitável</H2>
          <P>Ao usar o Steel, você concorda em não:</P>
          <P>
            (a) usar a plataforma para fins ilegais, fraudulentos ou que violem
            direitos de terceiros; (b) enviar mensagens via WhatsApp que
            configurem spam, phishing ou violem as políticas comerciais da Meta
            ou os termos do provedor de conectividade utilizado; (c) tentar
            acessar dados de outros workspaces sem autorização; (d) fazer
            engenharia reversa, copiar ou tentar extrair o código-fonte da
            plataforma; (e) sublicenciar, revender ou disponibilizar o Steel a
            terceiros fora do contexto de Usuários Autorizados; (f)
            sobrecarregar a infraestrutura do Steel com uso automatizado fora
            dos limites da API pública; (g) usar o Steel para desenvolver um
            produto concorrente ou para análise competitiva; ou (h) transmitir
            vírus, malware ou qualquer código malicioso através do serviço.
          </P>
          <P>
            O uso dos canais de WhatsApp integrados ao Steel está adicionalmente
            sujeito às Políticas Comerciais e de Uso da Meta e aos termos de uso
            do Z-API. Violações dessas políticas podem levar ao bloqueio do
            número pelo próprio provedor, independentemente de ação do Steel.
          </P>
        </div>

        <div>
          <H2>9. Propriedade intelectual</H2>
          <P>
            O Steel, sua marca, design, código-fonte e toda a tecnologia
            subjacente são de propriedade exclusiva de Alexandre de Carvalho ME
            ou de seus licenciadores. Estes Termos concedem apenas uma licença
            limitada, não exclusiva e intransferível de uso durante a vigência
            da sua assinatura — nenhum outro direito de propriedade intelectual
            é transferido.
          </P>
          <P>
            <strong>Feedback.</strong> Se você nos enviar sugestões ou
            comentários sobre o Steel, poderemos usá-los livremente para
            melhorar o produto, sem obrigação de compensação ou atribuição a
            você.
          </P>
          <P>
            <strong>Dados de Uso.</strong> O Steel pode coletar, usar e analisar
            Dados de Uso para prestar, manter, melhorar e desenvolver o serviço.
            Dados de Uso só são compartilhados com terceiros de forma agregada
            ou anonimizada, sem possibilidade de identificação do Cliente ou de
            indivíduos.
          </P>
        </div>

        <div>
          <H2>10. Confidencialidade</H2>
          <P>
            Cada parte se compromete a proteger as informações confidenciais da
            outra com o mesmo cuidado que emprega para suas próprias informações
            confidenciais, e a usá-las exclusivamente para cumprir estes Termos.
            Dados do Cliente são considerados informação confidencial do
            Cliente; a plataforma, sua tecnologia subjacente e dados de
            desempenho são informação confidencial do Steel.
          </P>
          <P>
            Não constitui informação confidencial aquela que: (a) já era de
            conhecimento público sem violação destes Termos; (b) já era
            conhecida pela parte receptora antes da divulgação; (c) foi recebida
            de terceiro sem violação de obrigação de sigilo; ou (d) foi
            desenvolvida independentemente, sem referência à informação
            confidencial da outra parte. A divulgação exigida por lei, ordem
            judicial ou autoridade competente não viola esta cláusula, desde que
            a parte notificada seja avisada previamente, quando legalmente
            permitido.
          </P>
        </div>

        <div>
          <H2>11. Vigência e rescisão</H2>
          <P>
            Estes Termos vigoram a partir da Data de Vigência e permanecem em
            vigor enquanto sua conta estiver ativa. Qualquer parte pode
            rescindir mediante violação material não sanada em até 30 dias após
            notificação por escrito.
          </P>
          <P>
            Você pode encerrar sua conta a qualquer momento pelas configurações
            do workspace. Após o encerramento, expiração ou cancelamento: (a)
            sua licença de acesso ao Steel termina imediatamente; (b) os Dados
            do Cliente ficam disponíveis para exportação por um período
            razoável, conforme detalhado na Política de Privacidade, após o qual
            poderão ser excluídos definitivamente dos nossos sistemas, salvo
            obrigação legal de retenção; e (c) taxas devidas e não pagas até a
            data efetiva permanecem exigíveis.
          </P>
          <P>
            O Steel pode suspender ou encerrar seu acesso imediatamente,
            mediante aviso, em caso de violação material não sanável, exigência
            legal, ou inadimplência não resolvida após o prazo informado nas
            configurações de cobrança.
          </P>
        </div>

        <div>
          <H2>12. Garantias e isenção de responsabilidade</H2>
          <P>
            Salvo o expressamente previsto nestes Termos, o Steel é fornecido
            "como está" e "conforme disponível", sem garantias de qualquer
            natureza, incluindo garantias implícitas de adequação a um propósito
            específico. O Steel não garante que o serviço será ininterrupto,
            livre de erros, ou que resultados gerados por Recursos de IA serão
            precisos, completos ou adequados ao seu propósito. Nada nesta
            cláusula exclui garantias que não podem ser legalmente excluídas,
            incluindo aquelas previstas no Código de Defesa do Consumidor quando
            aplicável.
          </P>
        </div>

        <div>
          <H2>13. Limitação de responsabilidade</H2>
          <P>
            Na máxima extensão permitida pela lei brasileira, nenhuma das partes
            será responsável perante a outra por danos indiretos, incidentais,
            especiais, consequenciais ou lucros cessantes decorrentes destes
            Termos, ainda que avisada da possibilidade de tais danos.
          </P>
          <P>
            A responsabilidade total agregada de cada parte decorrente destes
            Termos está limitada ao valor efetivamente pago pelo Cliente ao
            Steel nos doze (12) meses imediatamente anteriores ao evento que
            originou a reclamação. Essa limitação não se aplica a: (a) violação
            das obrigações de confidencialidade envolvendo dados sensíveis; (b)
            obrigações de indenização previstas na Seção 14; (c) inadimplemento
            de obrigações de pagamento; (d) dolo ou culpa grave; ou (e)
            hipóteses em que a limitação seja vedada por lei.
          </P>
          <P>
            O Steel integra Provedores Integrados para funcionar e não é
            responsável por indisponibilidades, alterações de política ou falhas
            desses provedores que estejam fora do seu controle razoável.
          </P>
        </div>

        <div>
          <H2>14. Indenização</H2>
          <P>
            <strong>14.1 Pelo Steel.</strong> O Steel defenderá e indenizará o
            Cliente contra reclamações de terceiros alegando que o uso
            autorizado do Steel infringe patente, direito autoral ou marca
            registrada de terceiro, exceto quando a suposta infração decorrer
            de: (a) modificação do serviço pelo Cliente; (b) uso combinado com
            produtos não fornecidos pelo Steel; (c) Dados do Cliente; ou (d) uso
            do serviço em violação a estes Termos.
          </P>
          <P>
            <strong>14.2 Pelo Cliente.</strong> Você defenderá e indenizará o
            Steel contra reclamações de terceiros decorrentes de: (a) Dados do
            Cliente, incluindo alegação de que violam direitos de terceiros; (b)
            violação destes Termos ou de Leis aplicáveis pelo Cliente ou por
            Usuários Autorizados; ou (c) uso do Steel em combinação com produtos
            de terceiros não fornecidos por nós.
          </P>
        </div>

        <div>
          <H2>15. Privacidade e segurança</H2>
          <P>
            O tratamento de dados pessoais no contexto do Steel é regido pela
            nossa <strong>Política de Privacidade</strong>, incorporada a estes
            Termos por referência. Detalhes das nossas práticas de segurança
            estão disponíveis na página de <strong>Segurança</strong>. O Steel
            adota controles técnicos e organizacionais alinhados aos critérios
            do SOC 2 (Trust Services Criteria) para segurança, disponibilidade e
            confidencialidade. Essa é uma referência de boas práticas — o Steel
            não possui, até o momento, certificação SOC 2 (Type I ou Type II)
            emitida por auditor independente.
          </P>
        </div>

        <div>
          <H2>16. Lei aplicável e resolução de disputas</H2>
          <P>
            Estes Termos são regidos pelas leis da República Federativa do
            Brasil. Fica eleito o foro da comarca de{' '}
            <strong>Santos - SP</strong>, com renúncia a qualquer outro, por
            mais privilegiado que seja, para dirimir controvérsias decorrentes
            destes Termos, ressalvada a competência dos Juizados Especiais ou do
            foro de domicílio do consumidor quando aplicável por lei. As partes
            buscarão resolver disputas por negociação de boa-fé antes de
            recorrer ao Judiciário.
          </P>
        </div>

        <div>
          <H2>17. Disposições gerais</H2>
          <P>
            <strong>Força maior.</strong> Nenhuma parte será responsável por
            atraso ou falha decorrente de causas fora de seu controle razoável
            (desastres naturais, falhas de infraestrutura de terceiros, ataques
            cibernéticos em larga escala, atos governamentais).
          </P>
          <P>
            <strong>Cessão.</strong> Nenhuma parte pode ceder estes Termos sem
            consentimento prévio da outra, exceto em caso de fusão, aquisição ou
            venda da totalidade de seus ativos.
          </P>
          <P>
            <strong>Comunicações.</strong> Avisos sob estes Termos devem ser
            feitos por escrito, via e-mail ou pela própria plataforma. Avisos ao
            Steel devem ser enviados para{' '}
            <strong>juridico@stratustelecom.com.br</strong>.
          </P>
          <P>
            <strong>Acordo integral.</strong> Estes Termos, junto com a Política
            de Privacidade e demais documentos referenciados, constituem o
            acordo integral entre as partes sobre seu objeto, substituindo
            entendimentos anteriores.
          </P>
          <P>
            <strong>Independência das cláusulas.</strong> Se qualquer disposição
            destes Termos for considerada inválida, as demais permanecem em
            pleno vigor, e a disposição inválida será adaptada ao mínimo
            necessário para se tornar válida.
          </P>
          <P>
            <strong>Renúncia.</strong> O atraso ou a falha de qualquer parte em
            exercer um direito não constitui renúncia a esse direito.
          </P>
          <P>
            <strong>Relação entre as partes.</strong> Estes Termos não criam
            relação de sociedade, parceria, representação ou vínculo
            empregatício entre as partes.
          </P>
        </div>

        <div>
          <H2>18. Alterações destes termos</H2>
          <P>
            Podemos atualizar estes Termos periodicamente para refletir mudanças
            no produto, na legislação ou nas nossas práticas. Alterações
            materiais serão comunicadas por e-mail e/ou aviso no produto com
            antecedência razoável, e a versão vigente é sempre identificada pela
            data no topo desta página. O uso continuado do Steel após a
            alteração entrar em vigor constitui aceite dos novos Termos; se você
            não concordar, deve interromper o uso da plataforma e pode solicitar
            o encerramento da sua conta.
          </P>
        </div>

        <div>
          <H2>19. Contato</H2>
          <P>
            Dúvidas sobre estes Termos podem ser enviadas para{' '}
            <strong>juridico@stratustelecom.com.br</strong> ou pelos telefones{' '}
            <strong>+55 11 5196-1069</strong> /{' '}
            <strong>+55 13 3467-3304</strong>.
          </P>
        </div>
      </section>
    </main>
  )
}
