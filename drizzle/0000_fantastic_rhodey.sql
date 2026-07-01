CREATE TYPE "public"."subscription_status" AS ENUM('pending', 'confirmed', 'unsubscribed');--> statement-breakpoint
CREATE TABLE "monitored_repos" (
	"repo" text PRIMARY KEY NOT NULL,
	"last_seen_tag" text
);
--> statement-breakpoint
CREATE TABLE "notification_recipients" (
	"subscription_id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"unsubscribe_token" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "repo_watchers" (
	"subscription_id" text PRIMARY KEY NOT NULL,
	"repo" text NOT NULL,
	"last_notified_tag" text
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"repo" text NOT NULL,
	"status" "subscription_status" DEFAULT 'pending' NOT NULL,
	"confirm_token" text NOT NULL,
	"confirm_expires_at" timestamp with time zone NOT NULL,
	"confirm_used_at" timestamp with time zone,
	"unsubscribe_token" text,
	"unsubscribe_used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "repo_watchers" ADD CONSTRAINT "repo_watchers_repo_monitored_repos_repo_fk" FOREIGN KEY ("repo") REFERENCES "public"."monitored_repos"("repo") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "repo_watchers_repo_idx" ON "repo_watchers" USING btree ("repo");--> statement-breakpoint
CREATE UNIQUE INDEX "email_repo_unique" ON "subscriptions" USING btree ("email","repo");--> statement-breakpoint
CREATE UNIQUE INDEX "confirm_token_unique" ON "subscriptions" USING btree ("confirm_token");--> statement-breakpoint
CREATE UNIQUE INDEX "unsubscribe_token_unique" ON "subscriptions" USING btree ("unsubscribe_token");