-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    CONSTRAINT "projects_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "projects_user_id_name_idx" ON "projects"("user_id", "name");

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
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
    "has_ai_changes" BOOLEAN NOT NULL DEFAULT false,
    "content_id" TEXT,
    "project_id" TEXT,
    CONSTRAINT "items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "items_content_id_fkey" FOREIGN KEY ("content_id") REFERENCES "agent_contents" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "items_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_items" ("id", "human_id", "user_id", "title", "description", "urgency", "tag", "importance", "deadline", "status", "created_at", "updated_at", "opened_at", "created_by", "modified_by", "has_ai_changes", "content_id") SELECT "id", "human_id", "user_id", "title", "description", "urgency", "tag", "importance", "deadline", "status", "created_at", "updated_at", "opened_at", "created_by", "modified_by", "has_ai_changes", "content_id" FROM "items";
DROP TABLE "items";
ALTER TABLE "new_items" RENAME TO "items";
CREATE UNIQUE INDEX "items_user_id_human_id_key" ON "items"("user_id", "human_id");
CREATE INDEX "items_user_id_status_urgency_idx" ON "items"("user_id", "status", "urgency");
CREATE INDEX "items_user_id_deadline_idx" ON "items"("user_id", "deadline");
CREATE INDEX "items_user_id_updated_at_idx" ON "items"("user_id", "updated_at");
CREATE INDEX "items_user_id_content_id_idx" ON "items"("user_id", "content_id");
CREATE INDEX "items_user_id_project_id_idx" ON "items"("user_id", "project_id");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
