-- DropForeignKey
ALTER TABLE "coin_bundles" DROP CONSTRAINT "coin_bundles_user_id_fkey";

-- DropForeignKey
ALTER TABLE "event_tickets" DROP CONSTRAINT "event_tickets_user_id_fkey";

-- AddForeignKey
ALTER TABLE "coin_bundles" ADD CONSTRAINT "coin_bundles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_tickets" ADD CONSTRAINT "event_tickets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
