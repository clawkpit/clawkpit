-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "is_active" INTEGER NOT NULL DEFAULT 1,
    "created_at" DATETIME NOT NULL,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "magic_links" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" DATETIME NOT NULL,
    "consumed_at" DATETIME,
    "created_at" DATETIME NOT NULL,
    CONSTRAINT "magic_links_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "expires_at" DATETIME NOT NULL,
    "created_at" DATETIME NOT NULL,
    CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "items" (
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
    CONSTRAINT "items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "notes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "item_id" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "notes_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "user_counters" (
    "user_id" TEXT NOT NULL PRIMARY KEY,
    "next_human_id" INTEGER NOT NULL,
    CONSTRAINT "user_counters_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "api_keys" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "key_hash" TEXT NOT NULL,
    "name" TEXT,
    "created_at" DATETIME NOT NULL,
    CONSTRAINT "api_keys_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "email_change_requests" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "new_email" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" DATETIME NOT NULL,
    "created_at" DATETIME NOT NULL,
    CONSTRAINT "email_change_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "openclaw_devices" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "device_code" TEXT NOT NULL,
    "display_code" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "user_id" TEXT,
    "api_key_id" TEXT,
    "api_token" TEXT,
    "status" TEXT NOT NULL,
    "expires_at" DATETIME NOT NULL,
    "created_at" DATETIME NOT NULL,
    CONSTRAINT "openclaw_devices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "magic_links_token_hash_key" ON "magic_links"("token_hash");

-- CreateIndex
CREATE INDEX "items_user_id_status_urgency_idx" ON "items"("user_id", "status", "urgency");

-- CreateIndex
CREATE INDEX "items_user_id_deadline_idx" ON "items"("user_id", "deadline");

-- CreateIndex
CREATE INDEX "items_user_id_updated_at_idx" ON "items"("user_id", "updated_at");

-- CreateIndex
CREATE UNIQUE INDEX "items_user_id_human_id_key" ON "items"("user_id", "human_id");

-- CreateIndex
CREATE INDEX "notes_item_id_created_at_idx" ON "notes"("item_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_key_hash_key" ON "api_keys"("key_hash");

-- CreateIndex
CREATE INDEX "api_keys_key_hash_idx" ON "api_keys"("key_hash");

-- CreateIndex
CREATE UNIQUE INDEX "email_change_requests_user_id_key" ON "email_change_requests"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "email_change_requests_token_hash_key" ON "email_change_requests"("token_hash");

-- CreateIndex
CREATE UNIQUE INDEX "openclaw_devices_device_code_key" ON "openclaw_devices"("device_code");

-- CreateIndex
CREATE UNIQUE INDEX "openclaw_devices_display_code_key" ON "openclaw_devices"("display_code");

-- CreateIndex
CREATE INDEX "openclaw_devices_device_code_idx" ON "openclaw_devices"("device_code");

-- CreateIndex
CREATE INDEX "openclaw_devices_display_code_idx" ON "openclaw_devices"("display_code");

-- CreateIndex
CREATE INDEX "openclaw_devices_expires_at_idx" ON "openclaw_devices"("expires_at");
