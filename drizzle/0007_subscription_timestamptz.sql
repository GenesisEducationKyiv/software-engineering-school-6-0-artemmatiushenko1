ALTER TABLE "subscriptions" ALTER COLUMN "confirm_expires_at" SET DATA TYPE timestamp with time zone USING "confirm_expires_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "subscriptions" ALTER COLUMN "confirm_used_at" SET DATA TYPE timestamp with time zone USING "confirm_used_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "subscriptions" ALTER COLUMN "unsubscribe_expires_at" SET DATA TYPE timestamp with time zone USING "unsubscribe_expires_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "subscriptions" ALTER COLUMN "unsubscribe_used_at" SET DATA TYPE timestamp with time zone USING "unsubscribe_used_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "subscriptions" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone USING "created_at" AT TIME ZONE 'UTC';
