CREATE TABLE IF NOT EXISTS schema_migrations (
  version text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS organizations (
  id text PRIMARY KEY,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id text PRIMARY KEY,
  email text NOT NULL UNIQUE,
  name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS memberships (
  id text PRIMARY KEY,
  org_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(org_id, user_id)
);

CREATE TABLE IF NOT EXISTS projects (
  id text PRIMARY KEY,
  org_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(org_id, slug)
);

CREATE TABLE IF NOT EXISTS workspaces (
  id text PRIMARY KEY,
  org_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id text REFERENCES projects(id) ON DELETE SET NULL,
  name text NOT NULL,
  slug text NOT NULL,
  environment text,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(org_id, slug)
);

CREATE TABLE IF NOT EXISTS state_versions (
  id text PRIMARY KEY,
  org_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  terraform_version text,
  serial integer NOT NULL,
  lineage text NOT NULL,
  source text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  resources_count integer NOT NULL DEFAULT 0,
  attributes_count integer NOT NULL DEFAULT 0,
  outputs_count integer NOT NULL DEFAULT 0,
  redacted_attributes_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS providers (
  id text PRIMARY KEY,
  org_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  state_version_id text NOT NULL REFERENCES state_versions(id) ON DELETE CASCADE,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  alias text,
  version text,
  source text,
  address text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS modules (
  id text PRIMARY KEY,
  org_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  state_version_id text NOT NULL REFERENCES state_versions(id) ON DELETE CASCADE,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  address text NOT NULL,
  path jsonb NOT NULL DEFAULT '[]'::jsonb,
  parent_address text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS resources (
  id text PRIMARY KEY,
  org_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  state_version_id text NOT NULL REFERENCES state_versions(id) ON DELETE CASCADE,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  module_id text REFERENCES modules(id) ON DELETE SET NULL,
  provider_id text REFERENCES providers(id) ON DELETE SET NULL,
  mode text NOT NULL,
  type text NOT NULL,
  name text NOT NULL,
  address text NOT NULL,
  provider_name text,
  provider_address text,
  module_address text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS resource_instances (
  id text PRIMARY KEY,
  org_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  state_version_id text NOT NULL REFERENCES state_versions(id) ON DELETE CASCADE,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  resource_id text NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  address text NOT NULL,
  index_key text,
  schema_version integer,
  attributes_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  sensitive_paths_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS resource_attributes (
  id text PRIMARY KEY,
  org_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  state_version_id text NOT NULL REFERENCES state_versions(id) ON DELETE CASCADE,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  resource_id text NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  resource_instance_id text NOT NULL REFERENCES resource_instances(id) ON DELETE CASCADE,
  resource_address text NOT NULL,
  key_path text NOT NULL,
  value_type text NOT NULL,
  value_json jsonb NOT NULL,
  display_value text NOT NULL,
  is_sensitive boolean NOT NULL DEFAULT false,
  sensitive_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS outputs (
  id text PRIMARY KEY,
  org_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  state_version_id text NOT NULL REFERENCES state_versions(id) ON DELETE CASCADE,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  value_json jsonb NOT NULL,
  display_value text NOT NULL,
  type_json jsonb,
  is_sensitive boolean NOT NULL DEFAULT false,
  sensitive_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS dependencies (
  id text PRIMARY KEY,
  org_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  state_version_id text NOT NULL REFERENCES state_versions(id) ON DELETE CASCADE,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  resource_id text REFERENCES resources(id) ON DELETE CASCADE,
  source_address text NOT NULL,
  target_address text NOT NULL,
  dependency_type text NOT NULL DEFAULT 'explicit',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS change_events (
  id text PRIMARY KEY,
  org_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  state_version_id text NOT NULL REFERENCES state_versions(id) ON DELETE CASCADE,
  previous_state_version_id text REFERENCES state_versions(id) ON DELETE SET NULL,
  type text NOT NULL,
  address text,
  key_path text,
  old_value_json jsonb,
  new_value_json jsonb,
  old_display_value text,
  new_display_value text,
  severity text NOT NULL DEFAULT 'info',
  summary text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS drift_events (
  id text PRIMARY KEY,
  org_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  state_version_id text REFERENCES state_versions(id) ON DELETE SET NULL,
  resource_address text,
  provider text,
  status text NOT NULL,
  expected_json jsonb,
  actual_json jsonb,
  severity text NOT NULL DEFAULT 'info',
  summary text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

CREATE TABLE IF NOT EXISTS api_tokens (
  id text PRIMARY KEY,
  org_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id text REFERENCES users(id) ON DELETE SET NULL,
  name text NOT NULL,
  token_prefix text NOT NULL,
  token_hash text NOT NULL UNIQUE,
  scopes text[] NOT NULL DEFAULT ARRAY[]::text[],
  expires_at timestamptz,
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);

CREATE TABLE IF NOT EXISTS query_audit_logs (
  id text PRIMARY KEY,
  org_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id text REFERENCES users(id) ON DELETE SET NULL,
  api_token_id text REFERENCES api_tokens(id) ON DELETE SET NULL,
  sql text NOT NULL,
  workspace_ids text[] NOT NULL DEFAULT ARRAY[]::text[],
  row_count integer NOT NULL DEFAULT 0,
  elapsed_ms integer NOT NULL DEFAULT 0,
  status text NOT NULL,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS connectors (
  id text PRIMARY KEY,
  org_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id text REFERENCES projects(id) ON DELETE SET NULL,
  workspace_id text REFERENCES workspaces(id) ON DELETE SET NULL,
  type text NOT NULL,
  name text NOT NULL,
  config_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'disabled',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workspaces_org ON workspaces(org_id);
CREATE INDEX IF NOT EXISTS idx_state_versions_workspace_created ON state_versions(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_resources_org_workspace_state ON resources(org_id, workspace_id, state_version_id);
CREATE INDEX IF NOT EXISTS idx_resources_address ON resources(org_id, address);
CREATE INDEX IF NOT EXISTS idx_resource_instances_resource ON resource_instances(resource_id);
CREATE INDEX IF NOT EXISTS idx_resource_attributes_lookup ON resource_attributes(org_id, workspace_id, state_version_id, key_path);
CREATE INDEX IF NOT EXISTS idx_resource_attributes_sensitive ON resource_attributes(org_id, is_sensitive) WHERE is_sensitive = true;
CREATE INDEX IF NOT EXISTS idx_outputs_org_workspace_state ON outputs(org_id, workspace_id, state_version_id);
CREATE INDEX IF NOT EXISTS idx_dependencies_org_workspace_state ON dependencies(org_id, workspace_id, state_version_id);
CREATE INDEX IF NOT EXISTS idx_change_events_workspace_created ON change_events(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_tokens_hash ON api_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_query_audit_logs_org_created ON query_audit_logs(org_id, created_at DESC);
