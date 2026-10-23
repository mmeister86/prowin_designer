DROP TABLE "linear_installations" CASCADE;--> statement-breakpoint
DROP TABLE "linear_oauth_states" CASCADE;--> statement-breakpoint
DROP TABLE "linear_sessions" CASCADE;--> statement-breakpoint
DELETE FROM "integrations" WHERE "provider" = 'linear';
