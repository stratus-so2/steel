-- CreateTable
CREATE TABLE "workspace_feature_overrides" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL,
    "note" TEXT,
    "expires_at" TIMESTAMP(3),
    "updated_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workspace_feature_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "workspace_feature_overrides_workspace_id_idx" ON "workspace_feature_overrides"("workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "workspace_feature_overrides_workspace_id_key_key" ON "workspace_feature_overrides"("workspace_id", "key");

-- AddForeignKey
ALTER TABLE "workspace_feature_overrides" ADD CONSTRAINT "workspace_feature_overrides_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_feature_overrides" ADD CONSTRAINT "workspace_feature_overrides_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
