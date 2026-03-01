-- RedefineTables: restore item_id FK on form_responses (dropped by 20260301140718 table recreation)
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
    CONSTRAINT "form_responses_content_id_fkey" FOREIGN KEY ("content_id") REFERENCES "agent_contents" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "form_responses_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_form_responses" ("id", "user_id", "content_id", "item_id", "response", "created_at") SELECT "id", "user_id", "content_id", "item_id", "response", "created_at" FROM "form_responses";
DROP TABLE "form_responses";
ALTER TABLE "new_form_responses" RENAME TO "form_responses";
CREATE INDEX "form_responses_content_id_idx" ON "form_responses"("content_id");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
