import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { StateBaseClient } from "@statebase/sdk";
import type { LocalDataset } from "../lib/localNormalize";
import { Badge } from "../components/ui/badge";
import { Card, CardDescription, CardTitle } from "../components/ui/card";
import { Table, Td, Th } from "../components/ui/table";

export function SecurityFindings({ mode, client, orgId, local }: { mode: "connected" | "local"; client?: StateBaseClient; orgId?: string; local?: LocalDataset }) {
  const eventsQuery = useQuery({
    queryKey: ["security-events", orgId],
    enabled: mode === "connected" && Boolean(client && orgId),
    queryFn: () => client!.changeEvents.list({ orgId: orgId!, pageSize: 100, search: "" }) as Promise<any>
  });
  const sensitiveQuery = useQuery({
    queryKey: ["sensitive-count", orgId],
    enabled: mode === "connected" && Boolean(client && orgId),
    queryFn: () => client!.query.sql({ orgId: orgId!, sql: "SELECT COUNT(*)::int AS count FROM resource_attributes WHERE is_sensitive = true" })
  });

  const findings = useMemo(() => {
    if (mode === "local" && local) return findingsFromLocal(local);
    return (((eventsQuery.data as any)?.items ?? []) as any[])
      .filter((event) => ["high", "critical", "medium"].includes(String(event.severity)))
      .map((event) => ({ severity: String(event.severity) as "high" | "medium" | "critical", resource: String(event.address ?? "—"), summary: String(event.summary), evidence: String(event.key_path ?? event.type) }));
  }, [mode, local, eventsQuery.data]);

  const sensitiveCount = mode === "local" ? (local?.resource_attributes.filter((a) => a.is_sensitive).length ?? 0) : Number((sensitiveQuery.data?.rows?.[0] as any)?.count ?? 0);
  const highCount = findings.filter((f) => f.severity === "high" || f.severity === "critical").length;
  const mediumCount = findings.filter((f) => f.severity === "medium").length;

  return (
    <div className="space-y-6">
      <div><h1 className="text-3xl font-bold text-white">Security Findings</h1><p className="mt-2 text-slate-400">Risky changes, public ingress, public databases, unencrypted storage and sensitive outputs.</p></div>
      <div className="grid gap-4 md:grid-cols-4">
        <Metric label="High" value={highCount} tone="rose" />
        <Metric label="Medium" value={mediumCount} tone="amber" />
        <Metric label="Sensitive attrs" value={sensitiveCount} tone="violet" />
        <Metric label="Sensitive outputs" value={local?.outputs.filter((o) => o.isSensitive || o.is_sensitive).length ?? 0} tone="violet" />
      </div>
      <Card>
        <CardTitle>Findings</CardTitle>
        <CardDescription>{mode === "connected" ? "Connected mode reads risky change_events and sensitive attribute counts from the API." : "Static local checks from parsed attributes."}</CardDescription>
        <div className="mt-4 overflow-auto rounded-xl border border-borderSoft">
          <Table><thead><tr><Th>Severity</Th><Th>Resource</Th><Th>Finding</Th><Th>Evidence</Th></tr></thead><tbody>
            {findings.length === 0 && <tr><Td colSpan={4} className="py-8 text-center text-slate-500">No findings detected.</Td></tr>}
            {findings.map((finding, index) => <tr key={index}><Td><Badge className={finding.severity === "high" || finding.severity === "critical" ? "border-rose-700 text-rose-200" : "border-amber-700 text-amber-200"}>{finding.severity}</Badge></Td><Td className="font-mono text-xs">{finding.resource}</Td><Td>{finding.summary}</Td><Td className="font-mono text-xs">{finding.evidence}</Td></tr>)}
          </tbody></Table>
        </div>
      </Card>
    </div>
  );
}

function findingsFromLocal(local: LocalDataset) {
  const findings: Array<{ severity: "high" | "medium" | "critical"; resource: string; summary: string; evidence: string }> = [];
  for (const attr of local.resource_attributes) {
    const key = String(attr.key_path).toLowerCase();
    const display = String(attr.display_value ?? attr.value_json);
    const resource = String(attr.resource_address);
    if ((key.includes("cidr") || key.includes("ingress")) && (display.includes("0.0.0.0/0") || display.includes("::/0"))) findings.push({ severity: "high", resource, summary: "Public ingress detected", evidence: `${attr.key_path}=${display}` });
    if (key.includes("publicly_accessible") && display === "true") findings.push({ severity: "high", resource, summary: "Public database or managed service", evidence: `${attr.key_path}=true` });
    if ((key.includes("encrypted") || key.includes("encryption")) && display === "false") findings.push({ severity: "high", resource, summary: "Encryption disabled", evidence: `${attr.key_path}=false` });
    if (attr.is_sensitive) findings.push({ severity: "medium", resource, summary: "Sensitive value redacted", evidence: String(attr.key_path) });
  }
  return findings;
}

function Metric({ label, value, tone }: { label: string; value: number; tone: "rose" | "amber" | "violet" }) {
  const color = tone === "rose" ? "text-rose-300" : tone === "amber" ? "text-amber-300" : "text-violet-300";
  return <Card><div className={`text-3xl font-bold ${color}`}>{value}</div><div className="text-sm text-slate-500">{label}</div></Card>;
}
