# Analytics do painel admin (`/admin/analytics`)

Painel no estilo Axiom para a equipe Stratus ver o tráfego da plataforma:
requisições, rotas, erros, acessos (país/cidade, navegador, dispositivo) e
filas BullMQ. Só **admin global** (`assertPlatformAdmin`); API
`GET /api/admin/analytics`. Leitura pura: não gera `admin_audit_logs`.

## De onde vêm os dados

```
requisição ──► proxy.ts ──────────────► Axiom (source = "middleware")   page views
          └──► withAxiom (rota de API) ─► Axiom (source = "lambda")     uma linha por resposta
                                              │
/admin/analytics ─► AdminAnalyticsService ─► API de consulta do Axiom (APL) ─► cache Redis 45 s
                                         └─► BullMQ/Redis (aba Jobs)
```

- **Gravação** — `lib/axiom/request-log.ts` monta o evento das duas fontes
  (no lugar do transform padrão do `@axiomhq/nextjs`). Campos em `request.*`:
  `path`, `route` (normalizada: ids/cuid2/uuid → `[id]`, slug do workspace →
  `[workspace]`, token de link público → `[token]`), `method`, `statusCode`,
  `startTime`/`endTime`/`durationMs`, `userId` e `workspaceId` (ids internos,
  anotados por `getAuthSession` e `assertMember` via
  `src/lib/analytics/request-context.ts`), `workspaceSlug` (page views),
  `errorCode`/`errorMessage` (de `errorResponse`/exceção, mensagem limpa de
  e-mail/IP/documentos e truncada em 200 caracteres), `country`/
  `countryCode`/`city` (GeoLite2), `browser`/`os`/`device` (família do
  User-Agent) e `refererHost`. 4xx vira nível `warn`, 5xx `error`.
- **Leitura** — todas as consultas APL ficam em `src/lib/analytics/apl.ts`
  (com testes do texto gerado) e foram validadas contra o dataset real.
  Campos novos são lidos com `column_ifexists` e eventos antigos (sem
  `request.route`) têm a rota normalizada por regex na consulta, então o
  histórico anterior também agrupa. Cliente HTTP mínimo com `fetch` em
  `src/lib/analytics/axiom-query.ts` (`POST /v1/datasets/_apl?format=tabular`).
- **Service** — `src/services/admin-analytics.service.ts`: uma aba por
  chamada, consultas em paralelo, timeout de 10 s por consulta, **erro por
  painel** (um painel que falha mostra o próprio aviso; o resto da página
  continua), cache Redis de 45 s (`analytics:v1:*`, só quando nenhum painel
  falhou).

## Abas

| Aba | Conteúdo |
| --- | -------- |
| Visão geral | req/min, erros 4xx e 5xx (separados), latência p50/p95/p99, usuários e workspaces únicos |
| Rotas | mais acessadas, mais lentas (p95, mín. 3 req.), mais erros; clique abre o **detalhe** (série, status, erros recentes) |
| Erros | tendência 4xx/5xx, agrupados por status/código/rota/mensagem, amostras recentes |
| Acessos | usuários/workspaces ativos no tempo, page views por país e cidade, navegador, sistema, dispositivo |
| Jobs | contadores BullMQ por fila e falhas recentes (as 5 últimas de cada fila, motivo limpo) — não depende do Axiom |

Filtros (na URL, dá para compartilhar o link): intervalo (15 min, 1 h, 24 h,
7 d, 30 d — baldes de 30 s, 1 min, 15 min, 1 h, 6 h), workspace, rota, classe
de status (2xx…5xx) e ambiente (`platform.environment`: produção,
desenvolvimento, teste).

Observações sobre os números:

- **Usuários únicos** só existem a partir do deploy do log enriquecido (os
  eventos antigos não têm `request.userId`); workspaces únicos saem também do
  path `/api/workspaces/:id` dos eventos antigos.
- O e2e do CI roda `next start` (NODE_ENV `production`) e manda logs para o
  mesmo dataset: parte do tráfego "produção" antigo é teste. Use o filtro de
  ambiente e, se possível, um dataset separado para o CI.
- Page views contam toda navegação que passa pelo proxy (inclusive
  prefetch do Next); servem para distribuição (país, navegador), não como
  contagem exata de visitas.

## Variáveis de ambiente

