import { useState } from "react";
import { datasetFromState, type LocalDataset } from "../lib/localNormalize";
import { Button } from "../components/ui/button";
import { Card, CardDescription, CardTitle } from "../components/ui/card";

export function LocalOpen({ onLoaded }: { onLoaded: (dataset: LocalDataset) => void }) {
  const [error, setError] = useState("");

  async function load(file: File | undefined) {
    if (!file) return;
    try {
      setError("");
      const raw = await file.text();
      onLoaded(datasetFromState(JSON.parse(raw)));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6 text-slate-100">
      <Card className="w-full max-w-xl p-8">
        <CardTitle>Open local Terraform state</CardTitle>
        <CardDescription>The parser runs entirely in this renderer process. No network calls are made in local mode.</CardDescription>
        <div className="mt-6 rounded-2xl border border-dashed border-borderSoft bg-panelSoft p-8 text-center">
          <input id="tfstate" type="file" accept=".json,.tfstate" className="hidden" onChange={(event) => load(event.target.files?.[0])} />
          <label htmlFor="tfstate" className="inline-flex cursor-pointer items-center justify-center rounded-xl border border-borderSoft bg-panelSoft px-4 py-2 text-sm font-medium text-slate-100 transition hover:bg-slate-800">Choose terraform.tfstate</label>
          <p className="mt-4 text-sm text-slate-500">Supports Terraform state v4 JSON.</p>
        </div>
        {error && <p className="mt-4 rounded-xl border border-rose-900 bg-rose-950/40 p-3 text-sm text-rose-200">{error}</p>}
      </Card>
    </div>
  );
}
