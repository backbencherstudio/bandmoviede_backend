/*
  Warnings:

  - You are about to drop the column `total_cell` on the `coin_bundles` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "coin_bundles" DROP COLUMN "total_cell",
ADD COLUMN     "total_sold" INTEGER;

-- AlterTable
ALTER TABLE "event_tickets" ALTER COLUMN "total_sold" DROP NOT NULL;
