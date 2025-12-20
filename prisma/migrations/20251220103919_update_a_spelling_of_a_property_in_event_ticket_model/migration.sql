/*
  Warnings:

  - You are about to drop the column `include` on the `event_tickets` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "event_tickets" DROP COLUMN "include",
ADD COLUMN     "included" TEXT[] DEFAULT ARRAY[]::TEXT[],
ALTER COLUMN "revenue" DROP NOT NULL,
ALTER COLUMN "total_sold" DROP NOT NULL;
