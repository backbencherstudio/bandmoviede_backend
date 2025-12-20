/*
  Warnings:

  - You are about to drop the column `event_name` on the `event_tickets` table. All the data in the column will be lost.
  - Added the required column `title` to the `event_tickets` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "coin_bundles" ADD COLUMN     "thumbnail" TEXT;

-- AlterTable
ALTER TABLE "event_tickets" DROP COLUMN "event_name",
ADD COLUMN     "description" TEXT,
ADD COLUMN     "location" TEXT,
ADD COLUMN     "thumbnail" TEXT,
ADD COLUMN     "title" TEXT NOT NULL;
