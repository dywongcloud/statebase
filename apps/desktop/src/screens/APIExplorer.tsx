import { useState } from "react";
import type { StateBaseClient } from "@statebase/sdk";
import { Button } from "../components/ui/button";
import { Card, CardDescription, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";

const endpoints = [
  "GET /api/v1/orgs/:orgId/workspaces",
  "POST /api/v1/orgs/:orgId/workspaces",
  "POST /api/v1/orgs/:orgId/workspaces/:workspaceId/ingest/tfstate",
  "GET /api/v1/orgs/:orgId/resources",
  "POST /api/v1/orgs/:orgId/query/sql",
  "GET /api/v1/orgs/:orgId/change-events",
  "GET /api/v1/orgs/:orgId/drift-events",
  "POST /api/v1/orgs/:orgId/workspaces/:workspaceId/drift/check",
  "GET /openapi.json",
  "GET /docs"
];

export function APIExplorer({ client, orgId }: { mode: "connected" | "local"; client?: StateBaseClient; orgId?: string }) {
  const [method, setMethod] = useState("GET");
  const [path, setPath] = useState(`/api/v1/orgs/${orgId ?? "org_demo"}/resources`);
  const [body, setBody] = useState("{}");
  const [response, setResponse] = useState("");

  async function send() {
    try {
      if (!client) throw new Error("API explorer is available in connected mode.");
      const base = (client as any).baseUrl ?? "";
      const token = (client as any).token;
      const res = await fetch(`${base}${path}`, {
        method,
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(method !== "GET" ? { "Content-Type": "application/json" } : {}) },
        body: method === "GET" ? undefined : body
      });
      const contentType = res.headers.get("content-type") ?? "";
      setResponse(contentType.includes("json") ? JSON.stringify(await res.json(), null, 2) : await res.text());
    } catch (error) {
      setResponse(error instanceof Error ? error.message : String(error));
    }
  }

  function selectEndpoint(endpoint: string) {
    const [nextMethod, rawPath] = endpoint.split(" ");
    setMethod(nextMethod);
    setPath(rawPath.replace(":orgId", orgId ?? "org_demo").replace(":workspaceId", "ws_demo"));
    if (endpoint.includes("query/sql")) setBody(JSON.stringify({ sql: "SELECT type, COUNT(*) AS count FROM resources GROUP BY type", limit: 100 }, null, 2));
    else if (endpoint.includes("workspaces") && nextMethod === "POST" && !endpoint.includes("ingest") && !endpoint.includes("drift")) setBody(JSON.stringify({ name: "Sandbox", environment: "dev" }, null, 2));
    else setBody("{}");
  }

  return (
    <div className="space-y-6">
      <div><h1 className="text-3xl font-bold text-white">API Explorer</h1><p className="mt-2 text-slate-400">Inspect generated endpoints and test API requests from the desktop UI.</p></div>
      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <Card><CardTitle>OpenAPI endpoints</CardTitle><CardDescription>Full documentation is served at /docs.</CardDescription><div className="mt-4 space-y-2">{endpoints.map((endpoint) => <button key={endpoint} onClick={() => selectEndpoint(endpoint)} className="w-full rounded-xl border border-borderSoft bg-panelSoft p-3 text-left font-mono text-xs text-slate-300 hover:border-accent">{endpoint}</button>)}</div></Card>
        <Card><CardTitle>Request</CardTitle><div className="mt-4 flex gap-3"><Input className="w-24" value={method} onChange={(event) => setMethod(event.target.value.toUpperCase())} /><Input value={path} onChange={(event) => setPath(event.target.value)} /><Button onClick={send}>Send</Button></div>{method !== "GET" && <textarea className="mt-3 h-32 w-full rounded-xl border border-borderSoft bg-panelSoft p-3 font-mono text-xs text-slate-100 outline-none focus:border-accent" value={body} onChange={(event) => setBody(event.target.value)} />}<pre className="mt-4 max-h-[420px] overflow-auto rounded-xl border border-borderSoft bg-black/30 p-4 text-xs text-slate-300">{response || "Response will appear here."}</pre></Card>
      </div>
    </div>
  );
}
