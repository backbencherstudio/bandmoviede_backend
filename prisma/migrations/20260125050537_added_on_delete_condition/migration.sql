-- DropForeignKey
ALTER TABLE "coin_orders" DROP CONSTRAINT "coin_orders_user_id_fkey";

-- DropForeignKey
ALTER TABLE "event_orders" DROP CONSTRAINT "event_orders_user_id_fkey";

-- AlterTable
ALTER TABLE "coin_orders" ALTER COLUMN "user_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "event_orders" ALTER COLUMN "user_id" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "coin_orders" ADD CONSTRAINT "coin_orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_orders" ADD CONSTRAINT "event_orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
