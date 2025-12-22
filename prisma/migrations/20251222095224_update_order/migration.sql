/*
  Warnings:

  - You are about to drop the column `quantity` on the `event_orders` table. All the data in the column will be lost.
  - Added the required column `sugo_id` to the `coin_orders` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "coin_orders" ADD COLUMN     "sugo_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "event_orders" DROP COLUMN "quantity";
