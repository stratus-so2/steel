-- CreateTable
CREATE TABLE "crm_opportunities" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "amount" DECIMAL(14,2),
    "close_date" TIMESTAMP(3),
    "pipeline_id" TEXT NOT NULL,
    "stage_id" TEXT NOT NULL,
    "company_id" TEXT,
    "point_of_contact_id" TEXT,
    "owner_id" TEXT,
    "source" TEXT,
    "workspace_id" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "updated_by_id" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "crm_opportunities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_opportunity_line_items" (
    "id" TEXT NOT NULL,
    "opportunity_id" TEXT NOT NULL,
    "product_id" TEXT,
    "name" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unit_price" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "discount_pct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "billing_type" "CrmBillingType" NOT NULL DEFAULT 'ONE_TIME',
    "total" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_opportunity_line_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "crm_opportunities_workspace_id_idx" ON "crm_opportunities"("workspace_id");

-- CreateIndex
CREATE INDEX "crm_opportunities_pipeline_id_idx" ON "crm_opportunities"("pipeline_id");

-- CreateIndex
CREATE INDEX "crm_opportunities_stage_id_idx" ON "crm_opportunities"("stage_id");

-- CreateIndex
CREATE INDEX "crm_opportunities_company_id_idx" ON "crm_opportunities"("company_id");

-- CreateIndex
CREATE INDEX "crm_opportunities_deleted_at_idx" ON "crm_opportunities"("deleted_at");

-- CreateIndex
CREATE INDEX "crm_opportunities_workspace_id_position_idx" ON "crm_opportunities"("workspace_id", "position");

-- CreateIndex
CREATE INDEX "crm_opportunity_line_items_opportunity_id_idx" ON "crm_opportunity_line_items"("opportunity_id");

-- CreateIndex
CREATE INDEX "crm_opportunity_line_items_opportunity_id_position_idx" ON "crm_opportunity_line_items"("opportunity_id", "position");

-- CreateIndex
CREATE INDEX "crm_opportunity_line_items_product_id_idx" ON "crm_opportunity_line_items"("product_id");

-- AddForeignKey
ALTER TABLE "crm_opportunities" ADD CONSTRAINT "crm_opportunities_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_opportunities" ADD CONSTRAINT "crm_opportunities_pipeline_id_fkey" FOREIGN KEY ("pipeline_id") REFERENCES "crm_pipelines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_opportunities" ADD CONSTRAINT "crm_opportunities_stage_id_fkey" FOREIGN KEY ("stage_id") REFERENCES "crm_pipeline_stages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_opportunities" ADD CONSTRAINT "crm_opportunities_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "crm_companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_opportunities" ADD CONSTRAINT "crm_opportunities_point_of_contact_id_fkey" FOREIGN KEY ("point_of_contact_id") REFERENCES "crm_people"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_opportunities" ADD CONSTRAINT "crm_opportunities_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_opportunities" ADD CONSTRAINT "crm_opportunities_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_opportunities" ADD CONSTRAINT "crm_opportunities_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_opportunity_line_items" ADD CONSTRAINT "crm_opportunity_line_items_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "crm_opportunities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_opportunity_line_items" ADD CONSTRAINT "crm_opportunity_line_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "crm_products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
