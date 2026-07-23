-- CreateTable
CREATE TABLE "crm_companies" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "cnpj" TEXT,
    "domain" TEXT,
    "employees" INTEGER,
    "linkedin" TEXT,
    "address" JSONB,
    "arr" DECIMAL(14,2),
    "icp" BOOLEAN NOT NULL DEFAULT false,
    "workspace_id" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "account_owner_id" TEXT,
    "updated_by_id" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "crm_companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_people" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "emails" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "phones" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "city" TEXT,
    "job_title" TEXT,
    "linkedin" TEXT,
    "avatar" TEXT,
    "company_id" TEXT,
    "workspace_id" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "updated_by_id" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "crm_people_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "crm_companies_workspace_id_idx" ON "crm_companies"("workspace_id");

-- CreateIndex
CREATE INDEX "crm_companies_account_owner_id_idx" ON "crm_companies"("account_owner_id");

-- CreateIndex
CREATE INDEX "crm_companies_deleted_at_idx" ON "crm_companies"("deleted_at");

-- CreateIndex
CREATE INDEX "crm_companies_workspace_id_position_idx" ON "crm_companies"("workspace_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "crm_companies_workspace_id_domain_key" ON "crm_companies"("workspace_id", "domain");

-- CreateIndex
CREATE UNIQUE INDEX "crm_companies_workspace_id_cnpj_key" ON "crm_companies"("workspace_id", "cnpj");

-- CreateIndex
CREATE INDEX "crm_people_workspace_id_idx" ON "crm_people"("workspace_id");

-- CreateIndex
CREATE INDEX "crm_people_company_id_idx" ON "crm_people"("company_id");

-- CreateIndex
CREATE INDEX "crm_people_deleted_at_idx" ON "crm_people"("deleted_at");

-- CreateIndex
CREATE INDEX "crm_people_workspace_id_position_idx" ON "crm_people"("workspace_id", "position");

-- AddForeignKey
ALTER TABLE "crm_companies" ADD CONSTRAINT "crm_companies_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_companies" ADD CONSTRAINT "crm_companies_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_companies" ADD CONSTRAINT "crm_companies_account_owner_id_fkey" FOREIGN KEY ("account_owner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_companies" ADD CONSTRAINT "crm_companies_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_people" ADD CONSTRAINT "crm_people_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_people" ADD CONSTRAINT "crm_people_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "crm_companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_people" ADD CONSTRAINT "crm_people_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_people" ADD CONSTRAINT "crm_people_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
