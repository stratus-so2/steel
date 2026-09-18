-- CreateTable
CREATE TABLE "module_usage_daily" (
    "id" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "module" "ModuleKind" NOT NULL,
    "requests" INTEGER NOT NULL DEFAULT 0,
    "mutations" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "module_usage_daily_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "module_usage_daily_workspace_id_idx" ON "module_usage_daily"("workspace_id");

-- CreateIndex
CREATE INDEX "module_usage_daily_day_idx" ON "module_usage_daily"("day");

-- CreateIndex
CREATE UNIQUE INDEX "module_usage_daily_day_workspace_id_module_key" ON "module_usage_daily"("day", "workspace_id", "module");

-- AddForeignKey
ALTER TABLE "module_usage_daily" ADD CONSTRAINT "module_usage_daily_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
