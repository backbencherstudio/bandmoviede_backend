-- DropForeignKey
ALTER TABLE "coin_bundles" DROP CONSTRAINT "coin_bundles_user_id_fkey";

-- CreateIndex
CREATE INDEX "coin_bundles_user_id_idx" ON "coin_bundles"("user_id");

-- CreateIndex
CREATE INDEX "coin_bundles_status_idx" ON "coin_bundles"("status");

-- CreateIndex
CREATE INDEX "coin_bundles_created_at_idx" ON "coin_bundles"("created_at");

-- CreateIndex
CREATE INDEX "coin_bundles_deleted_at_idx" ON "coin_bundles"("deleted_at");

-- AddForeignKey
ALTER TABLE "coin_bundles" ADD CONSTRAINT "coin_bundles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
