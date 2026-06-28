CREATE TABLE "notification_recipients" (
	"subscription_id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"unsubscribe_token" text NOT NULL
);
--> statement-breakpoint
INSERT INTO "notification_recipients" ("subscription_id", "email", "unsubscribe_token")
SELECT "subscription_id", "email", "unsubscribe_token"
FROM "repo_watchers";
--> statement-breakpoint
ALTER TABLE "repo_watchers" DROP COLUMN "email";
--> statement-breakpoint
ALTER TABLE "repo_watchers" DROP COLUMN "unsubscribe_token";
