-- CreateEnum
CREATE TYPE "SdContractStatus" AS ENUM ('DRAFT', 'ACTIVE', 'SUSPENDED', 'ENDED');

-- CreateEnum
CREATE TYPE "SdContractBillingCycle" AS ENUM ('MONTHLY', 'QUARTERLY', 'YEARLY');

-- CreateEnum
CREATE TYPE "SdRateWindow" AS ENUM ('BUSINESS_HOURS', 'AFTER_HOURS', 'WEEKEND', 'HOLIDAY');

-- CreateEnum
CREATE TYPE "SdContractPeriodStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "SdTimeEntrySource" AS ENUM ('TIMER', 'MANUAL');

-- CreateEnum
CREATE TYPE "SdChangeWindowKind" AS ENUM ('MAINTENANCE', 'FREEZE');

-- CreateEnum
CREATE TYPE "SdApprovalRoundStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "SdOnCallRotation" AS ENUM ('DAILY', 'WEEKLY', 'BIWEEKLY');

-- CreateEnum
CREATE TYPE "SdRecurrenceFrequency" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY');

-- CreateEnum
CREATE TYPE "SdRecurringRunStatus" AS ENUM ('CREATED', 'SKIPPED', 'FAILED');

-- AlterTable
ALTER TABLE "sd_ticket_approvals" ADD COLUMN     "round_id" TEXT;

-- AlterTable
ALTER TABLE "sd_tickets" ADD COLUMN     "contract_id" TEXT;

