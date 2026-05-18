import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import ReactFlow, { Background, Controls, MiniMap, type Edge, type Node } from "reactflow";
import "reactflow/dist/style.css";
import type { StateBaseClient } from "@statebase/sdk";
import type { LocalDataset } from "../lib/localNormalize";
import { Card, CardDescription, CardTitle } from "../components/ui/card";

export function DependencyGraph({ mode, client, orgId, local }: { mode: "connected" | "local"; client?: StateBaseClient; orgId?: string; local?: LocalDataset }) {
  const resourcesQuery = useQuery({
    queryKey: ["graph-resources", orgId],
    enabled: mode === "connected" && Boolean(client && orgId),
    queryFn: () => client!.resources.list({ orgId: orgId!, pageSize: 100 }) as Promise<any>
  });
  const depsQuery = useQuery({
    queryKey: ["graph-deps", orgId],
    enabled: mode === "connected" && Boolean(client && orgId),
    queryFn: () => client!.dependencies.list({ orgId: orgId!, pageSize: 500 }) as Promise<any>
  });

  const resources = mode === "local" ? local?.resources ?? [] : ((resourcesQuery.data as any)?.items ?? []);
  const dependencies = mode === "local" ? local?.dependencies ?? [] : ((depsQuery.data as any)?.items ?? []);

  const { nodes, edges } = useMemo(() => {
    const nodes: Node[] = resources.slice(0, 100).map((resource: any, index: number) => ({
      id: String(resource.address),
      data: { label: `${resource.type}\n${resource.address}` },
      position: { x: (index % 5) * 260, y: Math.floor(index / 5) * 140 },
      style: { background: "#11172f", color: "#e5ecff", border: "1px solid #26304f", borderRadius: 12, width: 220 }
    }));
    const nodeIds = new Set(nodes.map((node) => node.id));
    const edges: Edge[] = dependencies
      .map((dep: any, index: number) => ({ id: `e-${index}`, source: String(dep.source_address ?? dep.sourceAddress), target: String(dep.target_address ?? dep.targetAddress), animated: true }))
      .filter((edge) => nodeIds.has(edge.source.replace(/\[[^\]]+\]$/, "")) || nodeIds.has(edge.source))
      .map((edge) => ({ ...edge, source: nodeIds.has(edge.source) ? edge.source : edge.source.replace(/\[[^\]]+\]$/, "") }))
      .filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target));
    return { nodes, edges };
  }, [resources, dependencies]);

  return (
    <div className="space-y-6">
      <div><h1 className="text-3xl font-bold text-white">Dependency Graph</h1><p className="mt-2 text-slate-400">React Flow graph of Terraform resource dependencies.</p></div>
      <Card className="h-[680px] p-0">
        <div className="border-b border-borderSoft p-4"><CardTitle>Resource topology</CardTitle><CardDescription>{nodes.length} nodes · {edges.length} edges</CardDescription></div>
        <div className="h-[600px] bg-[#050816]">
          <ReactFlow nodes={nodes} edges={edges} fitView><MiniMap /><Controls /><Background /></ReactFlow>
        </div>
      </Card>
    </div>
  );
}
