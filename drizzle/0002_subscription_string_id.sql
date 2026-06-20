ALTER TABLE "subscription_tokens" DROP CONSTRAINT "subscription_tokens_subscription_id_subscriptions_id_fk";--> statement-breakpoint
ALTER TABLE "subscriptions" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "subscriptions" ALTER COLUMN "id" TYPE text USING "id"::text;--> statement-breakpoint
ALTER TABLE "subscription_tokens" ALTER COLUMN "subscription_id" TYPE text USING "subscription_id"::text;--> statement-breakpoint
ALTER TABLE "subscription_tokens" ADD CONSTRAINT "subscription_tokens_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "subscriptions_id_seq";
