-- CreateEnum
CREATE TYPE "BundleStatus" AS ENUM ('Active', 'Inactive');

-- CreateTable
CREATE TABLE "coin_bundles" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),
    "name" INTEGER NOT NULL,
    "price" INTEGER NOT NULL,
    "coin_amount" INTEGER NOT NULL,
    "total_cell" INTEGER NOT NULL,
    "status" "BundleStatus" NOT NULL DEFAULT 'Active',
    "user_id" TEXT,

    CONSTRAINT "coin_bundles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_tickets" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),
    "event_name" TEXT NOT NULL,
    "event_date" TIMESTAMP(3) NOT NULL,
    "revenue" INTEGER NOT NULL,
    "ticket_price" INTEGER NOT NULL,
    "total_sold" INTEGER NOT NULL,
    "status" "BundleStatus" NOT NULL DEFAULT 'Active',
    "user_id" TEXT,

    CONSTRAINT "event_tickets_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "coin_bundles" ADD CONSTRAINT "coin_bundles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_tickets" ADD CONSTRAINT "event_tickets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
