import { Cloud, FileJson } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card, CardDescription, CardTitle } from "../components/ui/card";

export function Welcome({ onConnected, onLocal }: { onConnected: () => void; onLocal: () => void }) {
  return (
    <div className="min-h-screen bg-background px-8 py-10 text-slate-100">
      <div className="mx-auto max-w-6xl">
        <div className="mb-12 flex items-center justify-between">
          <div>
            <div className="mb-3 inline-flex rounded-full border border-borderSoft bg-panelSoft px-3 py-1 text-xs uppercase tracking-widest text-violet-300">Terraform state intelligence</div>
            <h1 className="max-w-3xl text-5xl font-black tracking-tight text-white">Turn tfstate JSON blobs into a secure infrastructure database.</h1>
            <p className="mt-4 max-w-2xl text-lg text-slate-400">SQL queryability, version diffs, sensitive redaction, dependency graphs, and local-first inspection for platform teams.</p>
          </div>
          <div className="hidden rounded-full bg-accent/20 p-12 shadow-glow lg:block">
            <FileJson className="h-24 w-24 text-violet-200" />
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card className="p-8">
            <Cloud className="mb-5 h-10 w-10 text-violet-300" />
            <CardTitle>Connected Mode</CardTitle>
            <CardDescription>Connect to a StateBase API instance, browse organizations and workspaces, run governed SQL, and inspect historical state versions.</CardDescription>
            <Button className="mt-6" onClick={onConnected}>Connect to backend</Button>
          </Card>
          <Card className="p-8">
            <FileJson className="mb-5 h-10 w-10 text-emerald-300" />
            <CardTitle>Local File Mode</CardTitle>
            <CardDescription>Open a terraform.tfstate file, parse and query it locally, and keep every byte on this machine.</CardDescription>
            <Button className="mt-6" variant="secondary" onClick={onLocal}>Open local tfstate</Button>
          </Card>
        </div>
      </div>
    </div>
  );
}