-- CreateTable
CREATE TABLE "sd_contracts" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "status" "SdContractStatus" NOT NULL DEFAULT 'DRAFT',
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3),
    "billing_cycle" "SdContractBillingCycle" NOT NULL DEFAULT 'MONTHLY',
    "included_minutes" INTEGER NOT NULL DEFAULT 0,
    "carry_over" BOOLEAN NOT NULL DEFAULT false,
    "hourly_rate" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "overtime_rate" DECIMAL(14,2),
    "rounding_minutes" INTEGER NOT NULL DEFAULT 1,
    "minimum_minutes" INTEGER NOT NULL DEFAULT 0,
    "ticket_types" "SdTicketType"[] DEFAULT ARRAY[]::"SdTicketType"[],
    "sla_policy_id" TEXT,
    "notes" TEXT,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "sd_contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sd_contract_rates" (
    "id" TEXT NOT NULL,
    "contract_id" TEXT NOT NULL,
    "ticket_type" "SdTicketType",
    "priority_id" TEXT,
    "window" "SdRateWindow" NOT NULL DEFAULT 'BUSINESS_HOURS',
    "hourly_rate" DECIMAL(14,2) NOT NULL,
    "multiplier" DECIMAL(6,2) NOT NULL DEFAULT 1,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sd_contract_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sd_contract_periods" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "contract_id" TEXT NOT NULL,
    "period_start" TIMESTAMP(3) NOT NULL,
    "period_end" TIMESTAMP(3) NOT NULL,
    "status" "SdContractPeriodStatus" NOT NULL DEFAULT 'OPEN',
    "included_minutes" INTEGER NOT NULL DEFAULT 0,
    "used_minutes" INTEGER NOT NULL DEFAULT 0,
    "billable_minutes" INTEGER NOT NULL DEFAULT 0,
    "overage_minutes" INTEGER NOT NULL DEFAULT 0,
    "carried_minutes" INTEGER NOT NULL DEFAULT 0,
    "amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "closed_at" TIMESTAMP(3),
    "closed_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sd_contract_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sd_time_entries" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "ticket_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "contract_id" TEXT,
    "period_id" TEXT,
    "source" "SdTimeEntrySource" NOT NULL DEFAULT 'TIMER',
    "started_at" TIMESTAMP(3) NOT NULL,
    "ended_at" TIMESTAMP(3),
    "minutes" INTEGER NOT NULL DEFAULT 0,
    "billable" BOOLEAN NOT NULL DEFAULT true,
    "window" "SdRateWindow" NOT NULL DEFAULT 'BUSINESS_HOURS',
    "amount" DECIMAL(14,2),
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "sd_time_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sd_change_windows" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "SdChangeWindowKind" NOT NULL DEFAULT 'MAINTENANCE',
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3) NOT NULL,
    "recurrence" JSONB,
    "timezone" TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
    "config_item_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "department_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "description" TEXT,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "sd_change_windows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sd_cab_boards" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "quorum" INTEGER NOT NULL DEFAULT 0,
    "reject_ends" BOOLEAN NOT NULL DEFAULT true,
    "conditions" JSONB NOT NULL DEFAULT '[]',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "sd_cab_boards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sd_cab_members" (
    "id" TEXT NOT NULL,
    "board_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "sd_cab_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sd_approval_rounds" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "ticket_id" TEXT NOT NULL,
    "board_id" TEXT,
    "status" "SdApprovalRoundStatus" NOT NULL DEFAULT 'PENDING',
    "quorum" INTEGER NOT NULL DEFAULT 1,
    "reject_ends" BOOLEAN NOT NULL DEFAULT true,
    "requested_by_id" TEXT NOT NULL,
    "decided_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sd_approval_rounds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sd_oncall_schedules" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "department_id" TEXT,
    "name" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
    "rotation" "SdOnCallRotation" NOT NULL DEFAULT 'WEEKLY',
    "rotation_start" TIMESTAMP(3) NOT NULL,
    "handoff_time" TEXT NOT NULL DEFAULT '09:00',
    "calendar_id" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "sd_oncall_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sd_oncall_layers" (
    "id" TEXT NOT NULL,
    "schedule_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "sd_oncall_layers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sd_oncall_participants" (
    "id" TEXT NOT NULL,
    "layer_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "sd_oncall_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sd_oncall_overrides" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "schedule_id" TEXT NOT NULL,
    "layer_id" TEXT,
    "user_id" TEXT NOT NULL,
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sd_oncall_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sd_recurring_tickets" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "ticket_type" "SdTicketType" NOT NULL,
    "template_id" TEXT,
    "defaults" JSONB NOT NULL DEFAULT '{}',
    "customer_id" TEXT,
    "config_item_id" TEXT,
    "department_id" TEXT,
    "assignee_id" TEXT,
    "frequency" "SdRecurrenceFrequency" NOT NULL DEFAULT 'MONTHLY',
    "interval" INTEGER NOT NULL DEFAULT 1,
    "by_weekday" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "by_monthday" INTEGER,
    "at_time" TEXT NOT NULL DEFAULT '08:00',
    "timezone" TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3),
    "lead_time_minutes" INTEGER NOT NULL DEFAULT 0,
    "skip_if_open" BOOLEAN NOT NULL DEFAULT true,
    "last_run_at" TIMESTAMP(3),
    "next_run_at" TIMESTAMP(3),
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "sd_recurring_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sd_recurring_ticket_runs" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "recurring_id" TEXT NOT NULL,
    "scheduled_for" TIMESTAMP(3) NOT NULL,
    "status" "SdRecurringRunStatus" NOT NULL DEFAULT 'CREATED',
    "ticket_id" TEXT,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sd_recurring_ticket_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sd_contracts_workspace_id_status_idx" ON "sd_contracts"("workspace_id", "status");

-- CreateIndex
CREATE INDEX "sd_contracts_customer_id_idx" ON "sd_contracts"("customer_id");

-- CreateIndex
CREATE INDEX "sd_contracts_deleted_at_idx" ON "sd_contracts"("deleted_at");

-- CreateIndex
CREATE INDEX "sd_contract_rates_contract_id_position_idx" ON "sd_contract_rates"("contract_id", "position");

-- CreateIndex
CREATE INDEX "sd_contract_periods_workspace_id_status_idx" ON "sd_contract_periods"("workspace_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "sd_contract_periods_contract_id_period_start_key" ON "sd_contract_periods"("contract_id", "period_start");

-- CreateIndex
CREATE INDEX "sd_time_entries_ticket_id_idx" ON "sd_time_entries"("ticket_id");

-- CreateIndex
CREATE INDEX "sd_time_entries_workspace_id_user_id_started_at_idx" ON "sd_time_entries"("workspace_id", "user_id", "started_at");

-- CreateIndex
CREATE INDEX "sd_time_entries_period_id_idx" ON "sd_time_entries"("period_id");

-- CreateIndex
CREATE INDEX "sd_time_entries_deleted_at_idx" ON "sd_time_entries"("deleted_at");

-- CreateIndex
CREATE INDEX "sd_change_windows_workspace_id_starts_at_idx" ON "sd_change_windows"("workspace_id", "starts_at");

-- CreateIndex
CREATE INDEX "sd_cab_boards_workspace_id_position_idx" ON "sd_cab_boards"("workspace_id", "position");

-- CreateIndex
CREATE INDEX "sd_cab_members_user_id_idx" ON "sd_cab_members"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "sd_cab_members_board_id_user_id_key" ON "sd_cab_members"("board_id", "user_id");

-- CreateIndex
CREATE INDEX "sd_approval_rounds_ticket_id_idx" ON "sd_approval_rounds"("ticket_id");

-- CreateIndex
CREATE INDEX "sd_approval_rounds_workspace_id_status_idx" ON "sd_approval_rounds"("workspace_id", "status");

-- CreateIndex
CREATE INDEX "sd_oncall_schedules_workspace_id_active_idx" ON "sd_oncall_schedules"("workspace_id", "active");

-- CreateIndex
CREATE UNIQUE INDEX "sd_oncall_layers_schedule_id_level_key" ON "sd_oncall_layers"("schedule_id", "level");

-- CreateIndex
CREATE INDEX "sd_oncall_participants_user_id_idx" ON "sd_oncall_participants"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "sd_oncall_participants_layer_id_user_id_key" ON "sd_oncall_participants"("layer_id", "user_id");

-- CreateIndex
CREATE INDEX "sd_oncall_overrides_schedule_id_starts_at_idx" ON "sd_oncall_overrides"("schedule_id", "starts_at");

-- CreateIndex
CREATE INDEX "sd_recurring_tickets_workspace_id_active_next_run_at_idx" ON "sd_recurring_tickets"("workspace_id", "active", "next_run_at");

-- CreateIndex
CREATE INDEX "sd_recurring_tickets_deleted_at_idx" ON "sd_recurring_tickets"("deleted_at");

-- CreateIndex
CREATE INDEX "sd_recurring_ticket_runs_workspace_id_created_at_idx" ON "sd_recurring_ticket_runs"("workspace_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "sd_recurring_ticket_runs_recurring_id_scheduled_for_key" ON "sd_recurring_ticket_runs"("recurring_id", "scheduled_for");

-- AddForeignKey
ALTER TABLE "sd_tickets" ADD CONSTRAINT "sd_tickets_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "sd_contracts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_ticket_approvals" ADD CONSTRAINT "sd_ticket_approvals_round_id_fkey" FOREIGN KEY ("round_id") REFERENCES "sd_approval_rounds"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_contracts" ADD CONSTRAINT "sd_contracts_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_contracts" ADD CONSTRAINT "sd_contracts_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "sd_customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_contracts" ADD CONSTRAINT "sd_contracts_sla_policy_id_fkey" FOREIGN KEY ("sla_policy_id") REFERENCES "sd_sla_policies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_contracts" ADD CONSTRAINT "sd_contracts_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_contract_rates" ADD CONSTRAINT "sd_contract_rates_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "sd_contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_contract_rates" ADD CONSTRAINT "sd_contract_rates_priority_id_fkey" FOREIGN KEY ("priority_id") REFERENCES "sd_priorities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_contract_periods" ADD CONSTRAINT "sd_contract_periods_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_contract_periods" ADD CONSTRAINT "sd_contract_periods_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "sd_contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_contract_periods" ADD CONSTRAINT "sd_contract_periods_closed_by_id_fkey" FOREIGN KEY ("closed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_time_entries" ADD CONSTRAINT "sd_time_entries_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_time_entries" ADD CONSTRAINT "sd_time_entries_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "sd_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_time_entries" ADD CONSTRAINT "sd_time_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_time_entries" ADD CONSTRAINT "sd_time_entries_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "sd_contracts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_time_entries" ADD CONSTRAINT "sd_time_entries_period_id_fkey" FOREIGN KEY ("period_id") REFERENCES "sd_contract_periods"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_change_windows" ADD CONSTRAINT "sd_change_windows_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_change_windows" ADD CONSTRAINT "sd_change_windows_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_cab_boards" ADD CONSTRAINT "sd_cab_boards_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_cab_boards" ADD CONSTRAINT "sd_cab_boards_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_cab_members" ADD CONSTRAINT "sd_cab_members_board_id_fkey" FOREIGN KEY ("board_id") REFERENCES "sd_cab_boards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_cab_members" ADD CONSTRAINT "sd_cab_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_approval_rounds" ADD CONSTRAINT "sd_approval_rounds_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_approval_rounds" ADD CONSTRAINT "sd_approval_rounds_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "sd_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_approval_rounds" ADD CONSTRAINT "sd_approval_rounds_board_id_fkey" FOREIGN KEY ("board_id") REFERENCES "sd_cab_boards"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_approval_rounds" ADD CONSTRAINT "sd_approval_rounds_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_oncall_schedules" ADD CONSTRAINT "sd_oncall_schedules_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_oncall_schedules" ADD CONSTRAINT "sd_oncall_schedules_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "sd_departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_oncall_schedules" ADD CONSTRAINT "sd_oncall_schedules_calendar_id_fkey" FOREIGN KEY ("calendar_id") REFERENCES "sd_business_calendars"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_oncall_schedules" ADD CONSTRAINT "sd_oncall_schedules_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_oncall_layers" ADD CONSTRAINT "sd_oncall_layers_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "sd_oncall_schedules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_oncall_participants" ADD CONSTRAINT "sd_oncall_participants_layer_id_fkey" FOREIGN KEY ("layer_id") REFERENCES "sd_oncall_layers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_oncall_participants" ADD CONSTRAINT "sd_oncall_participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_oncall_overrides" ADD CONSTRAINT "sd_oncall_overrides_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_oncall_overrides" ADD CONSTRAINT "sd_oncall_overrides_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "sd_oncall_schedules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_oncall_overrides" ADD CONSTRAINT "sd_oncall_overrides_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_oncall_overrides" ADD CONSTRAINT "sd_oncall_overrides_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_recurring_tickets" ADD CONSTRAINT "sd_recurring_tickets_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_recurring_tickets" ADD CONSTRAINT "sd_recurring_tickets_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "sd_ticket_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_recurring_tickets" ADD CONSTRAINT "sd_recurring_tickets_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "sd_customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_recurring_tickets" ADD CONSTRAINT "sd_recurring_tickets_config_item_id_fkey" FOREIGN KEY ("config_item_id") REFERENCES "sd_config_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_recurring_tickets" ADD CONSTRAINT "sd_recurring_tickets_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_recurring_ticket_runs" ADD CONSTRAINT "sd_recurring_ticket_runs_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_recurring_ticket_runs" ADD CONSTRAINT "sd_recurring_ticket_runs_recurring_id_fkey" FOREIGN KEY ("recurring_id") REFERENCES "sd_recurring_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_recurring_ticket_runs" ADD CONSTRAINT "sd_recurring_ticket_runs_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "sd_tickets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
