ALTER TABLE "subscriptions" ADD COLUMN "confirm_token" text;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "confirm_expires_at" timestamp;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "confirm_used_at" timestamp;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "unsubscribe_token" text;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "unsubscribe_expires_at" timestamp;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "unsubscribe_used_at" timestamp;--> statement-breakpoint
UPDATE "subscriptions" SET
  "confirm_token" = t."token",
  "confirm_expires_at" = t."expires_at",
  "confirm_used_at" = t."used_at"
FROM "subscription_tokens" t
WHERE t."subscription_id" = "subscriptions"."id" AND t."scope" = 'subscribe';--> statement-breakpoint
UPDATE "subscriptions" SET
  "unsubscribe_token" = t."token",
  "unsubscribe_expires_at" = t."expires_at",
  "unsubscribe_used_at" = t."used_at"
FROM "subscription_tokens" t
WHERE t."subscription_id" = "subscriptions"."id" AND t."scope" = 'unsubscribe';--> statement-breakpoint
ALTER TABLE "subscriptions" ALTER COLUMN "confirm_token" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "subscriptions" ALTER COLUMN "confirm_expires_at" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "confirm_token_unique" ON "subscriptions" USING btree ("confirm_token");--> statement-breakpoint
CREATE UNIQUE INDEX "unsubscribe_token_unique" ON "subscriptions" USING btree ("unsubscribe_token");--> statement-breakpoint
DROP TABLE "subscription_tokens";--> statement-breakpoint
DROP TYPE "public"."scope";
