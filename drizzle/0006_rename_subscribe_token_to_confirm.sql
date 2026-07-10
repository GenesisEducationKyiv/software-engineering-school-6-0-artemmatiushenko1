ALTER TABLE "subscriptions" RENAME COLUMN "subscribe_token" TO "confirm_token";--> statement-breakpoint
ALTER TABLE "subscriptions" RENAME COLUMN "subscribe_expires_at" TO "confirm_expires_at";--> statement-breakpoint
ALTER TABLE "subscriptions" RENAME COLUMN "subscribe_used_at" TO "confirm_used_at";--> statement-breakpoint
ALTER INDEX "subscribe_token_unique" RENAME TO "confirm_token_unique";
