CREATE TYPE "public"."subscription_status" AS ENUM('pending', 'confirmed', 'unsubscribed');--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "status" "subscription_status" DEFAULT 'pending' NOT NULL;--> statement-breakpoint
UPDATE "subscriptions" SET "status" = 'confirmed' WHERE "confirmed" = true;--> statement-breakpoint
ALTER TABLE "subscriptions" DROP COLUMN "confirmed";
