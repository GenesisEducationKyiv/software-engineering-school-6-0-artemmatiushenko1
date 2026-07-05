DROP INDEX "platform"."outbox_messages_pending_idx";--> statement-breakpoint
ALTER TABLE "platform"."outbox_messages" ADD COLUMN "attempt_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "platform"."outbox_messages" ADD COLUMN "last_error" text;--> statement-breakpoint
ALTER TABLE "platform"."outbox_messages" ADD COLUMN "dead_lettered_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "outbox_messages_pending_idx" ON "platform"."outbox_messages" USING btree ("created_at") WHERE ("platform"."outbox_messages"."processed_at" is null and "platform"."outbox_messages"."dead_lettered_at" is null);