-- DropForeignKey
ALTER TABLE "event_tickets" DROP CONSTRAINT "event_tickets_user_id_fkey";

-- CreateIndex
CREATE INDEX "event_tickets_user_id_idx" ON "event_tickets"("user_id");

-- CreateIndex
CREATE INDEX "event_tickets_status_idx" ON "event_tickets"("status");

-- CreateIndex
CREATE INDEX "event_tickets_created_at_idx" ON "event_tickets"("created_at");

-- CreateIndex
CREATE INDEX "event_tickets_deleted_at_idx" ON "event_tickets"("deleted_at");

-- CreateIndex
CREATE INDEX "event_tickets_event_date_idx" ON "event_tickets"("event_date");

-- CreateIndex
CREATE INDEX "event_tickets_location_idx" ON "event_tickets"("location");

-- AddForeignKey
ALTER TABLE "event_tickets" ADD CONSTRAINT "event_tickets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
