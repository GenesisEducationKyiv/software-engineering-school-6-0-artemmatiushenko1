CREATE TABLE "monitored_repos" (
	"repo" text PRIMARY KEY NOT NULL,
	"last_seen_tag" text
);
--> statement-breakpoint
CREATE TABLE "repo_watchers" (
	"subscription_id" text PRIMARY KEY NOT NULL,
	"repo" text NOT NULL,
	"email" text NOT NULL,
	"unsubscribe_token" text NOT NULL,
	"last_notified_tag" text
);
--> statement-breakpoint
ALTER TABLE "repo_watchers" ADD CONSTRAINT "repo_watchers_repo_monitored_repos_repo_fk" FOREIGN KEY ("repo") REFERENCES "public"."monitored_repos"("repo") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "repo_watchers_repo_idx" ON "repo_watchers" USING btree ("repo");
