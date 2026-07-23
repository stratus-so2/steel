-- CreateEnum
CREATE TYPE "CrmBillingType" AS ENUM ('ONE_TIME', 'MONTHLY', 'YEARLY');

-- CreateEnum
CREATE TYPE "CrmStageCategory" AS ENUM ('OPEN', 'WON', 'LOST');

-- CreateTable
CREATE TABLE "crm_pipelines" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_by_id" TEXT NOT NULL,
    "updated_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "crm_pipelines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_pipeline_stages" (
    "id" TEXT NOT NULL,
    "pipeline_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "probability" INTEGER NOT NULL DEFAULT 0,
    "category" "CrmStageCategory" NOT NULL DEFAULT 'OPEN',
    "color" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_pipeline_stages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_products" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sku" TEXT,
    "description" TEXT,
    "unit_price" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "billing_type" "CrmBillingType" NOT NULL DEFAULT 'ONE_TIME',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_by_id" TEXT NOT NULL,
    "updated_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "crm_products_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "crm_pipelines_workspace_id_idx" ON "crm_pipelines"("workspace_id");

-- CreateIndex
CREATE INDEX "crm_pipelines_workspace_id_position_idx" ON "crm_pipelines"("workspace_id", "position");

-- CreateIndex
CREATE INDEX "crm_pipelines_deleted_at_idx" ON "crm_pipelines"("deleted_at");

-- CreateIndex
CREATE INDEX "crm_pipeline_stages_pipeline_id_idx" ON "crm_pipeline_stages"("pipeline_id");

-- CreateIndex
CREATE INDEX "crm_pipeline_stages_pipeline_id_position_idx" ON "crm_pipeline_stages"("pipeline_id", "position");

-- CreateIndex
CREATE INDEX "crm_products_workspace_id_idx" ON "crm_products"("workspace_id");

-- CreateIndex
CREATE INDEX "crm_products_workspace_id_position_idx" ON "crm_products"("workspace_id", "position");

-- CreateIndex
CREATE INDEX "crm_products_deleted_at_idx" ON "crm_products"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "crm_products_workspace_id_sku_key" ON "crm_products"("workspace_id", "sku");

-- AddForeignKey
ALTER TABLE "crm_pipelines" ADD CONSTRAINT "crm_pipelines_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_pipelines" ADD CONSTRAINT "crm_pipelines_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_pipelines" ADD CONSTRAINT "crm_pipelines_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_pipeline_stages" ADD CONSTRAINT "crm_pipeline_stages_pipeline_id_fkey" FOREIGN KEY ("pipeline_id") REFERENCES "crm_pipelines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_products" ADD CONSTRAINT "crm_products_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_products" ADD CONSTRAINT "crm_products_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_products" ADD CONSTRAINT "crm_products_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
