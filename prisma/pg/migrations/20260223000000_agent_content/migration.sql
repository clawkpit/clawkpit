-- CreateTable
CREATE TABLE "agent_contents" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT,
    "body" TEXT NOT NULL,
    "external_id" TEXT,
    "content_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_contents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "form_responses" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "content_id" TEXT NOT NULL,
    "item_id" TEXT,
    "response" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "form_responses_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "items" ADD COLUMN "content_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "agent_contents_user_id_external_id_key" ON "agent_contents"("user_id", "external_id");

-- CreateIndex
CREATE INDEX "agent_contents_user_id_content_hash_idx" ON "agent_contents"("user_id", "content_hash");

-- CreateIndex
CREATE INDEX "form_responses_content_id_idx" ON "form_responses"("content_id");

-- AddForeignKey
ALTER TABLE "agent_contents" ADD CONSTRAINT "agent_contents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_responses" ADD CONSTRAINT "form_responses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_responses" ADD CONSTRAINT "form_responses_content_id_fkey" FOREIGN KEY ("content_id") REFERENCES "agent_contents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_responses" ADD CONSTRAINT "form_responses_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "items" ADD CONSTRAINT "items_content_id_fkey" FOREIGN KEY ("content_id") REFERENCES "agent_contents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
