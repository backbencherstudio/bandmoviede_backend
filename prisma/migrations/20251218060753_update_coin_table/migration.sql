-- AlterTable
ALTER TABLE "coin_bundles" ALTER COLUMN "name" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "event_tickets" ADD COLUMN     "sold_limit" INTEGER;
