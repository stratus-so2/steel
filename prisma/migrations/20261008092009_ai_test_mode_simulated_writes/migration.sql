-- AlterEnum
ALTER TYPE "AiConversationMode" ADD VALUE 'TEST';

-- AlterEnum
ALTER TYPE "SteelAgentRunStepStatus" ADD VALUE 'SIMULATED';

-- AlterTable
ALTER TABLE "steel_agent_runs" ADD COLUMN     "is_test" BOOLEAN NOT NULL DEFAULT false;
