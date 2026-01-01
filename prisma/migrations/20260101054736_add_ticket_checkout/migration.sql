/*
  Warnings:

  - You are about to drop the `ucodes` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "ucodes" DROP CONSTRAINT "ucodes_user_id_fkey";

-- DropTable
DROP TABLE "ucodes";

-- CreateTable
CREATE TABLE "ticket_codes" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" SMALLINT DEFAULT 1,
    "user_id" TEXT,
    "token" TEXT,
    "email" TEXT,
    "expired_at" TIMESTAMP(3),

    CONSTRAINT "ticket_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_checkouts" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_id" TEXT NOT NULL,

    CONSTRAINT "ticket_checkouts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_checkout_items" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ticket_checkout_id" TEXT NOT NULL,
    "event_ticket_id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "ticket_checkout_items_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ticket_codes" ADD CONSTRAINT "ticket_codes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_checkouts" ADD CONSTRAINT "ticket_checkouts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_checkout_items" ADD CONSTRAINT "ticket_checkout_items_ticket_checkout_id_fkey" FOREIGN KEY ("ticket_checkout_id") REFERENCES "ticket_checkouts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_checkout_items" ADD CONSTRAINT "ticket_checkout_items_event_ticket_id_fkey" FOREIGN KEY ("event_ticket_id") REFERENCES "event_tickets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
