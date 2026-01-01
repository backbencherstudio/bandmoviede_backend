-- CreateTable
CREATE TABLE "coin_checkouts" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_id" TEXT NOT NULL,
    "sugo_id" TEXT NOT NULL,

    CONSTRAINT "coin_checkouts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coin_checkout_items" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "coin_checkout_id" TEXT NOT NULL,
    "coin_bundle_id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "coin_checkout_items_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "coin_checkouts" ADD CONSTRAINT "coin_checkouts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coin_checkout_items" ADD CONSTRAINT "coin_checkout_items_coin_checkout_id_fkey" FOREIGN KEY ("coin_checkout_id") REFERENCES "coin_checkouts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coin_checkout_items" ADD CONSTRAINT "coin_checkout_items_coin_bundle_id_fkey" FOREIGN KEY ("coin_bundle_id") REFERENCES "coin_bundles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
