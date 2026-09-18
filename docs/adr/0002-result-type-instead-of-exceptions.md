# 0002 — `Result` em vez de exceções entre camadas

- **Status:** Aceita
- **Data:** anterior a 2026-09 (registrada em 2026-09-18)
- **Decisores:** engenharia de produto

## Contexto

O fluxo de uma requisição é `rota → service → repository → Prisma`. Com
exceções, cada rota precisava saber quais erros cada camada podia lançar, e
erros de negócio (não encontrado, sem permissão, limite do plano) se
misturavam com falhas inesperadas. O TypeScript não tipa `throw`.

## Decisão

Services e repositories **não lançam exceções**: devolvem
`Result<T, AppError>` (`src/lib/result.ts`, `ok(value)` / `err(error)`).

- Repositories envolvem o Prisma em `try/catch` e devolvem
  `err(databaseError(...))` / `err(notFound(...))`.
- Quem chama estreita com `if (!result.ok) return result`.
- `AppError` (`src/errors/app-error.ts`) tem um `code` do registro central
  `src/errors/codes.ts`, que mapeia cada código para um status HTTP. Novos
  códigos entram primeiro em `codes.ts`; erros são criados pelas factories
  (`notFound()`, `forbidden()`, `validationError()`, ...).
- Na rota, `handleError` (`utils/http-response.ts`) converte o `AppError` no
  envelope `{ success, statusCode, error }`.

## Consequências

- O tipo de retorno documenta a falha; o compilador obriga a tratá-la.
- Erros de domínio viram HTTP de forma uniforme, num só lugar.
- Mais verboso (`if (!r.ok) return r` em cadeia). Exceções ainda existem nas
  bordas (processors do worker lançam para o BullMQ fazer retry; scripts CLI).
