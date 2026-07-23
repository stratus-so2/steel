-- CreateEnum
CREATE TYPE "CrmCustomFieldEntity" AS ENUM ('COMPANY', 'PERSON', 'OPPORTUNITY');

-- CreateEnum
CREATE TYPE "CrmCustomFieldType" AS ENUM ('TEXT', 'NUMBER', 'DATE', 'BOOLEAN', 'SELECT');

-- CreateTable
CREATE TABLE "crm_custom_field_definitions" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "entity" "CrmCustomFieldEntity" NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" "CrmCustomFieldType" NOT NULL DEFAULT 'TEXT',
    "options" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "required" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_by_id" TEXT NOT NULL,
    "updated_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "crm_custom_field_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_custom_field_values" (
    "id" TEXT NOT NULL,
    "definition_id" TEXT NOT NULL,
    "record_id" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_custom_field_values_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "crm_custom_field_definitions_workspace_id_entity_idx" ON "crm_custom_field_definitions"("workspace_id", "entity");

-- CreateIndex
CREATE INDEX "crm_custom_field_definitions_deleted_at_idx" ON "crm_custom_field_definitions"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "crm_custom_field_definitions_workspace_id_entity_key_key" ON "crm_custom_field_definitions"("workspace_id", "entity", "key");

-- CreateIndex
CREATE INDEX "crm_custom_field_values_record_id_idx" ON "crm_custom_field_values"("record_id");

-- CreateIndex
CREATE INDEX "crm_custom_field_values_definition_id_idx" ON "crm_custom_field_values"("definition_id");

-- CreateIndex
CREATE UNIQUE INDEX "crm_custom_field_values_definition_id_record_id_key" ON "crm_custom_field_values"("definition_id", "record_id");

-- AddForeignKey
ALTER TABLE "crm_custom_field_definitions" ADD CONSTRAINT "crm_custom_field_definitions_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_custom_field_definitions" ADD CONSTRAINT "crm_custom_field_definitions_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_custom_field_definitions" ADD CONSTRAINT "crm_custom_field_definitions_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_custom_field_values" ADD CONSTRAINT "crm_custom_field_values_definition_id_fkey" FOREIGN KEY ("definition_id") REFERENCES "crm_custom_field_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
