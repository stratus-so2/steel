-- CreateEnum
CREATE TYPE "SdTicketType" AS ENUM ('INCIDENT', 'SERVICE_REQUEST', 'CHANGE', 'PROBLEM');

-- CreateEnum
CREATE TYPE "SdPhaseCategory" AS ENUM ('NEW', 'IN_PROGRESS', 'WAITING', 'RESOLVED', 'CLOSED', 'CANCELED');

-- CreateEnum
CREATE TYPE "SdTicketChannel" AS ENUM ('AGENT', 'PORTAL', 'EMAIL', 'WHATSAPP', 'PHONE', 'AI', 'API');

-- CreateEnum
CREATE TYPE "SdChangeType" AS ENUM ('STANDARD', 'NORMAL', 'EMERGENCY');

-- CreateEnum
CREATE TYPE "SdRiskLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'VERY_HIGH');

-- CreateEnum
CREATE TYPE "SdCustomerKind" AS ENUM ('CLIENT', 'COMPANY');

-- CreateEnum
CREATE TYPE "SdPersonType" AS ENUM ('INDIVIDUAL', 'LEGAL');

-- CreateEnum
CREATE TYPE "SdCategoryLevel" AS ENUM ('CATEGORY', 'SUBCATEGORY', 'SERVICE');

-- CreateEnum
CREATE TYPE "SdClassificationKind" AS ENUM ('TICKET', 'SOLUTION');

-- CreateEnum
CREATE TYPE "SdConfigItemStatus" AS ENUM ('PLANNED', 'IN_STOCK', 'ACTIVE', 'MAINTENANCE', 'RETIRED');

-- CreateEnum
CREATE TYPE "SdCustomFieldEntity" AS ENUM ('TICKET', 'CUSTOMER', 'CONTACT', 'CONFIG_ITEM');

-- CreateEnum
CREATE TYPE "SdCustomFieldType" AS ENUM ('TEXT', 'TEXTAREA', 'NUMBER', 'CURRENCY', 'DATE', 'DATETIME', 'CHECKBOX', 'SELECT', 'MULTI_SELECT', 'USER', 'EMAIL', 'URL', 'PHONE');

-- CreateEnum
CREATE TYPE "SdSlaKind" AS ENUM ('SLA', 'OLA');

-- CreateEnum
CREATE TYPE "SdMessageAuthorKind" AS ENUM ('AGENT', 'REQUESTER', 'CONTACT', 'AI', 'SYSTEM');

-- CreateEnum
CREATE TYPE "SdMessageVisibility" AS ENUM ('PUBLIC', 'INTERNAL');

-- CreateEnum
CREATE TYPE "SdMessageChannel" AS ENUM ('PLATFORM', 'WHATSAPP', 'EMAIL');

