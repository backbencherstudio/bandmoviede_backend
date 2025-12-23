/*
  Warnings:

  - You are about to drop the column `ticket_code` on the `event_tickets` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "event_orders" ADD COLUMN     "ticket_code" TEXT;

-- AlterTable
ALTER TABLE "event_tickets" DROP COLUMN "ticket_code";
