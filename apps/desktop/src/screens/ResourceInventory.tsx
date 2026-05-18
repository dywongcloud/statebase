import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { StateBaseClient } from "@statebase/sdk";
import type { LocalDataset } from "../lib/localNormalize";
import { Badge } from "../components/ui/badge";
import { Card, CardDescription, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Table, Td, Th } from "../components/ui/table";

export function ResourceInventory({ mode, client, orgId, local }: { mode: "connected" | "local"; client?: StateBaseClient; orgId?: string; local?: LocalDataset }) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<any | null>(null);
  const resourcesQuery = useQuery({
    queryKey: ["resources", orgId, search],
    enabled: mode === "connected" && Boolean(client && orgId),
    queryFn: () => client!.resources.list({ orgId: orgId!, search, pageSize: 100 }) as Promise<any>
  });
  const rows = useMemo(() => {
    if (mode === "local") return (local?.resources ?? []).filter((row) => JSON.stringify(row).toLowerCase().includes(search.toLowerCase()));
    return ((resourcesQuery.data as any)?.items ?? []);
  }, [mode, local, resourcesQuery.data, search]);

  return (
    <div className="space-y-6">
      <div><h1 className="text-3xl font-bold text-white">Resource Inventory</h1><p className="mt-2 text-slate-400">Search resources, filter by provider/module/type, and inspect redacted attributes.</p></div>
      <Card>
        <div className="mb-4 flex gap-3">
          <Input placeholder="Search address, type, provider, module…" value={search} onChange={(event) => setSearch(event.target.value)} />
          <Badge>{rows.length} resources</Badge>
        </div>
        {resourcesQuery.error && <p className="mb-4 text-rose-300">{String((resourcesQuery.error as Error).message)}</p>}
        <div className="overflow-auto rounded-xl border border-borderSoft">
          <Table>
            <thead><tr><Th>Address</Th><Th>Type</Th><Th>Provider</Th><Th>Module</Th><Th>Mode</Th></tr></thead>
            <tbody>
              {rows.map((resource: any, index: number) => (
                <tr key={resource.id ?? resource.address ?? index} onClick={() => setSelected(resource)} className="cursor-pointer hover:bg-panelSoft">
                  <Td className="font-mono text-xs">{resource.address}</Td>
                  <Td>{resource.type}</Td>
                  <Td>{resource.provider_name ?? resource.providerName ?? "—"}</Td>
                  <Td>{resource.module_address ?? resource.moduleAddress ?? "root"}</Td>
                  <Td><Badge>{resource.mode}</Badge></Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      </Card>
      {selected && <ResourceDetail mode={mode} client={client} orgId={orgId} resource={selected} local={local} />}
    </div>
  );
}

function ResourceDetail({ mode, client, orgId, resource, local }: { mode: "connected" | "local"; client?: StateBaseClient; orgId?: string; resource: any; local?: LocalDataset }) {
  const detail = useQuery({
    queryKey: ["resource-detail", resource.id],
    enabled: mode === "connected" && Boolean(client && orgId && resource.id),
    queryFn: () => client!.resources.get({ orgId: orgId!, resourceId: resource.id }) as Promise<any>
  });
  const attrs = mode === "local"
    ? (local?.resource_attributes ?? []).filter((attr) => String(attr.resource_address).replace(/\[[^\]]+\]$/, "") === resource.address || String(attr.resource_address) === resource.address)
    : ((detail.data as any)?.attributes ?? []);
  return (
    <Card>
      <CardTitle>Resource detail</CardTitle>
      <CardDescription>{resource.address}</CardDescription>
      <div className="mt-4 max-h-96 overflow-auto rounded-xl border border-borderSoft">
        <Table>
          <thead><tr><Th>Key path</Th><Th>Value</Th><Th>Type</Th><Th>Sensitive</Th></tr></thead>
          <tbody>{attrs.map((attr: any, index: number) => <tr key={index}><Td className="font-mono text-xs">{attr.key_path ?? attr.keyPath}</Td><Td>{attr.display_value ?? attr.displayValue}</Td><Td>{attr.value_type ?? attr.valueType}</Td><Td>{attr.is_sensitive || attr.isSensitive ? <Badge className="border-rose-700 text-rose-200">redacted</Badge> : "—"}</Td></tr>)}</tbody>
        </Table>
      </div>
    </Card>
  );
}
