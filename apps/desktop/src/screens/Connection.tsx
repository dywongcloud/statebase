import { useState } from "react";
import { StateBaseClient } from "@statebase/sdk";
import { Button } from "../components/ui/button";
import { Card, CardDescription, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";

export interface ConnectionProfile {
  baseUrl: string;
  token: string;
  orgId: string;
}

export function Connection({ onConnected }: { onConnected: (profile: ConnectionProfile) => void }) {
  const [baseUrl, setBaseUrl] = useState("http://localhost:4000");
  const [token, setToken] = useState("sb_demo_local_dev_token_change_me");
  const [orgId, setOrgId] = useState("org_demo");
  const [status, setStatus] = useState<string>("");

  async function test() {
    try {
      const client = new StateBaseClient({ baseUrl, token });
      await client.health();
      setStatus("Backend is reachable. Token will be validated on the next authenticated request.");
      onConnected({ baseUrl, token, orgId });
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6 text-slate-100">
      <Card className="w-full max-w-xl p-8">
        <CardTitle>Connect to StateBase API</CardTitle>
        <CardDescription>Use a scoped API token. Tokens are never persisted unless you save a profile in Settings.</CardDescription>
        <div className="mt-6 space-y-4">
          <label className="block text-sm text-slate-400">API base URL<Input className="mt-1" value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} /></label>
          <label className="block text-sm text-slate-400">API token<Input className="mt-1" type="password" value={token} onChange={(event) => setToken(event.target.value)} /></label>
          <label className="block text-sm text-slate-400">Organization ID<Input className="mt-1" value={orgId} onChange={(event) => setOrgId(event.target.value)} /></label>
          <Button onClick={test}>Test connection</Button>
          {status && <p className="rounded-xl border border-borderSoft bg-panelSoft p-3 text-sm text-slate-300">{status}</p>}
        </div>
      </Card>
    </div>
  );
}
