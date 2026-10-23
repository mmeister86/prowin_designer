DROP TABLE "github_connections" CASCADE;--> statement-breakpoint
UPDATE "tasks"
SET "ended_at" = COALESCE("ended_at", (extract(epoch FROM now()) * 1000)::bigint),
    "queued_by" = NULL,
    "queued_by_user_id" = NULL
WHERE "kind" IN ('sketch', 'design-system');
