import { useQuery } from "@tanstack/react-query";
import { Boxes, Cloud, FileJson, GitBranch } from "lucide-react";
import type { StateBaseClient } from "@statebase/sdk";
import type { LocalDataset } from "../lib/localNormalize";
import { Badge } from "../components/ui/badge";
import { Card, CardDescription, CardTitle } from "../components/ui/card";

export function WorkspaceExplorer({ mode, client, orgId, local }: { mode: "connected" | "local"; client?: StateBaseClient; orgId?: string; local?: LocalDataset }) {
  const workspaces = useQuery({
    queryKey: ["workspaces", orgId],
    enabled: mode === "connected" && Boolean(client && orgId),
    queryFn: () => client!.workspaces.list({ orgId: orgId! }) as Promise<any>
  });

  if (mode === "local" && local) {
    const providerCounts = new Map<string, number>();
    for (const resource of local.resources) providerCounts.set(String(resource.provider_name ?? "unknown"), (providerCounts.get(String(resource.provider_name ?? "unknown")) ?? 0) + 1);
    return (
      <div className="space-y-6">
        <Header title="Local State Overview" subtitle="Parsed and normalized in-memory. No server connection is active." />
        <div className="grid gap-4 md:grid-cols-4">
          <Metric icon={FileJson} label="Serial" value={local.parsed.metadata.serial} />
          <Metric icon={Boxes} label="Resources" value={local.resources.length} />
          <Metric icon={Cloud} label="Providers" value={local.providers.length} />
          <Metric icon={GitBranch} label="Dependencies" value={local.dependencies.length} />
        </div>
        <Card>
          <CardTitle>Provider summary</CardTitle>
          <div className="mt-4 flex flex-wrap gap-2">
            {[...providerCounts.entries()].map(([provider, count]) => <Badge key={provider}>{provider}: {count}</Badge>)}
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Header title="Workspace Explorer" subtitle="Browse org, project and workspace scope with state-version timelines." />
      <Card>
        <CardTitle>Workspaces</CardTitle>
        <CardDescription>Connected to organization {orgId}</CardDescription>
        {workspaces.isLoading && <p className="mt-4 text-slate-400">Loading workspaces…</p>}
        {workspaces.error && <p className="mt-4 text-rose-300">{String((workspaces.error as Error).message)}</p>}
        <div className="mt-4 grid gap-3">
          {((workspaces.data as any)?.items ?? []).map((workspace: any) => (
            <div key={workspace.id} className="rounded-xl border border-borderSoft bg-panelSoft p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold text-white">{workspace.name}</div>
                  <div className="text-sm text-slate-500">{workspace.id} · {workspace.environment ?? "unknown environment"}</div>
                </div>
                <Badge>{workspace.slug}</Badge>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function Header({ title, subtitle }: { title: string; subtitle: string }) {
  return <div><h1 className="text-3xl font-bold text-white">{title}</h1><p className="mt-2 text-slate-400">{subtitle}</p></div>;
}
function Metric({ icon: Icon, label, value }: { icon: any; label: string; value: string | number }) {
  return <Card><Icon className="mb-3 h-5 w-5 text-violet-300" /><div className="text-3xl font-bold text-white">{value}</div><div className="text-sm text-slate-500">{label}</div></Card>;
}
