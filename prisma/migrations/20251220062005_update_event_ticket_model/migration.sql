/*
  Warnings:

  - Made the column `total_sold` on table `event_tickets` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "event_tickets" ADD COLUMN     "about" TEXT,
ADD COLUMN     "include" TEXT[] DEFAULT ARRAY[]::TEXT[],
ALTER COLUMN "revenue" SET DEFAULT 0,
ALTER COLUMN "ticket_price" SET DEFAULT 0,
ALTER COLUMN "total_sold" SET NOT NULL,
ALTER COLUMN "total_sold" SET DEFAULT 0;
