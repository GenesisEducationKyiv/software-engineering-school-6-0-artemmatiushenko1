CREATE SCHEMA "platform";
--> statement-breakpoint
CREATE TABLE "platform"."outbox_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"event_type" text NOT NULL,
	"aggregate_id" text NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "platform"."processed_deliveries" (
	"message_id" text PRIMARY KEY NOT NULL,
	"processed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "outbox_messages_pending_idx" ON "platform"."outbox_messages" USING btree ("created_at") WHERE "platform"."outbox_messages"."processed_at" is null;