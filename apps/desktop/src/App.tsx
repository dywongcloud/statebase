import { useMemo, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StateBaseClient } from "@statebase/sdk";
import { Layout, type Screen } from "./components/Layout";
import { Welcome } from "./screens/Welcome";
import { Connection, type ConnectionProfile } from "./screens/Connection";
import { LocalOpen } from "./screens/LocalOpen";
import { WorkspaceExplorer } from "./screens/WorkspaceExplorer";
import { ResourceInventory } from "./screens/ResourceInventory";
import { SQLConsole } from "./screens/SQLConsole";
import { DiffViewer } from "./screens/DiffViewer";
import { DependencyGraph } from "./screens/DependencyGraph";
import { SecurityFindings } from "./screens/SecurityFindings";
import { APIExplorer } from "./screens/APIExplorer";
import { Settings } from "./screens/Settings";
import type { LocalDataset } from "./lib/localNormalize";

const queryClient = new QueryClient();

type AppMode = "welcome" | "connect" | "local-open" | "connected" | "local";

export default function App() {
  const [mode, setMode] = useState<AppMode>("welcome");
  const [screen, setScreen] = useState<Screen>("explorer");
  const [profile, setProfile] = useState<ConnectionProfile | null>(null);
  const [localDataset, setLocalDataset] = useState<LocalDataset | null>(null);
  const client = useMemo(() => profile ? new StateBaseClient({ baseUrl: profile.baseUrl, token: profile.token }) : undefined, [profile]);

  if (mode === "welcome") return <Welcome onConnected={() => setMode("connect")} onLocal={() => setMode("local-open")} />;
  if (mode === "connect") return <Connection onConnected={(next) => { setProfile(next); setMode("connected"); }} />;
  if (mode === "local-open") return <LocalOpen onLoaded={(dataset) => { setLocalDataset(dataset); setMode("local"); }} />;

  const activeMode = mode === "local" ? "local" : "connected";
  const modeLabel = activeMode === "local" ? "Local File Mode" : "Connected Mode";

  return (
    <QueryClientProvider client={queryClient}>
      <Layout modeLabel={modeLabel} screen={screen} setScreen={setScreen}>
        {screen === "explorer" && <WorkspaceExplorer mode={activeMode} client={client} orgId={profile?.orgId} local={localDataset ?? undefined} />}
        {screen === "resources" && <ResourceInventory mode={activeMode} client={client} orgId={profile?.orgId} local={localDataset ?? undefined} />}
        {screen === "sql" && <SQLConsole mode={activeMode} client={client} orgId={profile?.orgId} local={localDataset ?? undefined} />}
        {screen === "diff" && <DiffViewer mode={activeMode} client={client} orgId={profile?.orgId} local={localDataset ?? undefined} />}
        {screen === "graph" && <DependencyGraph mode={activeMode} client={client} orgId={profile?.orgId} local={localDataset ?? undefined} />}
        {screen === "security" && <SecurityFindings mode={activeMode} client={client} orgId={profile?.orgId} local={localDataset ?? undefined} />}
        {screen === "api" && <APIExplorer mode={activeMode} client={client} orgId={profile?.orgId} />}
        {screen === "settings" && <Settings modeLabel={modeLabel} />}
      </Layout>
    </QueryClientProvider>
  );
}
