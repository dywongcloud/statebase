import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { StateBaseClient } from "@statebase/sdk";
import { diffSnapshots, snapshotFromParsedState, type ChangeEventDraft } from "@statebase/core/browser";
import { parseTerraformState } from "@statebase/parser";
import type { LocalDataset } from "../lib/localNormalize";
import { Badge } from "../components/ui/badge";
import { Card, CardDescription, CardTitle } from "../components/ui/card";
import { Table, Td, Th } from "../components/ui/table";

export function DiffViewer({ mode, client, orgId, local }: { mode: "connected" | "local"; client?: StateBaseClient; orgId?: string; local?: LocalDataset }) {
  const [localEvents, setLocalEvents] = useState<ChangeEventDraft[]>([]);
  const [localError, setLocalError] = useState("");
  const query = useQuery({
    queryKey: ["change-events", orgId],
    enabled: mode === "connected" && Boolean(client && orgId),
    queryFn: () => client!.changeEvents.list({ orgId: orgId!, pageSize: 100, sortBy: "created_at" }) as Promise<any>
  });
  const events = useMemo(() => mode === "local" ? localEvents : ((query.data as any)?.items ?? []), [mode, localEvents, query.data]);

  async function loadComparison(file: File | undefined) {
    if (!file || !local) return;
    try {
      setLocalError("");
      const next = parseTerraformState(JSON.parse(await file.text()));
      setLocalEvents(diffSnapshots(snapshotFromParsedState(local.parsed), snapshotFromParsedState(next)));
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : String(error));
    }
  }

  return (
    <div className="space-y-6">
      <div><h1 className="text-3xl font-bold text-white">State Diff Viewer</h1><p className="mt-2 text-slate-400">Review resource and attribute-level changes generated from state-version comparisons.</p></div>
      {mode === "local" && <Card><CardTitle>Local comparison</CardTitle><CardDescription>Load a second tfstate file to compare it against the currently opened file. The comparison runs locally.</CardDescription><input id="compare-state" type="file" accept=".json,.tfstate" className="hidden" onChange={(event) => loadComparison(event.target.files?.[0])} /><label htmlFor="compare-state" className="mt-4 inline-flex cursor-pointer items-center justify-center rounded-xl border border-borderSoft bg-panelSoft px-4 py-2 text-sm font-medium text-slate-100 transition hover:bg-slate-800">Load comparison tfstate</label>{localError && <p className="mt-3 text-sm text-rose-300">{localError}</p>}</Card>}
      <Card>
        <CardTitle>Change timeline</CardTitle>
        <CardDescription>{mode === "local" ? "Local file-to-file diff results." : "Latest generated change events"}</CardDescription>
        <div className="mt-4 overflow-auto rounded-xl border border-borderSoft">
          <Table>
            <thead><tr><Th>Severity</Th><Th>Type</Th><Th>Address</Th><Th>Key</Th><Th>Old</Th><Th>New</Th><Th>Summary</Th></tr></thead>
            <tbody>
              {events.length === 0 && <tr><Td colSpan={7} className="py-8 text-center text-slate-500">No change events yet.</Td></tr>}
              {events.map((event: any, index: number) => (
                <tr key={event.id ?? index}>
                  <Td><SeverityBadge severity={event.severity} /></Td><Td>{event.type}</Td><Td className="font-mono text-xs">{event.address ?? "—"}</Td><Td className="font-mono text-xs">{event.key_path ?? event.keyPath ?? "—"}</Td><Td>{event.old_display_value ?? event.oldDisplayValue ?? "—"}</Td><Td>{event.new_display_value ?? event.newDisplayValue ?? "—"}</Td><Td>{event.summary}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      </Card>
    </div>
  );
}

function SeverityBadge({ severity }: { severity?: string }) {
  const cls = severity === "high" || severity === "critical" ? "border-rose-700 text-rose-200" : severity === "medium" ? "border-amber-700 text-amber-200" : "text-slate-300";
  return <Badge className={cls}>{severity ?? "info"}</Badge>;
}
