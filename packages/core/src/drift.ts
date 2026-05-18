import type { JsonValue } from "./types.js";

export interface CloudInventoryResource {
  provider: "aws" | "azure" | "gcp" | "kubernetes" | string;
  type: string;
  externalId: string;
  name?: string;
  region?: string;
  attributes: Record<string, JsonValue>;
}

export interface CloudInventoryProvider {
  readonly name: string;
  isConfigured(): boolean;
  listResources(): Promise<CloudInventoryResource[]>;
}

export class AwsInventoryProvider implements CloudInventoryProvider {
  readonly name = "aws";
  isConfigured(): boolean {
    return Boolean(process.env.AWS_ACCESS_KEY_ID || process.env.AWS_PROFILE || process.env.AWS_WEB_IDENTITY_TOKEN_FILE);
  }
  async listResources(): Promise<CloudInventoryResource[]> {
    if (!this.isConfigured()) return [];
    throw new Error("AWS inventory collection is not implemented yet. Wire the AWS SDK here when credentials are configured.");
  }
}

export class AzureInventoryProvider implements CloudInventoryProvider {
  readonly name = "azure";
  isConfigured(): boolean {
    return Boolean(process.env.AZURE_CLIENT_ID || process.env.AZURE_TENANT_ID);
  }
  async listResources(): Promise<CloudInventoryResource[]> {
    if (!this.isConfigured()) return [];
    throw new Error("Azure inventory collection is not implemented yet. Wire Azure SDK clients here when credentials are configured.");
  }
}

export class GcpInventoryProvider implements CloudInventoryProvider {
  readonly name = "gcp";
  isConfigured(): boolean {
    return Boolean(process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.GOOGLE_CLOUD_PROJECT);
  }
  async listResources(): Promise<CloudInventoryResource[]> {
    if (!this.isConfigured()) return [];
    throw new Error("GCP inventory collection is not implemented yet. Wire Google Cloud clients here when credentials are configured.");
  }
}

export class KubernetesInventoryProvider implements CloudInventoryProvider {
  readonly name = "kubernetes";
  isConfigured(): boolean {
    return Boolean(process.env.KUBECONFIG || process.env.KUBERNETES_SERVICE_HOST);
  }
  async listResources(): Promise<CloudInventoryResource[]> {
    if (!this.isConfigured()) return [];
    throw new Error("Kubernetes inventory collection is not implemented yet. Wire Kubernetes client-go or JS clients here when credentials are configured.");
  }
}
