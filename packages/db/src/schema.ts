import { boolean, integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const organizations = pgTable("organizations", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  name: text("name"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});

export const workspaces = pgTable("workspaces", {
  id: text("id").primaryKey(),
  orgId: text("org_id").notNull(),
  projectId: text("project_id"),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  environment: text("environment"),
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

export const stateVersions = pgTable("state_versions", {
  id: text("id").primaryKey(),
  orgId: text("org_id").notNull(),
  workspaceId: text("workspace_id").notNull(),
  terraformVersion: text("terraform_version"),
  serial: integer("serial").notNull(),
  lineage: text("lineage").notNull(),
  source: text("source").notNull(),
  metadata: jsonb("metadata").notNull(),
  resourcesCount: integer("resources_count").notNull(),
  attributesCount: integer("attributes_count").notNull(),
  outputsCount: integer("outputs_count").notNull(),
  redactedAttributesCount: integer("redacted_attributes_count").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});

export const resources = pgTable("resources", {
  id: text("id").primaryKey(),
  orgId: text("org_id").notNull(),
  stateVersionId: text("state_version_id").notNull(),
  workspaceId: text("workspace_id").notNull(),
  moduleId: text("module_id"),
  providerId: text("provider_id"),
  mode: text("mode").notNull(),
  type: text("type").notNull(),
  name: text("name").notNull(),
  address: text("address").notNull(),
  providerName: text("provider_name"),
  providerAddress: text("provider_address"),
  moduleAddress: text("module_address"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});

export const resourceAttributes = pgTable("resource_attributes", {
  id: text("id").primaryKey(),
  orgId: text("org_id").notNull(),
  stateVersionId: text("state_version_id").notNull(),
  workspaceId: text("workspace_id").notNull(),
  resourceId: text("resource_id").notNull(),
  resourceInstanceId: text("resource_instance_id").notNull(),
  resourceAddress: text("resource_address").notNull(),
  keyPath: text("key_path").notNull(),
  valueType: text("value_type").notNull(),
  valueJson: jsonb("value_json").notNull(),
  displayValue: text("display_value").notNull(),
  isSensitive: boolean("is_sensitive").notNull(),
  sensitiveReason: text("sensitive_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});
