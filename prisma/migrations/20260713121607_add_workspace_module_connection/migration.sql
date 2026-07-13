-- CreateEnum
CREATE TYPE "ModuleKind" AS ENUM ('SERVICE_DESK', 'CRM', 'COMMUNICATION');

-- CreateTable
CREATE TABLE "workspace_module_connections" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "module" "ModuleKind" NOT NULL,
    "host" TEXT NOT NULL,
    "port" INTEGER NOT NULL,
    "username" TEXT NOT NULL,
    "encrypted_password" TEXT NOT NULL,
    "database" TEXT NOT NULL,
    "ssl_enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workspace_module_connections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "workspace_module_connections_workspace_id_idx" ON "workspace_module_connections"("workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "workspace_module_connections_workspace_id_module_key" ON "workspace_module_connections"("workspace_id", "module");

-- AddForeignKey
ALTER TABLE "workspace_module_connections" ADD CONSTRAINT "workspace_module_connections_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_module_connections" ADD CONSTRAINT "workspace_module_connections_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
