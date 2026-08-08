ALTER TABLE "mcp_audit_event" ADD COLUMN IF NOT EXISTS "input_hash" text;
--> statement-breakpoint
ALTER TABLE "mcp_audit_event" ADD COLUMN IF NOT EXISTS "response_class" text;
