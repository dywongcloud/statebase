import { Activity, Boxes, Braces, Database, FileJson, GitCompare, KeyRound, Network, Search, ShieldAlert, TerminalSquare } from "lucide-react";
import { cn } from "../lib/cn";

export type Screen = "explorer" | "resources" | "sql" | "diff" | "graph" | "security" | "api" | "settings";

const nav = [
  { id: "explorer", label: "Workspace", icon: Boxes },
  { id: "resources", label: "Inventory", icon: Database },
  { id: "sql", label: "SQL Console", icon: TerminalSquare },
  { id: "diff", label: "Diff Viewer", icon: GitCompare },
  { id: "graph", label: "Dependency Graph", icon: Network },
  { id: "security", label: "Security", icon: ShieldAlert },
  { id: "api", label: "API Explorer", icon: Braces },
  { id: "settings", label: "Settings", icon: KeyRound }
] as const;

export function Layout({ modeLabel, screen, setScreen, children }: { modeLabel: string; screen: Screen; setScreen: (screen: Screen) => void; children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-background text-slate-100">
      <aside className="flex w-72 flex-col border-r border-borderSoft bg-[#070a18]/95 p-4">
        <div className="mb-8 flex items-center gap-3 px-2">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent shadow-glow">
            <FileJson className="h-6 w-6" />
          </div>
          <div>
            <div className="text-lg font-bold tracking-tight">StateBase</div>
            <div className="text-xs uppercase tracking-widest text-slate-500">{modeLabel}</div>
          </div>
        </div>

        <div className="mb-4 flex items-center gap-2 rounded-xl border border-borderSoft bg-panelSoft px-3 py-2 text-sm text-slate-400">
          <Search className="h-4 w-4" />
          <span>⌘K command palette</span>
        </div>

        <nav className="space-y-1">
          {nav.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setScreen(item.id)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition",
                  screen === item.id ? "bg-accent text-white shadow-glow" : "text-slate-400 hover:bg-panelSoft hover:text-white"
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="mt-auto rounded-2xl border border-borderSoft bg-panel p-4 text-sm text-slate-400">
          <div className="mb-2 flex items-center gap-2 text-slate-200">
            <Activity className="h-4 w-4 text-emerald-400" />
            Trust boundary
          </div>
          Local mode never uses the network. Connected mode sends only authenticated API requests.
        </div>
      </aside>
      <main className="min-w-0 flex-1 overflow-auto p-6">{children}</main>
    </div>
  );
}
