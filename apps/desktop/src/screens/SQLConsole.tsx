import { useState } from "react";
import Editor from "@monaco-editor/react";
import type { StateBaseClient } from "@statebase/sdk";
import type { LocalDataset } from "../lib/localNormalize";
import { runLocalSql } from "../lib/localSql";
import { Button } from "../components/ui/button";
import { Card, CardDescription, CardTitle } from "../components/ui/card";
import { Table, Td, Th } from "../components/ui/table";

const starterSql = "SELECT type, COUNT(*) AS count FROM resources GROUP BY type ORDER BY count DESC";

export function SQLConsole({ mode, client, orgId, local }: { mode: "connected" | "local"; client?: StateBaseClient; orgId?: string; local?: LocalDataset }) {
  const [sql, setSql] = useState(starterSql);
  const [result, setResult] = useState<{ columns: string[]; rows: Record<string, unknown>[]; elapsedMs: number } | null>(null);
  const [error, setError] = useState("");
  const [history, setHistory] = useState<string[]>([]);

  async function run() {
    try {
      setError("");
      const next = mode === "local" ? runLocalSql(local!, sql) : await client!.query.sql({ orgId: orgId!, sql, limit: 1000 });
      setResult(next);
      setHistory((items) => [sql, ...items.filter((item) => item !== sql)].slice(0, 8));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  function exportJson() {
    if (!result) return;
    const blob = new Blob([JSON.stringify(result.rows, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "statebase-query.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div><h1 className="text-3xl font-bold text-white">SQL Console</h1><p className="mt-2 text-slate-400">Read-only SELECT queries over normalized Terraform state tables. Sensitive values are redacted.</p></div>
      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <Card className="p-0">
          <div className="border-b border-borderSoft p-4"><CardTitle>Query editor</CardTitle><CardDescription>{mode === "local" ? "Local in-memory SQL" : "Governed backend SQL"}</CardDescription></div>
          <div className="h-72 overflow-hidden rounded-b-2xl">
            <Editor height="100%" language="sql" theme="vs-dark" value={sql} onChange={(value) => setSql(value ?? "")} options={{ minimap: { enabled: false }, fontSize: 14 }} />
          </div>
          <div className="flex gap-3 border-t border-borderSoft p-4"><Button onClick={run}>Run query</Button><Button variant="secondary" onClick={exportJson}>Export JSON</Button></div>
        </Card>
        <Card>
          <CardTitle>Saved queries</CardTitle>
          <div className="mt-4 space-y-2">
            {[starterSql, "SELECT address, type, provider_name FROM resources ORDER BY address", "SELECT resource_address, key_path FROM resource_attributes WHERE is_sensitive = true"].map((query) => <button key={query} onClick={() => setSql(query)} className="w-full rounded-xl border border-borderSoft bg-panelSoft p-3 text-left font-mono text-xs text-slate-300 hover:border-accent">{query}</button>)}
          </div>
          {history.length > 0 && <><CardTitle className="mt-6 text-base">History</CardTitle><div className="mt-3 space-y-2">{history.map((query) => <button key={query} onClick={() => setSql(query)} className="w-full truncate rounded-lg text-left text-xs text-slate-500 hover:text-slate-200">{query}</button>)}</div></>}
        </Card>
      </div>
      {error && <p className="rounded-xl border border-rose-900 bg-rose-950/40 p-3 text-sm text-rose-200">{error}</p>}
      {result && <Card><div className="mb-3 text-sm text-slate-400">{result.rows.length} rows · {result.elapsedMs}ms</div><div className="max-h-[420px] overflow-auto rounded-xl border border-borderSoft"><Table><thead><tr>{result.columns.map((column) => <Th key={column}>{column}</Th>)}</tr></thead><tbody>{result.rows.map((row, index) => <tr key={index}>{result.columns.map((column) => <Td key={column}>{formatCell(row[column])}</Td>)}</tr>)}</tbody></Table></div></Card>}
    </div>
  );
}

function formatCell(value: unknown) {
  if (value === null || value === undefined) return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