| Variável | Uso |
| -------- | --- |
| `AXIOM_QUERY_TOKEN` | token de API do Axiom **só com Query** no dataset. Sem ele a página mostra o passo a passo (a aba Jobs funciona) |
| `AXIOM_QUERY_URL` | base da API (default `https://api.axiom.co`; ex.: região EU) |
| `NEXT_PUBLIC_AXIOM_DATASET` | dataset consultado (o mesmo da ingestão) |
| `ANALYTICS_FIXTURES` | `true` = dados simulados determinísticos para desenvolver a UI. **Ignorado em produção** (`NODE_ENV=production`) |
| `GEOIP_DB_PATH` | caminho do `GeoLite2-City.mmdb`. Sem o arquivo, o log sai sem país/cidade, em silêncio |

### Criar o token de consulta no Axiom

1. Axiom → **Settings → API tokens → New API token**.
2. Nome, ex.: `steel-admin-analytics`; sem expiração ou com rotação
   anotada.
3. Permissões: **Query** apenas, no dataset de `NEXT_PUBLIC_AXIOM_DATASET`
   (`steel-app`). Não marque Ingest nem permissões de org.
4. Grave em `AXIOM_QUERY_TOKEN` (produção: no `secrets/production.enc.env`
   via SOPS/secrets do deploy) e reinicie o app. O token de ingestão público
   (`NEXT_PUBLIC_AXIOM_TOKEN`) **não** serve e não deve ganhar Query: ele vai
   para o navegador.

## Geolocalização (MaxMind GeoLite2 City)

- Leitor: pacote `maxmind` (aberto sob demanda, recarrega quando o arquivo é
  trocado no lugar). Código em `src/lib/analytics/geoip.ts`.
- Base: **GeoLite2 City**, gratuita, com conta MaxMind e aceite do
  *GeoLite2 End User License Agreement* (exige atribuição: "This product
  includes GeoLite2 data created by MaxMind, available from
  https://www.maxmind.com" — manter nos termos/créditos se a informação for
  exibida a terceiros). A licença pede atualizar a base (o MaxMind publica
  duas vezes por semana) e apagar cópias antigas.
- Download: crie uma *license key* em maxmind.com → Manage License Keys e use
  o `geoipupdate` (recomendado, com cron) ou baixe
  `https://download.maxmind.com/geoip/databases/GeoLite2-City/download?suffix=tar.gz`
  com a key. Coloque o `.mmdb` num volume montado nos containers do app
  (ex.: `/var/lib/geoip/GeoLite2-City.mmdb`) e aponte `GEOIP_DB_PATH`.
- **IP real atrás do nginx:** o app usa o **primeiro** valor de
  `X-Forwarded-For` (reserva: `X-Real-IP`). O nginx precisa repassar:

  ```nginx
  proxy_set_header X-Real-IP $remote_addr;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  ```

  Se houver outro proxy/CDN na frente (Cloudflare etc.), configure
  `real_ip_header`/`set_real_ip_from` no nginx para o primeiro salto ser o
  cliente. IPs privados/locais não são geolocalizados.

## LGPD

- O IP é lido **só em memória** para a consulta ao GeoLite2; **não é
  gravado** nem exibido. O log leva só país/cidade.
- O transform padrão do `@axiomhq/nextjs` gravava `request.ip` (valor cru do
  `X-Forwarded-For`) e o User-Agent completo; o log novo não grava nenhum dos
  dois (só a família do navegador/SO/dispositivo). **Eventos antigos no
  dataset ainda têm `request.ip`** até expirarem pela retenção do Axiom — o
  painel nunca consulta esse campo. Se for preciso apagar antes, reduza a
  retenção do dataset ou recrie-o.
- `userId`/`workspaceId` são ids internos (sem nome/e-mail). Mensagens de erro
  passam por `scrubMessage` (e-mail, IP, sequências longas de dígitos) na
  gravação e de novo na leitura, e são truncadas.
- Base legal: legítimo interesse (segurança e operação da plataforma);
  mencionar em política de privacidade a coleta de localização aproximada
  (país/cidade) derivada do IP.

## Testes

- Unitários: `src/lib/__tests__/analytics-*.test.ts` (APL gerado, cliente,
  rotas, UA, geo, contexto), `lib/__tests__/request-log.test.ts`,
  `lib/__tests__/axiom-server.test.ts`, mapper e service.
- Integração: `src/cache/__tests__/analytics.cache.test.ts`.
- e2e: `app/api/admin/analytics/__tests__/route.e2e.test.ts` (passa com
  qualquer fonte: Axiom, fixtures ou não configurado).
- Componentes: `app/_components/admin/__tests__/admin-analytics.component.test.tsx`.
