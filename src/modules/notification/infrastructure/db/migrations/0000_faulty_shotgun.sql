CREATE SCHEMA "notification";
--> statement-breakpoint
CREATE TABLE "notification"."notification_recipients" (
	"subscription_id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"unsubscribe_token" text NOT NULL
);
