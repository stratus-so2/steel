# 0003 — Versionamento CalVer

- **Status:** Aceita
- **Data:** 2026-09-18
- **Decisores:** dono do produto

## Contexto

Havia três versões desalinhadas: `package.json` em `0.1.0` (herança do
template), `public/openapi.json` em `2.2.0` (herança da base Nexo) e as
releases do GitHub em CalVer (`2026.08.31`, `2026.08.28.4`...), criadas
automaticamente pelo `cd.yml` a cada deploy. Com deploy contínuo em `main`
([0001](./0001-trunk-based-main-ci-gate.md)) não existe "versão maior" a
comunicar — o que importa é *quando* foi para produção.

## Decisão

Seguir o que já funciona no GitHub Actions: **CalVer `YYYY.MM.DD[.N]` (UTC)**.

- **Fonte da verdade: a tag de release** criada pelo job `Tag & Release` do
  `cd.yml` após migrate + deploy verdes. Primeiro deploy do dia = `YYYY.MM.DD`;
  os seguintes, `.1`, `.2`... O `release.yml` só cobre tags empurradas à mão.
- `public/openapi.json` → `info.version` guarda a tag literal (`2026.08.31`).
- `package.json` → `version` guarda a forma semver-válida, porque npm/pnpm
  rejeitam zero à esquerda: `2026.08.31 → 2026.8.31`, `2026.08.28.4 → 2026.8.28-4`
  (`lib/version.ts`).
- `pnpm version:sync [tag]` reescreve os dois arquivos a partir da tag
  informada (ou da última tag do repo). Rode ao mudar o contrato da API.
- O teste `lib/__tests__/version.test.ts` falha se os dois arquivos
  divergirem entre si.

## Consequências

- Uma única convenção; a versão diz a data do deploy.
- Os arquivos versionados **não** são reescritos a cada deploy (o CD não
  commita de volta em `main`, para não gerar commits de bot nem loops de CI).
  Eles refletem a última release sincronizada, não necessariamente a que está
  em produção — para isso, consulte a tag/release do GitHub.
- Se um dia for preciso a versão exata dentro do app (ex.: rodapé, header
  `X-App-Version`), o caminho é injetar a tag como build-arg no `cd.yml`
  (`docker build --build-arg APP_VERSION=<tag>`), não commitar arquivos.
