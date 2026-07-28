-- CreateTable
CREATE TABLE "workspace_module_access" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "module" "ModuleKind" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "granted_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workspace_module_access_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "workspace_module_access_workspace_id_idx" ON "workspace_module_access"("workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "workspace_module_access_workspace_id_module_key" ON "workspace_module_access"("workspace_id", "module");

-- AddForeignKey
ALTER TABLE "workspace_module_access" ADD CONSTRAINT "workspace_module_access_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_module_access" ADD CONSTRAINT "workspace_module_access_granted_by_id_fkey" FOREIGN KEY ("granted_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: o gate é opt-in (registro ausente = módulo indisponível), mas
-- todo workspace já em produção usa os três módulos livremente hoje. Sem
-- este backfill, o primeiro enforcement no layout derrubaria o acesso de
-- todo cliente existente. `granted_by_id` recebe o OWNER mais antigo do
-- workspace (fallback: qualquer membro, se por algum motivo não houver OWNER).
INSERT INTO "workspace_module_access" ("id", "workspace_id", "module", "enabled", "granted_by_id", "created_at", "updated_at")
SELECT
  gen_random_uuid()::text,
  w.id,
  m.module,
  true,
  COALESCE(
    (SELECT mem.user_id FROM memberships mem WHERE mem.workspace_id = w.id AND mem.role = 'OWNER' ORDER BY mem.created_at ASC LIMIT 1),
    (SELECT mem.user_id FROM memberships mem WHERE mem.workspace_id = w.id ORDER BY mem.created_at ASC LIMIT 1)
  ),
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "workspaces" w
CROSS JOIN (SELECT unnest(enum_range(NULL::"ModuleKind")) AS module) m
WHERE EXISTS (SELECT 1 FROM memberships mem WHERE mem.workspace_id = w.id);