-- CreateEnum
CREATE TYPE "SdAttachmentKind" AS ENUM ('IMAGE', 'VIDEO', 'AUDIO', 'DOCUMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "SdTaskStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'DONE', 'CANCELED');

-- CreateEnum
CREATE TYPE "SdCostCategory" AS ENUM ('LABOR', 'TRAVEL', 'MATERIAL', 'SERVICE', 'LICENSE', 'OTHER');

-- CreateEnum
CREATE TYPE "SdPartStatus" AS ENUM ('REQUESTED', 'RESERVED', 'INSTALLED', 'RETURNED', 'CANCELED');

-- CreateEnum
CREATE TYPE "SdApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "SdEscalationKind" AS ENUM ('FUNCTIONAL', 'HIERARCHICAL');

-- CreateEnum
CREATE TYPE "SdEscalationTrigger" AS ENUM ('FIRST_RESPONSE_AT_RISK', 'FIRST_RESPONSE_BREACHED', 'RESOLUTION_AT_RISK', 'RESOLUTION_BREACHED', 'NO_UPDATE');

-- CreateEnum
CREATE TYPE "SdAutomationEvent" AS ENUM ('TICKET_CREATED', 'TICKET_UPDATED', 'PHASE_CHANGED', 'MESSAGE_RECEIVED', 'APPROVAL_RESPONDED', 'SLA_AT_RISK', 'SLA_BREACHED');

-- CreateEnum
CREATE TYPE "SdKbArticleStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "SdKbVisibility" AS ENUM ('INTERNAL', 'PORTAL');

-- CreateEnum
CREATE TYPE "SdViewMode" AS ENUM ('KANBAN', 'LIST', 'TABLE');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AiUsageFeature" ADD VALUE 'SERVICEDESK_COPILOT';
ALTER TYPE "AiUsageFeature" ADD VALUE 'SERVICEDESK_PRE_SERVICE';
ALTER TYPE "AiUsageFeature" ADD VALUE 'SERVICEDESK_TRIAGE';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationKind" ADD VALUE 'SD_TICKET_ASSIGNED';
ALTER TYPE "NotificationKind" ADD VALUE 'SD_TICKET_MESSAGE';
ALTER TYPE "NotificationKind" ADD VALUE 'SD_SLA_AT_RISK';
ALTER TYPE "NotificationKind" ADD VALUE 'SD_SLA_BREACHED';
ALTER TYPE "NotificationKind" ADD VALUE 'SD_TICKET_ESCALATED';
ALTER TYPE "NotificationKind" ADD VALUE 'SD_APPROVAL_RESPONDED';

-- AlterTable
ALTER TABLE "whatsapp_connections" ADD COLUMN     "module" "ModuleKind" NOT NULL DEFAULT 'COMMUNICATION';

-- CreateTable
CREATE TABLE "sd_settings" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "next_ticket_number" INTEGER NOT NULL DEFAULT 1,
    "ticket_prefixes" JSONB NOT NULL,
    "default_department_id" TEXT,
    "default_sla_policy_id" TEXT,
    "whatsapp_connection_id" TEXT,
    "portal_enabled" BOOLEAN NOT NULL DEFAULT true,
    "portal_ticket_types" "SdTicketType"[] DEFAULT ARRAY['INCIDENT', 'SERVICE_REQUEST']::"SdTicketType"[],
    "require_signature_on_close" BOOLEAN NOT NULL DEFAULT false,
    "require_solution_on_resolve" BOOLEAN NOT NULL DEFAULT true,
    "auto_close_resolved_after_hours" INTEGER NOT NULL DEFAULT 72,
    "sla_at_risk_percent" INTEGER NOT NULL DEFAULT 80,
    "reopen_on_requester_reply" BOOLEAN NOT NULL DEFAULT true,
    "auto_assign_round_robin" BOOLEAN NOT NULL DEFAULT false,
    "ai_enabled" BOOLEAN NOT NULL DEFAULT false,
    "ai_pre_service_enabled" BOOLEAN NOT NULL DEFAULT false,
    "ai_auto_triage_enabled" BOOLEAN NOT NULL DEFAULT false,
    "ai_whatsapp_auto_reply" BOOLEAN NOT NULL DEFAULT false,
    "ai_persona" TEXT,
    "ai_instructions" TEXT,
    "ai_handoff_keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "updated_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sd_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sd_departments" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "parent_id" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "email" TEXT,
    "color" TEXT,
    "calendar_id" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "sd_departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sd_department_members" (
    "id" TEXT NOT NULL,
    "department_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "is_lead" BOOLEAN NOT NULL DEFAULT false,
    "last_assigned_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sd_department_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sd_customers" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "kind" "SdCustomerKind" NOT NULL DEFAULT 'CLIENT',
    "person_type" "SdPersonType" NOT NULL DEFAULT 'LEGAL',
    "name" TEXT NOT NULL,
    "trade_name" TEXT,
    "document" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "whatsapp" TEXT,
    "zip_code" TEXT,
    "street" TEXT,
    "number" TEXT,
    "complement" TEXT,
    "district" TEXT,
    "city" TEXT,
    "state" TEXT,
    "country" TEXT NOT NULL DEFAULT 'BR',
    "ibge_code" TEXT,
    "notes" TEXT,
    "custom_fields" JSONB NOT NULL DEFAULT '{}',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "sd_customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sd_contacts" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "job_title" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "whatsapp" TEXT,
    "user_id" TEXT,
    "notes" TEXT,
    "custom_fields" JSONB NOT NULL DEFAULT '{}',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "sd_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sd_contact_customers" (
    "contact_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "sd_contact_customers_pkey" PRIMARY KEY ("contact_id","customer_id")
);

-- CreateTable
CREATE TABLE "sd_config_item_types" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT,
    "color" TEXT,
    "attribute_schema" JSONB NOT NULL DEFAULT '[]',
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sd_config_item_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sd_config_items" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "type_id" TEXT,
    "parent_id" TEXT,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "status" "SdConfigItemStatus" NOT NULL DEFAULT 'ACTIVE',
    "criticality" "SdRiskLevel" NOT NULL DEFAULT 'MEDIUM',
    "customer_id" TEXT,
    "department_id" TEXT,
    "owner_id" TEXT,
    "serial_number" TEXT,
    "manufacturer" TEXT,
    "model" TEXT,
    "location" TEXT,
    "ip_address" TEXT,
    "purchased_at" TIMESTAMP(3),
    "warranty_until" TIMESTAMP(3),
    "attributes" JSONB NOT NULL DEFAULT '{}',
    "custom_fields" JSONB NOT NULL DEFAULT '{}',
    "notes" TEXT,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "sd_config_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sd_categories" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "parent_id" TEXT,
    "level" "SdCategoryLevel" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "ticket_types" "SdTicketType"[] DEFAULT ARRAY[]::"SdTicketType"[],
    "department_id" TEXT,
    "sla_policy_id" TEXT,
    "portal_visible" BOOLEAN NOT NULL DEFAULT true,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sd_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sd_classifications" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "kind" "SdClassificationKind" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT,
    "ticket_types" "SdTicketType"[] DEFAULT ARRAY[]::"SdTicketType"[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sd_classifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sd_impacts" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "level" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sd_impacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sd_urgencies" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "level" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sd_urgencies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sd_priorities" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "level" INTEGER NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sd_priorities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sd_priority_matrix" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "impact_id" TEXT NOT NULL,
    "urgency_id" TEXT NOT NULL,
    "priority_id" TEXT NOT NULL,

    CONSTRAINT "sd_priority_matrix_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sd_severities" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT,
    "level" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sd_severities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sd_phases" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "ticket_type" "SdTicketType" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT,
    "category" "SdPhaseCategory" NOT NULL,
    "completion_percent" INTEGER NOT NULL DEFAULT 0,
    "position" INTEGER NOT NULL DEFAULT 0,
    "is_initial" BOOLEAN NOT NULL DEFAULT false,
    "pauses_sla" BOOLEAN NOT NULL DEFAULT false,
    "requires_approval" BOOLEAN NOT NULL DEFAULT false,
    "required_fields" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "wip_limit" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sd_phases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sd_phase_transitions" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "from_phase_id" TEXT NOT NULL,
    "to_phase_id" TEXT NOT NULL,
    "allowed_department_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sd_phase_transitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sd_business_calendars" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
    "schedule" JSONB NOT NULL,
    "holidays" JSONB NOT NULL DEFAULT '[]',
    "is_24x7" BOOLEAN NOT NULL DEFAULT false,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sd_business_calendars_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sd_sla_policies" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "kind" "SdSlaKind" NOT NULL DEFAULT 'SLA',
    "name" TEXT NOT NULL,
    "description" TEXT,
    "calendar_id" TEXT,
    "conditions" JSONB NOT NULL DEFAULT '[]',
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sd_sla_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sd_sla_targets" (
    "id" TEXT NOT NULL,
    "policy_id" TEXT NOT NULL,
    "priority_id" TEXT NOT NULL,
    "first_response_minutes" INTEGER NOT NULL,
    "resolution_minutes" INTEGER NOT NULL,

    CONSTRAINT "sd_sla_targets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sd_escalation_rules" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "trigger" "SdEscalationTrigger" NOT NULL,
    "threshold_minutes" INTEGER,
    "conditions" JSONB NOT NULL DEFAULT '[]',
    "actions" JSONB NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sd_escalation_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sd_automation_rules" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "event" "SdAutomationEvent" NOT NULL,
    "conditions" JSONB NOT NULL DEFAULT '[]',
    "actions" JSONB NOT NULL DEFAULT '[]',
    "stop_processing" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,
    "run_count" INTEGER NOT NULL DEFAULT 0,
    "last_run_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sd_automation_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sd_custom_field_definitions" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "entity" "SdCustomFieldEntity" NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "type" "SdCustomFieldType" NOT NULL,
    "options" JSONB NOT NULL DEFAULT '[]',
    "ticket_types" "SdTicketType"[] DEFAULT ARRAY[]::"SdTicketType"[],
    "category_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "required" BOOLEAN NOT NULL DEFAULT false,
    "visible_in_portal" BOOLEAN NOT NULL DEFAULT false,
    "default_value" JSONB,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sd_custom_field_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sd_ticket_templates" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "ticket_type" "SdTicketType" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "defaults" JSONB NOT NULL DEFAULT '{}',
    "tasks" JSONB NOT NULL DEFAULT '[]',
    "portal_visible" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sd_ticket_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sd_canned_responses" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "shortcut" TEXT,
    "body" TEXT NOT NULL,
    "department_id" TEXT,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sd_canned_responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sd_parts" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sku" TEXT,
    "description" TEXT,
    "unit_cost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "stock" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sd_parts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sd_tickets" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "type" "SdTicketType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "channel" "SdTicketChannel" NOT NULL DEFAULT 'AGENT',
    "phase_id" TEXT NOT NULL,
    "completion_percent" INTEGER NOT NULL DEFAULT 0,
    "impact_id" TEXT,
    "urgency_id" TEXT,
    "priority_id" TEXT,
    "severity_id" TEXT,
    "category_id" TEXT,
    "subcategory_id" TEXT,
    "service_id" TEXT,
    "classification_id" TEXT,
    "solution_classification_id" TEXT,
    "solution" TEXT,
    "customer_id" TEXT,
    "company_id" TEXT,
    "contact_id" TEXT,
    "config_item_id" TEXT,
    "department_id" TEXT,
    "assignee_id" TEXT,
    "requester_id" TEXT,
    "template_id" TEXT,
    "parent_id" TEXT,
    "whatsapp_conversation_id" TEXT,
    "escalation_level" INTEGER NOT NULL DEFAULT 0,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "custom_fields" JSONB NOT NULL DEFAULT '{}',
    "sla_policy_id" TEXT,
    "first_response_due_at" TIMESTAMP(3),
    "resolution_due_at" TIMESTAMP(3),
    "first_responded_at" TIMESTAMP(3),
    "sla_paused_at" TIMESTAMP(3),
    "sla_paused_minutes" INTEGER NOT NULL DEFAULT 0,
    "first_response_breached" BOOLEAN NOT NULL DEFAULT false,
    "resolution_breached" BOOLEAN NOT NULL DEFAULT false,
    "sla_at_risk_notified_at" TIMESTAMP(3),
    "resolved_at" TIMESTAMP(3),
    "closed_at" TIMESTAMP(3),
    "reopen_count" INTEGER NOT NULL DEFAULT 0,
    "change_type" "SdChangeType",
    "change_risk" "SdRiskLevel",
    "planned_start_at" TIMESTAMP(3),
    "planned_end_at" TIMESTAMP(3),
    "implementation_plan" TEXT,
    "rollback_plan" TEXT,
    "test_plan" TEXT,
    "root_cause" TEXT,
    "workaround" TEXT,
    "known_error" BOOLEAN NOT NULL DEFAULT false,
    "ai_summary" TEXT,
    "ai_triage" JSONB,
    "csat_score" INTEGER,
    "csat_comment" TEXT,
    "last_activity_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "sd_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sd_ticket_participants" (
    "ticket_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "added_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sd_ticket_participants_pkey" PRIMARY KEY ("ticket_id","user_id")
);

-- CreateTable
CREATE TABLE "sd_ticket_messages" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "ticket_id" TEXT NOT NULL,
    "author_kind" "SdMessageAuthorKind" NOT NULL,
    "author_user_id" TEXT,
    "author_contact_id" TEXT,
    "visibility" "SdMessageVisibility" NOT NULL DEFAULT 'PUBLIC',
    "channel" "SdMessageChannel" NOT NULL DEFAULT 'PLATFORM',
    "body" TEXT NOT NULL,
    "whatsapp_message_id" TEXT,
    "edited_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "sd_ticket_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sd_ticket_attachments" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "ticket_id" TEXT NOT NULL,
    "message_id" TEXT,
    "uploaded_by_id" TEXT,
    "kind" "SdAttachmentKind" NOT NULL,
    "file_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "storage_key" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "sd_ticket_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sd_ticket_tasks" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "ticket_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "SdTaskStatus" NOT NULL DEFAULT 'TODO',
    "assignee_id" TEXT,
    "due_date" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sd_ticket_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sd_ticket_costs" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "ticket_id" TEXT NOT NULL,
    "category" "SdCostCategory" NOT NULL DEFAULT 'OTHER',
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(12,2) NOT NULL DEFAULT 1,
    "unit_cost" DECIMAL(14,2) NOT NULL,
    "billable" BOOLEAN NOT NULL DEFAULT false,
    "incurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_id" TEXT,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sd_ticket_costs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sd_ticket_parts" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "ticket_id" TEXT NOT NULL,
    "part_id" TEXT,
    "name" TEXT NOT NULL,
    "sku" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unit_cost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "serial_number" TEXT,
    "status" "SdPartStatus" NOT NULL DEFAULT 'REQUESTED',
    "notes" TEXT,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sd_ticket_parts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sd_ticket_approvals" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "ticket_id" TEXT NOT NULL,
    "approver_name" TEXT,
    "approver_email" TEXT NOT NULL,
    "approver_user_id" TEXT,
    "token_hash" TEXT NOT NULL,
    "status" "SdApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "message" TEXT,
    "comment" TEXT,
    "requested_by_id" TEXT NOT NULL,
    "sent_at" TIMESTAMP(3),
    "responded_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sd_ticket_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sd_ticket_escalations" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "ticket_id" TEXT NOT NULL,
    "kind" "SdEscalationKind" NOT NULL,
    "from_level" INTEGER NOT NULL,
    "to_level" INTEGER NOT NULL,
    "from_department_id" TEXT,
    "to_department_id" TEXT,
    "from_assignee_id" TEXT,
    "to_assignee_id" TEXT,
    "reason" TEXT NOT NULL,
    "automatic" BOOLEAN NOT NULL DEFAULT false,
    "rule_id" TEXT,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sd_ticket_escalations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sd_ticket_events" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "ticket_id" TEXT NOT NULL,
    "actor_kind" "SdMessageAuthorKind" NOT NULL,
    "actor_user_id" TEXT,
    "action" TEXT NOT NULL,
    "field" TEXT,
    "from_value" JSONB,
    "to_value" JSONB,
    "meta" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sd_ticket_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sd_ticket_signatures" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "ticket_id" TEXT NOT NULL,
    "purpose" TEXT NOT NULL DEFAULT 'Aceite do atendimento',
    "signer_name" TEXT NOT NULL,
    "signer_document" TEXT,
    "signer_email" TEXT,
    "signed_by_id" TEXT,
    "storage_key" TEXT NOT NULL,
    "image_sha256" TEXT NOT NULL,
    "ticket_sha256" TEXT NOT NULL,
    "signed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sd_ticket_signatures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sd_saved_views" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ticket_type" "SdTicketType",
    "mode" "SdViewMode" NOT NULL DEFAULT 'KANBAN',
    "filters" JSONB NOT NULL DEFAULT '{}',
    "sort" JSONB NOT NULL DEFAULT '[]',
    "columns" JSONB NOT NULL DEFAULT '[]',
    "shared" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sd_saved_views_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sd_kb_articles" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "parent_id" TEXT,
    "title" TEXT NOT NULL,
    "icon" TEXT,
    "cover_image" TEXT,
    "content" JSONB NOT NULL,
    "plain_text" TEXT NOT NULL DEFAULT '',
    "status" "SdKbArticleStatus" NOT NULL DEFAULT 'DRAFT',
    "visibility" "SdKbVisibility" NOT NULL DEFAULT 'INTERNAL',
    "category_id" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "position" INTEGER NOT NULL DEFAULT 0,
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "helpful_count" INTEGER NOT NULL DEFAULT 0,
    "not_helpful_count" INTEGER NOT NULL DEFAULT 0,
    "published_at" TIMESTAMP(3),
    "created_by_id" TEXT,
    "updated_by_id" TEXT,
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sd_kb_articles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sd_kb_comments" (
    "id" TEXT NOT NULL,
    "article_id" TEXT NOT NULL,
    "author_id" TEXT,
    "parent_id" TEXT,
    "mark_id" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolved_at" TIMESTAMP(3),
    "resolved_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sd_kb_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sd_ticket_kb_links" (
    "ticket_id" TEXT NOT NULL,
    "article_id" TEXT NOT NULL,
    "linked_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sd_ticket_kb_links_pkey" PRIMARY KEY ("ticket_id","article_id")
);

-- CreateTable
CREATE TABLE "sd_ai_conversations" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "user_id" TEXT,
    "mode" TEXT NOT NULL,
    "ticket_id" TEXT,
    "outcome" TEXT,
    "messages" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sd_ai_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sd_settings_workspace_id_key" ON "sd_settings"("workspace_id");

-- CreateIndex
CREATE INDEX "sd_departments_workspace_id_idx" ON "sd_departments"("workspace_id");

-- CreateIndex
CREATE INDEX "sd_departments_parent_id_idx" ON "sd_departments"("parent_id");

-- CreateIndex
CREATE INDEX "sd_department_members_user_id_idx" ON "sd_department_members"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "sd_department_members_department_id_user_id_key" ON "sd_department_members"("department_id", "user_id");

-- CreateIndex
CREATE INDEX "sd_customers_workspace_id_kind_idx" ON "sd_customers"("workspace_id", "kind");

-- CreateIndex
CREATE INDEX "sd_customers_workspace_id_document_idx" ON "sd_customers"("workspace_id", "document");

-- CreateIndex
CREATE INDEX "sd_customers_deleted_at_idx" ON "sd_customers"("deleted_at");

-- CreateIndex
CREATE INDEX "sd_contacts_workspace_id_idx" ON "sd_contacts"("workspace_id");

-- CreateIndex
CREATE INDEX "sd_contacts_workspace_id_email_idx" ON "sd_contacts"("workspace_id", "email");

-- CreateIndex
CREATE INDEX "sd_contacts_workspace_id_whatsapp_idx" ON "sd_contacts"("workspace_id", "whatsapp");

-- CreateIndex
CREATE INDEX "sd_contacts_user_id_idx" ON "sd_contacts"("user_id");

-- CreateIndex
CREATE INDEX "sd_contacts_deleted_at_idx" ON "sd_contacts"("deleted_at");

-- CreateIndex
CREATE INDEX "sd_contact_customers_customer_id_idx" ON "sd_contact_customers"("customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "sd_config_item_types_workspace_id_name_key" ON "sd_config_item_types"("workspace_id", "name");

-- CreateIndex
CREATE INDEX "sd_config_items_workspace_id_idx" ON "sd_config_items"("workspace_id");

-- CreateIndex
CREATE INDEX "sd_config_items_customer_id_idx" ON "sd_config_items"("customer_id");

-- CreateIndex
CREATE INDEX "sd_config_items_type_id_idx" ON "sd_config_items"("type_id");

-- CreateIndex
CREATE INDEX "sd_config_items_deleted_at_idx" ON "sd_config_items"("deleted_at");

-- CreateIndex
CREATE INDEX "sd_categories_workspace_id_level_idx" ON "sd_categories"("workspace_id", "level");

-- CreateIndex
CREATE INDEX "sd_categories_parent_id_idx" ON "sd_categories"("parent_id");

-- CreateIndex
CREATE INDEX "sd_classifications_workspace_id_kind_idx" ON "sd_classifications"("workspace_id", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "sd_impacts_workspace_id_level_key" ON "sd_impacts"("workspace_id", "level");

-- CreateIndex
CREATE UNIQUE INDEX "sd_urgencies_workspace_id_level_key" ON "sd_urgencies"("workspace_id", "level");

-- CreateIndex
CREATE UNIQUE INDEX "sd_priorities_workspace_id_level_key" ON "sd_priorities"("workspace_id", "level");

-- CreateIndex
CREATE INDEX "sd_priority_matrix_workspace_id_idx" ON "sd_priority_matrix"("workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "sd_priority_matrix_impact_id_urgency_id_key" ON "sd_priority_matrix"("impact_id", "urgency_id");

-- CreateIndex
CREATE UNIQUE INDEX "sd_severities_workspace_id_level_key" ON "sd_severities"("workspace_id", "level");

-- CreateIndex
CREATE INDEX "sd_phases_workspace_id_ticket_type_position_idx" ON "sd_phases"("workspace_id", "ticket_type", "position");

-- CreateIndex
CREATE INDEX "sd_phase_transitions_workspace_id_idx" ON "sd_phase_transitions"("workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "sd_phase_transitions_from_phase_id_to_phase_id_key" ON "sd_phase_transitions"("from_phase_id", "to_phase_id");

-- CreateIndex
CREATE INDEX "sd_sla_policies_workspace_id_position_idx" ON "sd_sla_policies"("workspace_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "sd_sla_targets_policy_id_priority_id_key" ON "sd_sla_targets"("policy_id", "priority_id");

-- CreateIndex
CREATE INDEX "sd_escalation_rules_workspace_id_trigger_idx" ON "sd_escalation_rules"("workspace_id", "trigger");

-- CreateIndex
CREATE INDEX "sd_automation_rules_workspace_id_event_position_idx" ON "sd_automation_rules"("workspace_id", "event", "position");

-- CreateIndex
CREATE UNIQUE INDEX "sd_custom_field_definitions_workspace_id_entity_key_key" ON "sd_custom_field_definitions"("workspace_id", "entity", "key");

-- CreateIndex
CREATE INDEX "sd_ticket_templates_workspace_id_ticket_type_idx" ON "sd_ticket_templates"("workspace_id", "ticket_type");

-- CreateIndex
CREATE INDEX "sd_canned_responses_workspace_id_idx" ON "sd_canned_responses"("workspace_id");

-- CreateIndex
CREATE INDEX "sd_parts_workspace_id_idx" ON "sd_parts"("workspace_id");

-- CreateIndex
CREATE INDEX "sd_tickets_workspace_id_type_phase_id_idx" ON "sd_tickets"("workspace_id", "type", "phase_id");

-- CreateIndex
CREATE INDEX "sd_tickets_workspace_id_assignee_id_idx" ON "sd_tickets"("workspace_id", "assignee_id");

-- CreateIndex
CREATE INDEX "sd_tickets_workspace_id_department_id_idx" ON "sd_tickets"("workspace_id", "department_id");

-- CreateIndex
CREATE INDEX "sd_tickets_workspace_id_requester_id_idx" ON "sd_tickets"("workspace_id", "requester_id");

-- CreateIndex
CREATE INDEX "sd_tickets_workspace_id_customer_id_idx" ON "sd_tickets"("workspace_id", "customer_id");

-- CreateIndex
CREATE INDEX "sd_tickets_workspace_id_resolution_due_at_idx" ON "sd_tickets"("workspace_id", "resolution_due_at");

-- CreateIndex
CREATE INDEX "sd_tickets_workspace_id_created_at_idx" ON "sd_tickets"("workspace_id", "created_at");

-- CreateIndex
CREATE INDEX "sd_tickets_parent_id_idx" ON "sd_tickets"("parent_id");

-- CreateIndex
CREATE INDEX "sd_tickets_whatsapp_conversation_id_idx" ON "sd_tickets"("whatsapp_conversation_id");

-- CreateIndex
CREATE INDEX "sd_tickets_deleted_at_idx" ON "sd_tickets"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "sd_tickets_workspace_id_number_key" ON "sd_tickets"("workspace_id", "number");

-- CreateIndex
CREATE INDEX "sd_ticket_participants_user_id_idx" ON "sd_ticket_participants"("user_id");

-- CreateIndex
CREATE INDEX "sd_ticket_messages_ticket_id_created_at_idx" ON "sd_ticket_messages"("ticket_id", "created_at");

-- CreateIndex
CREATE INDEX "sd_ticket_messages_workspace_id_created_at_idx" ON "sd_ticket_messages"("workspace_id", "created_at");

-- CreateIndex
CREATE INDEX "sd_ticket_attachments_ticket_id_idx" ON "sd_ticket_attachments"("ticket_id");

-- CreateIndex
CREATE INDEX "sd_ticket_attachments_message_id_idx" ON "sd_ticket_attachments"("message_id");

-- CreateIndex
CREATE INDEX "sd_ticket_tasks_ticket_id_position_idx" ON "sd_ticket_tasks"("ticket_id", "position");

-- CreateIndex
CREATE INDEX "sd_ticket_tasks_workspace_id_assignee_id_idx" ON "sd_ticket_tasks"("workspace_id", "assignee_id");

-- CreateIndex
CREATE INDEX "sd_ticket_costs_ticket_id_idx" ON "sd_ticket_costs"("ticket_id");

-- CreateIndex
CREATE INDEX "sd_ticket_parts_ticket_id_idx" ON "sd_ticket_parts"("ticket_id");

-- CreateIndex
CREATE UNIQUE INDEX "sd_ticket_approvals_token_hash_key" ON "sd_ticket_approvals"("token_hash");

-- CreateIndex
CREATE INDEX "sd_ticket_approvals_ticket_id_idx" ON "sd_ticket_approvals"("ticket_id");

-- CreateIndex
CREATE INDEX "sd_ticket_approvals_workspace_id_status_idx" ON "sd_ticket_approvals"("workspace_id", "status");

-- CreateIndex
CREATE INDEX "sd_ticket_escalations_ticket_id_idx" ON "sd_ticket_escalations"("ticket_id");

-- CreateIndex
CREATE INDEX "sd_ticket_events_ticket_id_created_at_idx" ON "sd_ticket_events"("ticket_id", "created_at");

-- CreateIndex
CREATE INDEX "sd_ticket_events_workspace_id_action_created_at_idx" ON "sd_ticket_events"("workspace_id", "action", "created_at");

-- CreateIndex
CREATE INDEX "sd_ticket_signatures_ticket_id_idx" ON "sd_ticket_signatures"("ticket_id");

-- CreateIndex
CREATE INDEX "sd_saved_views_workspace_id_user_id_idx" ON "sd_saved_views"("workspace_id", "user_id");

-- CreateIndex
CREATE INDEX "sd_kb_articles_workspace_id_parent_id_idx" ON "sd_kb_articles"("workspace_id", "parent_id");

-- CreateIndex
CREATE INDEX "sd_kb_articles_workspace_id_status_visibility_idx" ON "sd_kb_articles"("workspace_id", "status", "visibility");

-- CreateIndex
CREATE INDEX "sd_kb_comments_article_id_mark_id_idx" ON "sd_kb_comments"("article_id", "mark_id");

-- CreateIndex
CREATE INDEX "sd_ticket_kb_links_article_id_idx" ON "sd_ticket_kb_links"("article_id");

-- CreateIndex
CREATE INDEX "sd_ai_conversations_workspace_id_user_id_idx" ON "sd_ai_conversations"("workspace_id", "user_id");

-- CreateIndex
CREATE INDEX "sd_ai_conversations_ticket_id_idx" ON "sd_ai_conversations"("ticket_id");

-- AddForeignKey
ALTER TABLE "sd_settings" ADD CONSTRAINT "sd_settings_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_departments" ADD CONSTRAINT "sd_departments_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_departments" ADD CONSTRAINT "sd_departments_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "sd_departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_departments" ADD CONSTRAINT "sd_departments_calendar_id_fkey" FOREIGN KEY ("calendar_id") REFERENCES "sd_business_calendars"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_department_members" ADD CONSTRAINT "sd_department_members_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "sd_departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_department_members" ADD CONSTRAINT "sd_department_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_customers" ADD CONSTRAINT "sd_customers_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_customers" ADD CONSTRAINT "sd_customers_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_contacts" ADD CONSTRAINT "sd_contacts_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_contacts" ADD CONSTRAINT "sd_contacts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_contacts" ADD CONSTRAINT "sd_contacts_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_contact_customers" ADD CONSTRAINT "sd_contact_customers_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "sd_contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_contact_customers" ADD CONSTRAINT "sd_contact_customers_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "sd_customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_config_item_types" ADD CONSTRAINT "sd_config_item_types_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_config_items" ADD CONSTRAINT "sd_config_items_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_config_items" ADD CONSTRAINT "sd_config_items_type_id_fkey" FOREIGN KEY ("type_id") REFERENCES "sd_config_item_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_config_items" ADD CONSTRAINT "sd_config_items_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "sd_config_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_config_items" ADD CONSTRAINT "sd_config_items_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "sd_customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_config_items" ADD CONSTRAINT "sd_config_items_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "sd_departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_config_items" ADD CONSTRAINT "sd_config_items_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_config_items" ADD CONSTRAINT "sd_config_items_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_categories" ADD CONSTRAINT "sd_categories_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_categories" ADD CONSTRAINT "sd_categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "sd_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_categories" ADD CONSTRAINT "sd_categories_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "sd_departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_categories" ADD CONSTRAINT "sd_categories_sla_policy_id_fkey" FOREIGN KEY ("sla_policy_id") REFERENCES "sd_sla_policies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_classifications" ADD CONSTRAINT "sd_classifications_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_impacts" ADD CONSTRAINT "sd_impacts_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_urgencies" ADD CONSTRAINT "sd_urgencies_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_priorities" ADD CONSTRAINT "sd_priorities_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_priority_matrix" ADD CONSTRAINT "sd_priority_matrix_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_priority_matrix" ADD CONSTRAINT "sd_priority_matrix_impact_id_fkey" FOREIGN KEY ("impact_id") REFERENCES "sd_impacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_priority_matrix" ADD CONSTRAINT "sd_priority_matrix_urgency_id_fkey" FOREIGN KEY ("urgency_id") REFERENCES "sd_urgencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_priority_matrix" ADD CONSTRAINT "sd_priority_matrix_priority_id_fkey" FOREIGN KEY ("priority_id") REFERENCES "sd_priorities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_severities" ADD CONSTRAINT "sd_severities_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_phases" ADD CONSTRAINT "sd_phases_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_phase_transitions" ADD CONSTRAINT "sd_phase_transitions_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_phase_transitions" ADD CONSTRAINT "sd_phase_transitions_from_phase_id_fkey" FOREIGN KEY ("from_phase_id") REFERENCES "sd_phases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_phase_transitions" ADD CONSTRAINT "sd_phase_transitions_to_phase_id_fkey" FOREIGN KEY ("to_phase_id") REFERENCES "sd_phases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_business_calendars" ADD CONSTRAINT "sd_business_calendars_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_sla_policies" ADD CONSTRAINT "sd_sla_policies_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_sla_policies" ADD CONSTRAINT "sd_sla_policies_calendar_id_fkey" FOREIGN KEY ("calendar_id") REFERENCES "sd_business_calendars"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_sla_targets" ADD CONSTRAINT "sd_sla_targets_policy_id_fkey" FOREIGN KEY ("policy_id") REFERENCES "sd_sla_policies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_sla_targets" ADD CONSTRAINT "sd_sla_targets_priority_id_fkey" FOREIGN KEY ("priority_id") REFERENCES "sd_priorities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_escalation_rules" ADD CONSTRAINT "sd_escalation_rules_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_automation_rules" ADD CONSTRAINT "sd_automation_rules_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_custom_field_definitions" ADD CONSTRAINT "sd_custom_field_definitions_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_ticket_templates" ADD CONSTRAINT "sd_ticket_templates_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_canned_responses" ADD CONSTRAINT "sd_canned_responses_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_canned_responses" ADD CONSTRAINT "sd_canned_responses_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_parts" ADD CONSTRAINT "sd_parts_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_tickets" ADD CONSTRAINT "sd_tickets_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_tickets" ADD CONSTRAINT "sd_tickets_phase_id_fkey" FOREIGN KEY ("phase_id") REFERENCES "sd_phases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_tickets" ADD CONSTRAINT "sd_tickets_impact_id_fkey" FOREIGN KEY ("impact_id") REFERENCES "sd_impacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_tickets" ADD CONSTRAINT "sd_tickets_urgency_id_fkey" FOREIGN KEY ("urgency_id") REFERENCES "sd_urgencies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_tickets" ADD CONSTRAINT "sd_tickets_priority_id_fkey" FOREIGN KEY ("priority_id") REFERENCES "sd_priorities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_tickets" ADD CONSTRAINT "sd_tickets_severity_id_fkey" FOREIGN KEY ("severity_id") REFERENCES "sd_severities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_tickets" ADD CONSTRAINT "sd_tickets_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "sd_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_tickets" ADD CONSTRAINT "sd_tickets_subcategory_id_fkey" FOREIGN KEY ("subcategory_id") REFERENCES "sd_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_tickets" ADD CONSTRAINT "sd_tickets_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "sd_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_tickets" ADD CONSTRAINT "sd_tickets_classification_id_fkey" FOREIGN KEY ("classification_id") REFERENCES "sd_classifications"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_tickets" ADD CONSTRAINT "sd_tickets_solution_classification_id_fkey" FOREIGN KEY ("solution_classification_id") REFERENCES "sd_classifications"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_tickets" ADD CONSTRAINT "sd_tickets_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "sd_customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_tickets" ADD CONSTRAINT "sd_tickets_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "sd_customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_tickets" ADD CONSTRAINT "sd_tickets_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "sd_contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_tickets" ADD CONSTRAINT "sd_tickets_config_item_id_fkey" FOREIGN KEY ("config_item_id") REFERENCES "sd_config_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_tickets" ADD CONSTRAINT "sd_tickets_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "sd_departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_tickets" ADD CONSTRAINT "sd_tickets_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_tickets" ADD CONSTRAINT "sd_tickets_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_tickets" ADD CONSTRAINT "sd_tickets_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_tickets" ADD CONSTRAINT "sd_tickets_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "sd_ticket_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_tickets" ADD CONSTRAINT "sd_tickets_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "sd_tickets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_tickets" ADD CONSTRAINT "sd_tickets_whatsapp_conversation_id_fkey" FOREIGN KEY ("whatsapp_conversation_id") REFERENCES "whatsapp_conversations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_tickets" ADD CONSTRAINT "sd_tickets_sla_policy_id_fkey" FOREIGN KEY ("sla_policy_id") REFERENCES "sd_sla_policies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_ticket_participants" ADD CONSTRAINT "sd_ticket_participants_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "sd_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_ticket_participants" ADD CONSTRAINT "sd_ticket_participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_ticket_messages" ADD CONSTRAINT "sd_ticket_messages_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_ticket_messages" ADD CONSTRAINT "sd_ticket_messages_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "sd_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_ticket_messages" ADD CONSTRAINT "sd_ticket_messages_author_user_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_ticket_messages" ADD CONSTRAINT "sd_ticket_messages_author_contact_id_fkey" FOREIGN KEY ("author_contact_id") REFERENCES "sd_contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_ticket_attachments" ADD CONSTRAINT "sd_ticket_attachments_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_ticket_attachments" ADD CONSTRAINT "sd_ticket_attachments_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "sd_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_ticket_attachments" ADD CONSTRAINT "sd_ticket_attachments_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "sd_ticket_messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_ticket_attachments" ADD CONSTRAINT "sd_ticket_attachments_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_ticket_tasks" ADD CONSTRAINT "sd_ticket_tasks_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_ticket_tasks" ADD CONSTRAINT "sd_ticket_tasks_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "sd_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_ticket_tasks" ADD CONSTRAINT "sd_ticket_tasks_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_ticket_tasks" ADD CONSTRAINT "sd_ticket_tasks_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_ticket_costs" ADD CONSTRAINT "sd_ticket_costs_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_ticket_costs" ADD CONSTRAINT "sd_ticket_costs_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "sd_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_ticket_costs" ADD CONSTRAINT "sd_ticket_costs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_ticket_costs" ADD CONSTRAINT "sd_ticket_costs_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_ticket_parts" ADD CONSTRAINT "sd_ticket_parts_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_ticket_parts" ADD CONSTRAINT "sd_ticket_parts_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "sd_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_ticket_parts" ADD CONSTRAINT "sd_ticket_parts_part_id_fkey" FOREIGN KEY ("part_id") REFERENCES "sd_parts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_ticket_parts" ADD CONSTRAINT "sd_ticket_parts_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_ticket_approvals" ADD CONSTRAINT "sd_ticket_approvals_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_ticket_approvals" ADD CONSTRAINT "sd_ticket_approvals_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "sd_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_ticket_approvals" ADD CONSTRAINT "sd_ticket_approvals_approver_user_id_fkey" FOREIGN KEY ("approver_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_ticket_approvals" ADD CONSTRAINT "sd_ticket_approvals_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_ticket_escalations" ADD CONSTRAINT "sd_ticket_escalations_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_ticket_escalations" ADD CONSTRAINT "sd_ticket_escalations_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "sd_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_ticket_escalations" ADD CONSTRAINT "sd_ticket_escalations_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_ticket_events" ADD CONSTRAINT "sd_ticket_events_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_ticket_events" ADD CONSTRAINT "sd_ticket_events_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "sd_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_ticket_events" ADD CONSTRAINT "sd_ticket_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_ticket_signatures" ADD CONSTRAINT "sd_ticket_signatures_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_ticket_signatures" ADD CONSTRAINT "sd_ticket_signatures_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "sd_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_ticket_signatures" ADD CONSTRAINT "sd_ticket_signatures_signed_by_id_fkey" FOREIGN KEY ("signed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_saved_views" ADD CONSTRAINT "sd_saved_views_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_saved_views" ADD CONSTRAINT "sd_saved_views_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_kb_articles" ADD CONSTRAINT "sd_kb_articles_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_kb_articles" ADD CONSTRAINT "sd_kb_articles_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "sd_kb_articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_kb_articles" ADD CONSTRAINT "sd_kb_articles_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "sd_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_kb_articles" ADD CONSTRAINT "sd_kb_articles_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_kb_articles" ADD CONSTRAINT "sd_kb_articles_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_kb_comments" ADD CONSTRAINT "sd_kb_comments_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "sd_kb_articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_kb_comments" ADD CONSTRAINT "sd_kb_comments_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_kb_comments" ADD CONSTRAINT "sd_kb_comments_resolved_by_id_fkey" FOREIGN KEY ("resolved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_kb_comments" ADD CONSTRAINT "sd_kb_comments_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "sd_kb_comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_ticket_kb_links" ADD CONSTRAINT "sd_ticket_kb_links_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "sd_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_ticket_kb_links" ADD CONSTRAINT "sd_ticket_kb_links_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "sd_kb_articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_ai_conversations" ADD CONSTRAINT "sd_ai_conversations_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_ai_conversations" ADD CONSTRAINT "sd_ai_conversations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
