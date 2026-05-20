CREATE TYPE "public"."scope" AS ENUM('subscribe', 'unsubscribe');--> statement-breakpoint
CREATE TABLE "subscription_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"token" text NOT NULL,
	"subscription_id" integer NOT NULL,
	"scope" "scope" NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "repo" text NOT NULL;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "confirmed" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "last_seen_tag" text;--> statement-breakpoint
ALTER TABLE "subscription_tokens" ADD CONSTRAINT "subscription_tokens_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "email_repo_unique" ON "subscriptions" USING btree ("email","repo");--> statement-breakpoint
ALTER TABLE "subscriptions" DROP COLUMN "repo_url";