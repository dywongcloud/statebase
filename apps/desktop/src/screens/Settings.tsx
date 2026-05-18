import { Card, CardDescription, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";

export function Settings({ modeLabel }: { modeLabel: string }) {
  return (
    <div className="space-y-6">
      <div><h1 className="text-3xl font-bold text-white">Settings</h1><p className="mt-2 text-slate-400">Connection profiles, local cache controls, theme and telemetry posture.</p></div>
      <Card><CardTitle>Connection profile</CardTitle><CardDescription>Current mode: {modeLabel}</CardDescription><div className="mt-4 flex gap-2"><Badge>Telemetry disabled by default</Badge><Badge>Dark mode</Badge><Badge>Local cache ephemeral</Badge></div></Card>
      <Card><CardTitle>Security defaults</CardTitle><ul className="mt-4 list-disc space-y-2 pl-6 text-sm text-slate-400"><li>No raw secrets shown in resource panels or SQL results.</li><li>Connected SQL requests are audited by the backend.</li><li>Local mode avoids network calls unless you switch to Connected Mode.</li></ul></Card>
    </div>
  );
}
