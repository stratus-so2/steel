-- DropIndex
DROP INDEX "crm_social_connections_workspace_id_idx";

-- DropIndex
DROP INDEX "crm_social_connections_workspace_id_platform_key";

-- AlterTable
ALTER TABLE "crm_social_connections" ADD COLUMN     "is_primary" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "crm_social_connections_workspace_id_platform_idx" ON "crm_social_connections"("workspace_id", "platform");

-- CreateIndex
CREATE UNIQUE INDEX "crm_social_connections_workspace_id_platform_external_accou_key" ON "crm_social_connections"("workspace_id", "platform", "external_account_id");

-- DataMigration: marca a linha mais antiga de cada (workspace_id, platform)
-- como primary quando o grupo ainda não tem nenhuma, preservando o
-- comportamento de "uma conta ativa por plataforma" para conexões que já
-- existiam antes do suporte a múltiplas contas.
UPDATE crm_social_connections c
SET is_primary = true
WHERE c.id = (
  SELECT c2.id FROM crm_social_connections c2
  WHERE c2.workspace_id = c.workspace_id AND c2.platform = c.platform
  ORDER BY c2.created_at ASC LIMIT 1
)
AND NOT EXISTS (
  SELECT 1 FROM crm_social_connections c3
  WHERE c3.workspace_id = c.workspace_id AND c3.platform = c.platform AND c3.is_primary = true
);

