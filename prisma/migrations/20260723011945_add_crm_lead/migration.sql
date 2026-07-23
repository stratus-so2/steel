-- CreateEnum
CREATE TYPE "CrmLeadStatus" AS ENUM ('NEW', 'WORKING', 'QUALIFIED', 'UNQUALIFIED', 'CONVERTED');

-- CreateEnum
CREATE TYPE "CrmLeadRuleField" AS ENUM ('name', 'email', 'phone', 'company', 'jobTitle', 'source', 'city');

-- CreateEnum
CREATE TYPE "CrmLeadRuleOperator" AS ENUM ('equals', 'not_equals', 'contains', 'is_empty', 'is_not_empty');

-- CreateTable
CREATE TABLE "crm_leads" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "emails" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "phones" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "company" TEXT,
    "job_title" TEXT,
    "city" TEXT,
    "linkedin" TEXT,
    "source" TEXT,
    "status" "CrmLeadStatus" NOT NULL DEFAULT 'NEW',
    "score" INTEGER NOT NULL DEFAULT 0,
    "owner_id" TEXT,
    "converted_person_id" TEXT,
    "created_by_id" TEXT NOT NULL,
    "updated_by_id" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "crm_leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_lead_scoring_rules" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "field" "CrmLeadRuleField" NOT NULL,
    "operator" "CrmLeadRuleOperator" NOT NULL,
    "value" TEXT,
    "points" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_lead_scoring_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_lead_routing_rules" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "field" "CrmLeadRuleField" NOT NULL,
    "operator" "CrmLeadRuleOperator" NOT NULL,
    "value" TEXT,
    "owner_id" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_lead_routing_rules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "crm_leads_workspace_id_idx" ON "crm_leads"("workspace_id");

-- CreateIndex
CREATE INDEX "crm_leads_owner_id_idx" ON "crm_leads"("owner_id");

-- CreateIndex
CREATE INDEX "crm_leads_status_idx" ON "crm_leads"("status");

-- CreateIndex
CREATE INDEX "crm_leads_deleted_at_idx" ON "crm_leads"("deleted_at");

-- CreateIndex
CREATE INDEX "crm_leads_workspace_id_position_idx" ON "crm_leads"("workspace_id", "position");

-- CreateIndex
CREATE INDEX "crm_lead_scoring_rules_workspace_id_position_idx" ON "crm_lead_scoring_rules"("workspace_id", "position");

-- CreateIndex
CREATE INDEX "crm_lead_routing_rules_workspace_id_position_idx" ON "crm_lead_routing_rules"("workspace_id", "position");

-- AddForeignKey
ALTER TABLE "crm_leads" ADD CONSTRAINT "crm_leads_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_leads" ADD CONSTRAINT "crm_leads_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_leads" ADD CONSTRAINT "crm_leads_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_leads" ADD CONSTRAINT "crm_leads_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_leads" ADD CONSTRAINT "crm_leads_converted_person_id_fkey" FOREIGN KEY ("converted_person_id") REFERENCES "crm_people"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_lead_scoring_rules" ADD CONSTRAINT "crm_lead_scoring_rules_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_lead_routing_rules" ADD CONSTRAINT "crm_lead_routing_rules_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_lead_routing_rules" ADD CONSTRAINT "crm_lead_routing_rules_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
