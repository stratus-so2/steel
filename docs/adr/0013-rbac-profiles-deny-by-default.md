# 0013 — RBAC por perfil (recurso × ação) com negação por padrão

- **Status:** Aceita
- **Data:** anterior a 2026-09 (registrado em 2026-10-01)
- **Decisores:** dono do produto

## Contexto

O papel na workspace (`OWNER`, `ADMIN`, `MEMBER`, `VIEWER`) era grosso demais
para clientes que querem, por exemplo, um vendedor que vê oportunidades mas
não mexe em pipeline, ou um agente de suporte sem acesso à configuração do
ServiceDesk.

## Decisão

- Autorização é uma **matriz recurso × ação** (`VIEW`, `CREATE`, `EDIT`,
  `DELETE`) guardada num **perfil** (`Profile`) ligado à membership. O
  catálogo de recursos é `PERMISSION_RESOURCES` em `src/lib/permissions.ts`.
- **Negação por padrão**: recurso ou ação ausente da matriz = bloqueado.
  Sem perfil, vale a matriz do papel.
- **Perfis de sistema (OWNER/ADMIN/MEMBER/VIEWER) têm a matriz no código**
  (`SYSTEM_PROFILE_PERMISSIONS`), não no banco: o JSON salvo é só um retrato
  da época do seed e não acompanha recursos novos. Perfis customizados usam o
  que foi salvo, saneado por `sanitizePermissions`.
- **OWNER/ADMIN sempre passam** (`isPrivileged`), e a checagem mora **no
  service**, nunca na rota ou na UI — a interface só esconde o que o usuário
  não pode fazer.
- Um módulo pode somar uma dimensão própria à matriz quando o papel não basta:
  o ServiceDesk distingue **agente** (membro de algum departamento) de
  **solicitante** em `src/services/sd-access.ts`, por cima das permissões.

## Consequências

- Recurso novo precisa entrar em `PERMISSION_RESOURCES`, ganhar rótulo na
  tela de perfis e ser usado no service; esquecer o primeiro passo deixa o
  recurso **inacessível** para quem não é OWNER/ADMIN (falha fechada, que é o
  comportamento desejado).
- Mudar a matriz de um perfil de sistema é mudança de código (e de teste),
  não de dado — o que torna a regra auditável no git.
- A UI nunca é fonte de verdade: todo teste de service cobre o caso do
  `VIEWER` e do membro sem permissão.
