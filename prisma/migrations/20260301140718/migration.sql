-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_form_responses" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "content_id" TEXT NOT NULL,
    "item_id" TEXT,
    "response" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL,
    CONSTRAINT "form_responses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "form_responses_content_id_fkey" FOREIGN KEY ("content_id") REFERENCES "agent_contents" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_form_responses" ("content_id", "created_at", "id", "item_id", "response", "user_id") SELECT "content_id", "created_at", "id", "item_id", "response", "user_id" FROM "form_responses";
DROP TABLE "form_responses";
ALTER TABLE "new_form_responses" RENAME TO "form_responses";
CREATE INDEX "form_responses_content_id_idx" ON "form_responses"("content_id");
CREATE TABLE "new_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "human_id" INTEGER NOT NULL,
    "user_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "urgency" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    "importance" TEXT NOT NULL,
    "deadline" TEXT,
    "status" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL,
    "updated_at" DATETIME NOT NULL,
    "opened_at" DATETIME NOT NULL,
    "created_by" TEXT NOT NULL,
    "modified_by" TEXT NOT NULL,
    "content_id" TEXT,
    CONSTRAINT "items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "items_content_id_fkey" FOREIGN KEY ("content_id") REFERENCES "agent_contents" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_items" ("content_id", "created_at", "created_by", "deadline", "description", "human_id", "id", "importance", "modified_by", "opened_at", "status", "tag", "title", "updated_at", "urgency", "user_id") SELECT "content_id", "created_at", "created_by", "deadline", "description", "human_id", "id", "importance", "modified_by", "opened_at", "status", "tag", "title", "updated_at", "urgency", "user_id" FROM "items";
DROP TABLE "items";
ALTER TABLE "new_items" RENAME TO "items";
CREATE INDEX "items_user_id_status_urgency_idx" ON "items"("user_id", "status", "urgency");
CREATE INDEX "items_user_id_deadline_idx" ON "items"("user_id", "deadline");
CREATE INDEX "items_user_id_updated_at_idx" ON "items"("user_id", "updated_at");
CREATE UNIQUE INDEX "items_user_id_human_id_key" ON "items"("user_id", "human_id");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
