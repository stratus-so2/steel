-- Aditiva de ponta a ponta: toda coluna nova tem DEFAULT, nenhuma coluna é
-- renomeada ou removida e nenhum NOT NULL novo recai sobre dado existente.
-- Isso é requisito do cd.yml, que roda a migration ANTES do deploy, com a
-- versão anterior do código ainda servindo tráfego.

-- `failed_verification_count` / `locked_until`: o plugin two-factor do
-- better-auth liga o lockout por conta POR PADRÃO e grava nas duas colunas em
-- toda verificação de segundo fator, inclusive no caminho de sucesso
-- (`resetTwoFactorFailures`). Sem elas o adapter do Prisma recusava a escrita
-- com "Unknown argument", então um código de e-mail correto falhava o login
-- igual a um errado — o 2FA que já existia não funcionava.
-- AlterTable
ALTER TABLE "two_factors" ADD COLUMN     "failed_verification_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "locked_until" TIMESTAMP(3);

-- `two_factor_totp_enabled`: marca que a conta confirmou um aplicativo
-- autenticador (escaneou o QR e digitou um código válido). O
-- `two_factor_enabled` do plugin é um interruptor único para os dois métodos
-- e não distingue "2FA por e-mail" de "2FA por app".
-- AlterTable
ALTER TABLE "users" ADD COLUMN     "two_factor_totp_enabled" BOOLEAN NOT NULL DEFAULT false;

-- O plugin declara `index: true` em `secret`. `two_factors` tem uma linha por
-- conta com 2FA, então o ACCESS EXCLUSIVE do CREATE INDEX comum é curto o
-- bastante para não justificar CONCURRENTLY (que exigiria sair da transação
-- da migration).
-- CreateIndex
CREATE INDEX "two_factors_secret_idx" ON "two_factors"("secret");
