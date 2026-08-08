CREATE TABLE "mcp_service_account" (
  "id" uuid PRIMARY KEY NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "organization_id" text NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "oauth_client_id" text,
  "disabled" boolean DEFAULT false NOT NULL,
  CONSTRAINT "mcp_service_account_organization_id_organization_id_fk"
    FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE cascade,
  CONSTRAINT "mcp_service_account_oauth_client_id_oauth_application_client_id_fk"
    FOREIGN KEY ("oauth_client_id") REFERENCES "oauth_application"("client_id") ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX "mcp_service_account_org_idx" ON "mcp_service_account" ("organization_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "mcp_service_account_oauth_client_id_unique"
  ON "mcp_service_account" ("oauth_client_id");
--> statement-breakpoint
CREATE TABLE "mcp_service_account_secret" (
  "id" uuid PRIMARY KEY NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "service_account_id" uuid NOT NULL,
  "label" text DEFAULT 'primary' NOT NULL,
  "secret_hash" text NOT NULL,
  "secret_last_four" text NOT NULL,
  "created_by_user_id" text,
  "expires_at" timestamp with time zone,
  "revoked_at" timestamp with time zone,
  CONSTRAINT "mcp_service_account_secret_service_account_id_mcp_service_account_id_fk"
    FOREIGN KEY ("service_account_id") REFERENCES "mcp_service_account"("id") ON DELETE cascade,
  CONSTRAINT "mcp_service_account_secret_created_by_user_id_user_id_fk"
    FOREIGN KEY ("created_by_user_id") REFERENCES "user"("id") ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX "mcp_service_account_secret_account_idx"
  ON "mcp_service_account_secret" ("service_account_id");
--> statement-breakpoint
CREATE TABLE "mcp_policy_binding" (
  "id" uuid PRIMARY KEY NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "principal_type" text NOT NULL
    CONSTRAINT "mcp_policy_binding_principal_type_check"
    CHECK ("principal_type" IN ('delegated_user', 'service_account')),
  "principal_id" text NOT NULL,
  "organization_id" text,
  "tool_name" text,
  "scope" text NOT NULL,
  "disabled" boolean DEFAULT false NOT NULL,
  CONSTRAINT "mcp_policy_binding_organization_id_organization_id_fk"
    FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX "mcp_policy_binding_principal_idx"
  ON "mcp_policy_binding" ("principal_type", "principal_id");
--> statement-breakpoint
CREATE INDEX "mcp_policy_binding_org_idx" ON "mcp_policy_binding" ("organization_id");
--> statement-breakpoint
CREATE TABLE "mcp_audit_event" (
  "id" uuid PRIMARY KEY NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "correlation_id" text NOT NULL,
  "principal_type" text NOT NULL
    CONSTRAINT "mcp_audit_event_principal_type_check"
    CHECK ("principal_type" IN ('delegated_user', 'service_account')),
  "principal_id" text NOT NULL,
  "organization_id" text,
  "connection_id" text,
  "tool_name" text NOT NULL,
  "required_scopes" text NOT NULL,
  "granted" boolean NOT NULL,
  "denial_reason" text
);
--> statement-breakpoint
CREATE INDEX "mcp_audit_event_correlation_idx" ON "mcp_audit_event" ("correlation_id");
--> statement-breakpoint
CREATE INDEX "mcp_audit_event_principal_idx"
  ON "mcp_audit_event" ("principal_type", "principal_id");
--> statement-breakpoint
CREATE INDEX "mcp_audit_event_tool_idx" ON "mcp_audit_event" ("tool_name");
