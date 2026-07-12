CREATE SCHEMA "subscription";
--> statement-breakpoint
CREATE TYPE "subscription"."subscription_status" AS ENUM('pending', 'confirmed', 'unsubscribed');--> statement-breakpoint
CREATE TABLE "subscription"."subscriptions" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"repo" text NOT NULL,
	"status" "subscription"."subscription_status" DEFAULT 'pending' NOT NULL,
	"confirm_token" text NOT NULL,
	"confirm_expires_at" timestamp with time zone NOT NULL,
	"confirm_used_at" timestamp with time zone,
	"unsubscribe_token" text,
	"unsubscribe_used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "email_repo_unique" ON "subscription"."subscriptions" USING btree ("email","repo");--> statement-breakpoint
CREATE UNIQUE INDEX "confirm_token_unique" ON "subscription"."subscriptions" USING btree ("confirm_token");--> statement-breakpoint
CREATE UNIQUE INDEX "unsubscribe_token_unique" ON "subscription"."subscriptions" USING btree ("unsubscribe_token");