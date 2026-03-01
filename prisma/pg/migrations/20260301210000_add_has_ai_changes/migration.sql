-- AlterTable
ALTER TABLE "items" ADD COLUMN IF NOT EXISTS "has_ai_changes" BOOLEAN NOT NULL DEFAULT false;
