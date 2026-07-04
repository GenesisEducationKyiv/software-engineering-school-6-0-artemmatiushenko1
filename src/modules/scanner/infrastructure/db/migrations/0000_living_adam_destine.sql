CREATE SCHEMA "scanner";
--> statement-breakpoint
CREATE TABLE "scanner"."monitored_repos" (
	"repo" text PRIMARY KEY NOT NULL,
	"last_seen_tag" text
);
--> statement-breakpoint
CREATE TABLE "scanner"."repo_watchers" (
	"subscription_id" text PRIMARY KEY NOT NULL,
	"repo" text NOT NULL,
	"last_notified_tag" text
);
--> statement-breakpoint
ALTER TABLE "scanner"."repo_watchers" ADD CONSTRAINT "repo_watchers_repo_monitored_repos_repo_fk" FOREIGN KEY ("repo") REFERENCES "scanner"."monitored_repos"("repo") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "repo_watchers_repo_idx" ON "scanner"."repo_watchers" USING btree ("repo");