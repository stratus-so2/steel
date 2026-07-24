-- CreateTable
CREATE TABLE "crm_hook_vault_items" (
    "id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "platform" "CrmSocialPlatform",
    "usage_count" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "workspace_id" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "updated_by_id" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "crm_hook_vault_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_tracked_competitors" (
    "id" TEXT NOT NULL,
    "platform" "CrmSocialPlatform" NOT NULL,
    "handle" TEXT NOT NULL,
    "profile_url" TEXT,
    "followers_count" INTEGER,
    "notes" TEXT,
    "workspace_id" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "updated_by_id" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "crm_tracked_competitors_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "crm_hook_vault_items_workspace_id_idx" ON "crm_hook_vault_items"("workspace_id");

-- CreateIndex
CREATE INDEX "crm_hook_vault_items_deleted_at_idx" ON "crm_hook_vault_items"("deleted_at");

-- CreateIndex
CREATE INDEX "crm_hook_vault_items_workspace_id_position_idx" ON "crm_hook_vault_items"("workspace_id", "position");

-- CreateIndex
CREATE INDEX "crm_tracked_competitors_workspace_id_idx" ON "crm_tracked_competitors"("workspace_id");

-- CreateIndex
CREATE INDEX "crm_tracked_competitors_deleted_at_idx" ON "crm_tracked_competitors"("deleted_at");

-- CreateIndex
CREATE INDEX "crm_tracked_competitors_workspace_id_position_idx" ON "crm_tracked_competitors"("workspace_id", "position");

-- AddForeignKey
ALTER TABLE "crm_hook_vault_items" ADD CONSTRAINT "crm_hook_vault_items_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_hook_vault_items" ADD CONSTRAINT "crm_hook_vault_items_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_hook_vault_items" ADD CONSTRAINT "crm_hook_vault_items_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_tracked_competitors" ADD CONSTRAINT "crm_tracked_competitors_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_tracked_competitors" ADD CONSTRAINT "crm_tracked_competitors_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_tracked_competitors" ADD CONSTRAINT "crm_tracked_competitors_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

