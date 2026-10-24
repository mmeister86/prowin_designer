CREATE TABLE "prowin_creators" (
	"user_id" text PRIMARY KEY NOT NULL,
	"registered_at" bigint NOT NULL
);
--> statement-breakpoint
-- Preserve existing authors' capabilities, never their instance role.
INSERT INTO "prowin_creators" ("user_id", "registered_at")
SELECT DISTINCT "user_id", floor(extract(epoch FROM now()) * 1000)::bigint
FROM "workspace_members"
WHERE "role" IN ('owner', 'admin') AND "user_id" IN (SELECT "id" FROM "user")
ON CONFLICT DO NOTHING;
--> statement-breakpoint
UPDATE "workspace_members" SET "role" = 'creator' WHERE "role" = 'admin';
--> statement-breakpoint
-- Unknown invitees have not opted into Creator registration.
UPDATE "workspace_invites" SET "role" = 'member' WHERE "role" = 'admin';
