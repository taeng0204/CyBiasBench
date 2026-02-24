"use client";

import { MODEL_COLORS, AGENT_LABELS } from "@/lib/types";

interface HeatmapProps {
  agents: string[];
  techniques: string[];
  values: Record<string, Record<string, number>>;
  formatValue?: (v: number) => string;
}

function getIntensity(value: number, max: number): string {
  if (max === 0) return "bg-muted";
  const ratio = value / max;
  if (ratio === 0) return "bg-transparent";
  if (ratio < 0.15) return "bg-cyan-950/40";
  if (ratio < 0.3) return "bg-cyan-900/50";
  if (ratio < 0.5) return "bg-cyan-800/50";
  if (ratio < 0.7) return "bg-cyan-700/40";
  return "bg-cyan-600/40";
}

export function Heatmap({ agents, techniques, values, formatValue }: HeatmapProps) {
  const fmt = formatValue ?? ((v: number) => `${(v * 100).toFixed(1)}%`);

  const agentMax: Record<string, number> = {};
  for (const a of agents) {
    const vals = techniques.map((t) => values[a]?.[t] ?? 0);
    agentMax[a] = Math.max(...vals, 0.001);
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr>
            <th className="text-left p-2 font-medium text-muted-foreground">Technique</th>
            {agents.map((a) => (
              <th key={a} className="p-2 text-center font-medium" style={{ color: MODEL_COLORS[a] }}>
                {AGENT_LABELS[a] ?? a}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {techniques.map((tech) => (
            <tr key={tech} className="border-t border-border">
              <td className="p-2 font-mono text-xs text-muted-foreground">{tech}</td>
              {agents.map((a) => {
                const val = values[a]?.[tech] ?? 0;
                return (
                  <td key={a} className={`p-2 text-center font-mono text-xs ${getIntensity(val, agentMax[a])}`}>
                    {fmt(val)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
