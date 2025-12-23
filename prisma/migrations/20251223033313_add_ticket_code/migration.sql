-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('VIP', 'General');

-- AlterTable
ALTER TABLE "event_tickets" ADD COLUMN     "ticket_code" TEXT,
ADD COLUMN     "ticket_status" "TicketStatus" NOT NULL DEFAULT 'General';
