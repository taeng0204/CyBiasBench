"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RTooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { loadAnalysisData } from "@/lib/data";
import type { AnalysisResults, AggregatedAgent, PerExperiment } from "@/lib/types";
import { AGENTS, AGENT_LABELS, AGENT_MODELS, MODEL_COLORS, TARGET_LABELS } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Heatmap } from "@/components/charts/heatmap";
import { RadarChart } from "@/components/charts/radar-chart";
import {
  pctFormatter,
  pctFormatter0,
  dollarFormatter,
  dollarFormatter4,
  tokenFormatter,
  tokenKFormatter,
  numFormatter2,
  numFormatter4,
  labelFormatter,
} from "@/lib/chart-utils";

// ─── helpers ────────────────────────────────────────────────────────────────

function fmt(n: number | null | undefined, decimals = 1): string {
  if (n == null || !isFinite(n)) return "\u2014";
  return n.toFixed(decimals);
}

function fmtPct(n: number | null | undefined, decimals = 1): string {
  if (n == null || !isFinite(n)) return "\u2014";
  return `${(n * 100).toFixed(decimals)}%`;
}

function fmtDollar(n: number | null | undefined, decimals = 2): string {
  if (n == null || !isFinite(n)) return "\u2014";
  return `$${n.toFixed(decimals)}`;
}

function fmtInt(n: number | null | undefined): string {
  if (n == null || !isFinite(n)) return "\u2014";
  return n.toLocaleString();
}

function behaviorTag(agent: AggregatedAgent, name: string): string {
  // Derive a qualitative style tag from metrics
  const asr = agent.overall_asr;
  const entropy = agent.shannon_entropy;
  const exploration = agent.avg_exploration_rate;
  const persistence = agent.avg_persistence_score;

  if (name === "claude") {
    if (persistence > 0.5) return "Persistent Attacker";
    return "Methodical Strategist";
  }
  if (name === "codex") {
    if (exploration > 0.5) return "Diverse Explorer";
    if (entropy > 2.5) return "Versatile Scanner";
    return "Broad Surveyor";
  }
  if (name === "gemini") {
    if (asr > 0.15) return "Efficient Striker";
    if (persistence < 0.3) return "Rapid Prober";
    return "Adaptive Tester";
  }
  return "Unknown";
}

// ─── dark-theme Recharts constants ──────────────────────────────────────────

const DARK_GRID = "#23232a";
const DARK_TICK = { fontSize: 12, fill: "#a1a1aa" } as const;
const DARK_TOOLTIP = {
  borderRadius: 8,
  border: "1px solid #23232a",
  fontSize: 12,
  backgroundColor: "#1a1a1e",
  color: "#e4e4e7",
} as const;

// ─── scroll-triggered render ────────────────────────────────────────────────

function InView({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "100px 0px", threshold: 0.05 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className={className}>
      {visible ? children : <div className="h-64" />}
    </div>
  );
}

// ─── analysis helpers ───────────────────────────────────────────────────────

function tLabel(t: string): string {
  return TARGET_LABELS[t] ?? t;
}

// ─── challenge insights ──────────────────────────────────────────────────────

interface ChallengeInsightMeta { key: string; name: string; category: string; difficulty: number }

interface ChallengeInsights {
  // Per agent: unique solved count per target
  overview: Record<string, { target: string; uniqueSolved: number; totalAvailable: number | null; sessions: number }[]>;
  // Consistency rows sorted by difficulty desc then name
  consistency: { key: string; name: string; category: string; difficulty: number; agents: Record<string, { solved: number; total: number }> }[];
  // By difficulty: unique challenges solved per agent
  difficultyBreakdown: { difficulty: number; agents: Record<string, number> }[];
  // Exclusive capabilities (juice-shop agent × agent overlaps)
  exclusives: {
    all3: ChallengeInsightMeta[];
    claudeOnly: ChallengeInsightMeta[];
    codexOnly: ChallengeInsightMeta[];
    geminiOnly: ChallengeInsightMeta[];
    claudeCodex: ChallengeInsightMeta[];
    claudeGemini: ChallengeInsightMeta[];
    codexGemini: ChallengeInsightMeta[];
  };
  // Vuln-shop simple matrix
  vulnShopMatrix: { name: string; agents: Record<string, boolean> }[];
  // Total sessions per agent in juice-shop
  juiceShopSessions: Record<string, number>;
}

function buildChallengeInsights(data: AnalysisResults): ChallengeInsights {
  // --- gather per-agent session counts and solved sets per session ---
  // For juice-shop consistency heatmap: agent → list of sessions, each session → Set of solved keys
  const jsAgentSessions: Record<string, { sessionId: string; solved: Set<string> }[]> = {};
  // All known challenge metadata (from juice-shop)
  const jsMeta: Map<string, ChallengeInsightMeta> = new Map();

  for (const exp of data.per_experiment) {
    if (!exp.challenge_details || exp.challenge_details.length === 0) continue;
    if (exp.target !== "juice-shop") continue;
    if (!jsAgentSessions[exp.agent]) jsAgentSessions[exp.agent] = [];
    const solved = new Set(exp.challenge_details.filter((c) => c.solved).map((c) => c.key));
    jsAgentSessions[exp.agent].push({ sessionId: exp.session_id, solved });
    for (const c of exp.challenge_details) {
      if (!jsMeta.has(c.key)) jsMeta.set(c.key, { key: c.key, name: c.name, category: c.category, difficulty: c.difficulty });
    }
  }

  // juiceShopSessions: total sessions per agent
  const juiceShopSessions: Record<string, number> = {};
  for (const agent of AGENTS) {
    juiceShopSessions[agent] = jsAgentSessions[agent]?.length ?? 0;
  }

  // --- consistency: per challenge key × agent → solved/total ---
  const allMetaArr = [...jsMeta.values()].sort((a, b) =>
    b.difficulty - a.difficulty || a.name.localeCompare(b.name)
  );

  const consistency = allMetaArr.map((meta) => {
    const agents: Record<string, { solved: number; total: number }> = {};
    for (const agent of AGENTS) {
      const sessions = jsAgentSessions[agent] ?? [];
      if (sessions.length === 0) continue;
      let solved = 0;
      for (const s of sessions) {
        if (s.solved.has(meta.key)) solved++;
      }
      agents[agent] = { solved, total: sessions.length };
    }
    return { ...meta, agents };
  });

  // --- difficultyBreakdown: per difficulty level, count unique challenges solved at least once per agent ---
  const difficulties = [1, 2, 3, 4];
  const difficultyBreakdown = difficulties.map((d) => {
    const agents: Record<string, number> = {};
    for (const agent of AGENTS) {
      const sessions = jsAgentSessions[agent] ?? [];
      const solvedKeys = new Set<string>();
      for (const s of sessions) {
        for (const key of s.solved) {
          const meta = jsMeta.get(key);
          if (meta && meta.difficulty === d) solvedKeys.add(key);
        }
      }
      agents[agent] = solvedKeys.size;
    }
    return { difficulty: d, agents };
  });

  // --- exclusives: which challenges each agent solved at least once ---
  const agentSolvedSets: Record<string, Set<string>> = {};
  for (const agent of AGENTS) {
    const sessions = jsAgentSessions[agent] ?? [];
    const s = new Set<string>();
    for (const sess of sessions) {
      for (const k of sess.solved) s.add(k);
    }
    agentSolvedSets[agent] = s;
  }

  const [cSet, dSet, gSet] = [agentSolvedSets["claude"] ?? new Set(), agentSolvedSets["codex"] ?? new Set(), agentSolvedSets["gemini"] ?? new Set()];
  const allSolved = new Set([...cSet, ...dSet, ...gSet]);

  function getMeta(keys: string[]): ChallengeInsightMeta[] {
    return keys.map((k) => jsMeta.get(k)!).filter(Boolean).sort((a, b) => b.difficulty - a.difficulty || a.name.localeCompare(b.name));
  }

  const all3Keys = [...allSolved].filter((k) => cSet.has(k) && dSet.has(k) && gSet.has(k));
  const claudeOnly = [...cSet].filter((k) => !dSet.has(k) && !gSet.has(k));
  const codexOnly = [...dSet].filter((k) => !cSet.has(k) && !gSet.has(k));
  const geminiOnly = [...gSet].filter((k) => !cSet.has(k) && !dSet.has(k));
  const claudeCodex = [...allSolved].filter((k) => cSet.has(k) && dSet.has(k) && !gSet.has(k));
  const claudeGemini = [...allSolved].filter((k) => cSet.has(k) && gSet.has(k) && !dSet.has(k));
  const codexGemini = [...allSolved].filter((k) => dSet.has(k) && gSet.has(k) && !cSet.has(k));

  // --- overview ---
  const overview: Record<string, { target: string; uniqueSolved: number; totalAvailable: number | null; sessions: number }[]> = {};
  for (const agent of AGENTS) {
    overview[agent] = [];
    const targetSessions: Record<string, { solved: Set<string>; count: number; total: number | null }> = {};
    for (const exp of data.per_experiment) {
      if (exp.agent !== agent || !exp.challenge_details || exp.challenge_details.length === 0) continue;
      if (!targetSessions[exp.target]) targetSessions[exp.target] = { solved: new Set(), count: 0, total: exp.total_challenges };
      targetSessions[exp.target].count++;
      for (const c of exp.challenge_details) {
        if (c.solved) targetSessions[exp.target].solved.add(c.key);
      }
    }
    for (const [target, info] of Object.entries(targetSessions)) {
      overview[agent].push({ target, uniqueSolved: info.solved.size, totalAvailable: info.total, sessions: info.count });
    }
  }

  // --- vuln-shop matrix ---
  const vsAgentSolved: Record<string, Set<string>> = {};
  const vsMeta: Map<string, string> = new Map(); // key → name
  for (const exp of data.per_experiment) {
    if (exp.target !== "vuln-shop" || !exp.challenge_details || exp.challenge_details.length === 0) continue;
    if (!vsAgentSolved[exp.agent]) vsAgentSolved[exp.agent] = new Set();
    for (const c of exp.challenge_details) {
      if (c.solved) vsAgentSolved[exp.agent].add(c.key);
      if (!vsMeta.has(c.key)) vsMeta.set(c.key, c.name);
    }
  }
  const vulnShopMatrix = [...vsMeta.entries()].map(([key, name]) => ({
    name,
    agents: Object.fromEntries(AGENTS.map((a) => [a, vsAgentSolved[a]?.has(key) ?? false])),
  }));

  return {
    overview,
    consistency,
    difficultyBreakdown,
    exclusives: {
      all3: getMeta(all3Keys),
      claudeOnly: getMeta(claudeOnly),
      codexOnly: getMeta(codexOnly),
      geminiOnly: getMeta(geminiOnly),
      claudeCodex: getMeta(claudeCodex),
      claudeGemini: getMeta(claudeGemini),
      codexGemini: getMeta(codexGemini),
    },
    vulnShopMatrix,
    juiceShopSessions,
  };
}

function normalizeValues(values: number[]): number[] {
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (max === min) return values.map(() => 0.5);
  return values.map((v) => (v - min) / (max - min));
}

// ─── types ───────────────────────────────────────────────────────────────────

type LeaderboardSortKey =
  | "overall_asr"
  | "juice_asr"
  | "challenges"
  | "cost_per_success"
  | "entropy"
  | "exploration";

type SortDir = "asc" | "desc";
type TableDimension = "overall" | "per-target" | "per-condition";

type RawDataSortKey = keyof PerExperiment;

interface LeaderboardRow {
  id: string;
  agent: string;
  label: string;
  subLabel?: string;
  overall_asr: number;
  juice_asr: number | null;
  challenges: number | null;
  cost_per_success: number | null;
  entropy: number;
  exploration: number;
}

// ─── stat badge ──────────────────────────────────────────────────────────────

function StatBadge({ label, value }: { label: string; value: string }) {
  return (
    <div className="glow-cyber flex flex-col items-center gap-1 rounded-xl border border-border bg-card px-5 py-3 min-w-[130px]">
      <span className="font-mono text-xl font-bold text-foreground">{value}</span>
      <span className="text-xs text-muted-foreground uppercase tracking-widest">{label}</span>
    </div>
  );
}

// ─── agent profile card ───────────────────────────────────────────────────────

function AgentCard({
  agent,
  data,
}: {
  agent: string;
  data: AggregatedAgent;
}) {
  const color = MODEL_COLORS[agent] ?? "#71717a";
  const tag = behaviorTag(data, agent);
  const topTech = data.top_technique?.technique ?? "\u2014";

  return (
    <Card
      className="relative overflow-hidden flex-1 min-w-[260px]"
      style={{ borderLeftColor: color, borderLeftWidth: "3px" }}
    >
      {/* subtle colored glow in corner */}
      <div
        className="pointer-events-none absolute -top-10 -right-10 h-32 w-32 rounded-full opacity-10 blur-3xl"
        style={{ background: color }}
      />
      <CardHeader className="pb-0">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-lg font-bold" style={{ color }}>
              {AGENT_LABELS[agent] ?? agent}
            </CardTitle>
            <CardDescription className="font-mono text-xs mt-0.5">
              {AGENT_MODELS[agent] ?? agent}
            </CardDescription>
          </div>
          <Badge
            variant="outline"
            className="text-xs shrink-0"
            style={{ borderColor: color, color }}
          >
            {tag}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="pt-4 space-y-3">
        {/* Primary metric */}
        <div className="flex items-end gap-2">
          <span className="font-mono text-3xl font-bold text-foreground">
            {fmtPct(data.overall_asr, 1)}
          </span>
          <span className="text-muted-foreground text-xs mb-1">overall ASR</span>
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <div>
            <div className="text-muted-foreground text-xs uppercase tracking-wide">Top Technique</div>
            <div className="font-mono text-xs text-foreground truncate" title={topTech}>
              {topTech}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground text-xs uppercase tracking-wide">Total Cost</div>
            <div className="font-mono text-xs text-foreground">
              {fmtDollar(data.total_cost_usd)}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground text-xs uppercase tracking-wide">Challenges</div>
            <div className="font-mono text-xs text-foreground">
              {data.total_solved_challenges != null
                ? `${data.total_solved_challenges} / ${data.total_challenges ?? "?"}`
                : "\u2014"}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground text-xs uppercase tracking-wide">Shannon H</div>
            <div className="font-mono text-xs text-foreground">{fmt(data.shannon_entropy, 3)}</div>
          </div>
        </div>

        {/* Exploration bar */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Exploration rate</span>
            <span className="font-mono">{fmtPct(data.avg_exploration_rate, 1)}</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${Math.min((data.avg_exploration_rate ?? 0) * 100, 100)}%`,
                background: color,
              }}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── sort arrow ───────────────────────────────────────────────────────────────

function SortArrow({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <span className="text-muted-foreground ml-1 opacity-40">{"\u21D5"}</span>;
  return (
    <span className="ml-1 text-primary">{dir === "asc" ? "\u2191" : "\u2193"}</span>
  );
}

// ─── leaderboard ─────────────────────────────────────────────────────────────

function Leaderboard({ data }: { data: AnalysisResults }) {
  const [dimension, setDimension] = useState<TableDimension>("overall");
  const [sortKey, setSortKey] = useState<LeaderboardSortKey>("overall_asr");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const handleSort = useCallback(
    (key: LeaderboardSortKey) => {
      if (key === sortKey) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setSortKey(key);
        setSortDir("desc");
      }
    },
    [sortKey]
  );

  const rows = useCallback((): LeaderboardRow[] => {
    if (dimension === "overall") {
      return AGENTS.map((agent) => {
        const agg = data.aggregated_by_agent[agent];
        const juiceTarget = data.aggregated_by_target["juice-shop"]?.[agent];
        return {
          id: agent,
          agent,
          label: AGENT_LABELS[agent] ?? agent,
          overall_asr: agg?.overall_asr ?? 0,
          juice_asr: juiceTarget?.overall_asr ?? null,
          challenges: agg?.total_solved_challenges ?? null,
          cost_per_success: agg?.cost_per_success ?? null,
          entropy: agg?.shannon_entropy ?? 0,
          exploration: agg?.avg_exploration_rate ?? 0,
        };
      });
    }

    if (dimension === "per-target") {
      const rows: LeaderboardRow[] = [];
      for (const [target, agentMap] of Object.entries(data.aggregated_by_target)) {
        for (const agent of AGENTS) {
          const agg = agentMap[agent];
          if (!agg) continue;
          rows.push({
            id: `${agent}-${target}`,
            agent,
            label: AGENT_LABELS[agent] ?? agent,
            subLabel: TARGET_LABELS[target] ?? target,
            overall_asr: agg.overall_asr ?? 0,
            juice_asr: target === "juice-shop" ? agg.overall_asr : null,
            challenges: agg.total_solved_challenges ?? null,
            cost_per_success: agg.cost_per_success ?? null,
            entropy: agg.shannon_entropy ?? 0,
            exploration: agg.avg_exploration_rate ?? 0,
          });
        }
      }
      return rows;
    }

    // per-condition
    const rows: LeaderboardRow[] = [];
    for (const [condition, agentMap] of Object.entries(data.aggregated_by_condition)) {
      for (const agent of AGENTS) {
        const agg = agentMap[agent];
        if (!agg) continue;
        rows.push({
          id: `${agent}-${condition}`,
          agent,
          label: AGENT_LABELS[agent] ?? agent,
          subLabel: condition.replace(/_/g, " / ").replace(/\b\w/g, c => c.toUpperCase()),
          overall_asr: agg.overall_asr ?? 0,
          juice_asr: null,
          challenges: agg.total_solved_challenges ?? null,
          cost_per_success: agg.cost_per_success ?? null,
          entropy: agg.shannon_entropy ?? 0,
          exploration: agg.avg_exploration_rate ?? 0,
        });
      }
    }
    return rows;
  }, [data, dimension])();

  const sorted = [...rows].sort((a, b) => {
    let av: number;
    let bv: number;
    switch (sortKey) {
      case "overall_asr":
        av = a.overall_asr;
        bv = b.overall_asr;
        break;
      case "juice_asr":
        av = a.juice_asr ?? -Infinity;
        bv = b.juice_asr ?? -Infinity;
        break;
      case "challenges":
        av = a.challenges ?? -Infinity;
        bv = b.challenges ?? -Infinity;
        break;
      case "cost_per_success":
        av = a.cost_per_success ?? Infinity;
        bv = b.cost_per_success ?? Infinity;
        break;
      case "entropy":
        av = a.entropy;
        bv = b.entropy;
        break;
      case "exploration":
        av = a.exploration;
        bv = b.exploration;
        break;
      default:
        return 0;
    }
    return sortDir === "asc" ? av - bv : bv - av;
  });

  const maxAsr = Math.max(...sorted.map((r) => r.overall_asr), 0.001);

  return (
    <div className="space-y-4">
      {/* Dimension toggle */}
      <div className="flex items-center gap-2">
        {(["overall", "per-target", "per-condition"] as TableDimension[]).map((d) => (
          <button
            key={d}
            onClick={() => setDimension(d)}
            className={[
              "px-3 py-1.5 rounded-lg text-xs font-medium transition-all border",
              dimension === d
                ? "bg-primary/10 border-primary/40 text-primary"
                : "border-border text-muted-foreground hover:text-foreground hover:border-border/80",
            ].join(" ")}
          >
            {d === "overall"
              ? "Overall"
              : d === "per-target"
              ? "Per-Target"
              : "Per-Condition"}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-border bg-muted/20 hover:bg-muted/20">
              <TableHead className="w-10 text-center">#</TableHead>
              <TableHead>Agent</TableHead>
              <TableHead
                className="cursor-pointer select-none"
                onClick={() => handleSort("overall_asr")}
              >
                Overall ASR
                <SortArrow active={sortKey === "overall_asr"} dir={sortDir} />
              </TableHead>
              <TableHead
                className="cursor-pointer select-none"
                onClick={() => handleSort("juice_asr")}
              >
                Juice Shop ASR
                <SortArrow active={sortKey === "juice_asr"} dir={sortDir} />
              </TableHead>
              <TableHead
                className="cursor-pointer select-none"
                onClick={() => handleSort("challenges")}
              >
                Challenges
                <SortArrow active={sortKey === "challenges"} dir={sortDir} />
              </TableHead>
              <TableHead
                className="cursor-pointer select-none"
                onClick={() => handleSort("cost_per_success")}
              >
                Cost / Success
                <SortArrow active={sortKey === "cost_per_success"} dir={sortDir} />
              </TableHead>
              <TableHead
                className="cursor-pointer select-none"
                onClick={() => handleSort("entropy")}
              >
                Shannon H
                <SortArrow active={sortKey === "entropy"} dir={sortDir} />
              </TableHead>
              <TableHead
                className="cursor-pointer select-none"
                onClick={() => handleSort("exploration")}
              >
                Exploration
                <SortArrow active={sortKey === "exploration"} dir={sortDir} />
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((row, i) => {
              const color = MODEL_COLORS[row.agent] ?? "#71717a";
              const asrWidth = (row.overall_asr / maxAsr) * 100;
              return (
                <TableRow key={row.id} className="border-border">
                  <TableCell className="text-center font-mono text-muted-foreground text-xs">
                    {i + 1}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-0.5">
                      <span className="font-semibold text-sm" style={{ color }}>
                        {row.label}
                      </span>
                      {row.subLabel && (
                        <span className="text-muted-foreground text-xs font-mono">
                          {row.subLabel}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 min-w-[100px]">
                      <span className="font-mono text-sm text-foreground w-14 shrink-0">
                        {fmtPct(row.overall_asr)}
                      </span>
                      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${asrWidth}%`, background: color }}
                        />
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-sm text-foreground">
                    {row.juice_asr != null ? fmtPct(row.juice_asr) : "\u2014"}
                  </TableCell>
                  <TableCell className="font-mono text-sm text-foreground">
                    {row.challenges != null ? fmtInt(row.challenges) : "\u2014"}
                  </TableCell>
                  <TableCell
                    className={[
                      "font-mono text-sm",
                      row.cost_per_success != null && row.cost_per_success < 1
                        ? "text-emerald-400"
                        : "text-foreground",
                    ].join(" ")}
                  >
                    {row.cost_per_success != null ? fmtDollar(row.cost_per_success) : "\u2014"}
                  </TableCell>
                  <TableCell className="font-mono text-sm text-foreground">
                    {fmt(row.entropy, 3)}
                  </TableCell>
                  <TableCell className="font-mono text-sm text-foreground">
                    {fmtPct(row.exploration)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ─── heatmap section ─────────────────────────────────────────────────────────

function TechniqueHeatmapSection({ data }: { data: AnalysisResults }) {
  // Build normalised proportions per agent
  const agents = AGENTS.filter((a) => data.aggregated_by_agent[a]);

  // Gather all techniques across all agents
  const techSet = new Set<string>();
  for (const agent of agents) {
    const dist = data.aggregated_by_agent[agent]?.technique_distribution ?? {};
    for (const k of Object.keys(dist)) techSet.add(k);
  }

  // Sort techniques by total count descending, cap at top 12
  const techniques = [...techSet]
    .sort((a, b) => {
      const sumA = agents.reduce(
        (s, ag) => s + (data.aggregated_by_agent[ag]?.technique_distribution[a] ?? 0),
        0
      );
      const sumB = agents.reduce(
        (s, ag) => s + (data.aggregated_by_agent[ag]?.technique_distribution[b] ?? 0),
        0
      );
      return sumB - sumA;
    })
    .slice(0, 12);

  // Normalise each agent's distribution to proportions
  const values: Record<string, Record<string, number>> = {};
  for (const agent of agents) {
    const dist = data.aggregated_by_agent[agent]?.technique_distribution ?? {};
    const total = Object.values(dist).reduce((s, v) => s + v, 0) || 1;
    values[agent] = {};
    for (const tech of techniques) {
      values[agent][tech] = (dist[tech] ?? 0) / total;
    }
  }

  return (
    <Heatmap
      agents={[...agents]}
      techniques={techniques}
      values={values}
      formatValue={(v) => `${(v * 100).toFixed(1)}%`}
    />
  );
}

// ─── loading skeleton ────────────────────────────────────────────────────────

function Skeleton({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={["animate-pulse rounded-md bg-muted", className].filter(Boolean).join(" ")}
      style={style}
    />
  );
}

// ===========================================================================
// Analysis Tab 1: Technique Bias
// ===========================================================================
function TechniqueBiasContent({ data }: { data: AnalysisResults }) {
  const agg = data.aggregated_by_agent;
  const jsd = data.statistical_tests.jsd_analysis;
  const spearman = data.statistical_tests.spearman_correlation;

  // Technique distribution heatmap values
  const allTechs = new Set<string>();
  AGENTS.forEach((a) => {
    Object.keys(agg[a]?.technique_distribution ?? {}).forEach((t) => allTechs.add(t));
  });
  const techniques = [...allTechs].sort();

  const heatmapValues: Record<string, Record<string, number>> = {};
  for (const a of AGENTS) {
    const dist = agg[a]?.technique_distribution ?? {};
    const total = Object.values(dist).reduce((s, v) => s + v, 0);
    heatmapValues[a] = {};
    for (const t of techniques) {
      heatmapValues[a][t] = total > 0 ? (dist[t] ?? 0) / total : 0;
    }
  }

  // Shannon Entropy per agent
  const entropyData = AGENTS.map((a) => ({
    name: AGENT_LABELS[a],
    value: agg[a]?.shannon_entropy ?? 0,
  }));

  // HHI per agent
  const hhiData = AGENTS.map((a) => ({
    name: AGENT_LABELS[a],
    value: agg[a]?.hhi ?? 0,
  }));

  // First Move Distribution
  const allFirstMoves = new Set<string>();
  AGENTS.forEach((a) => {
    Object.keys(agg[a]?.first_move_distribution ?? {}).forEach((m) => allFirstMoves.add(m));
  });
  const firstMoves = [...allFirstMoves].sort();
  const firstMoveData = firstMoves.map((move) => {
    const row: Record<string, string | number> = { name: move };
    for (const a of AGENTS) {
      row[a] = agg[a]?.first_move_distribution?.[move] ?? 0;
    }
    return row;
  });

  return (
    <div className="space-y-6">
      {/* Heatmap */}
      <Card>
        <CardHeader>
          <CardTitle>Technique Distribution Heatmap</CardTitle>
          <CardDescription>Proportion of each attack technique per agent (excluding benign requests)</CardDescription>
        </CardHeader>
        <CardContent>
          <Heatmap agents={[...AGENTS]} techniques={techniques} values={heatmapValues} />
        </CardContent>
      </Card>

      {/* Entropy + HHI side by side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Shannon Entropy</CardTitle>
            <CardDescription>Higher = more diverse technique usage (max = log2(n_techniques))</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={entropyData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={DARK_GRID} />
                <XAxis dataKey="name" tick={DARK_TICK} />
                <YAxis tick={DARK_TICK} />
                <RTooltip formatter={numFormatter2} contentStyle={DARK_TOOLTIP} />
                <Bar dataKey="value" name="Shannon Entropy" radius={[4, 4, 0, 0]}>
                  {AGENTS.map((a) => <Cell key={a} fill={MODEL_COLORS[a]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Herfindahl-Hirschman Index (HHI)</CardTitle>
            <CardDescription>Higher = more concentrated on fewer techniques (opposite of entropy)</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={hhiData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={DARK_GRID} />
                <XAxis dataKey="name" tick={DARK_TICK} />
                <YAxis tick={DARK_TICK} domain={[0, "auto"]} />
                <RTooltip formatter={numFormatter2} contentStyle={DARK_TOOLTIP} />
                <Bar dataKey="value" name="HHI" radius={[4, 4, 0, 0]}>
                  {AGENTS.map((a) => <Cell key={a} fill={MODEL_COLORS[a]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* First Move Distribution */}
      <Card>
        <CardHeader>
          <CardTitle>First Move Distribution</CardTitle>
          <CardDescription>Which technique each model uses first across experiments</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={firstMoveData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={DARK_GRID} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#a1a1aa" }} />
              <YAxis tick={DARK_TICK} />
              <RTooltip contentStyle={DARK_TOOLTIP} />
              <Legend formatter={labelFormatter(AGENT_LABELS)} />
              <Bar dataKey="claude" fill={MODEL_COLORS.claude} radius={[4, 4, 0, 0]} />
              <Bar dataKey="codex" fill={MODEL_COLORS.codex} radius={[4, 4, 0, 0]} />
              <Bar dataKey="gemini" fill={MODEL_COLORS.gemini} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* JSD pairwise */}
      <Card>
        <CardHeader>
          <CardTitle>Jensen-Shannon Divergence</CardTitle>
          <CardDescription>Distribution divergence between model pairs (0 = identical, 1 = maximally different)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Object.entries(jsd.jsd).map(([pair, value]) => (
              <div key={pair} className="flex items-center justify-between p-3 rounded-lg bg-muted">
                <span className="text-sm font-medium">{pair.replace(/_vs_/g, " vs ")}</span>
                <Badge variant="outline">{value.toFixed(4)}</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Spearman correlation */}
      <Card>
        <CardHeader>
          <CardTitle>Technique Preference Rank Correlation</CardTitle>
          <CardDescription>Spearman&apos;s &rho; between model pairs (1 = identical ranking, -1 = opposite)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Object.entries(spearman).map(([pair, info]) => (
              <div key={pair} className="flex items-center justify-between p-3 rounded-lg bg-muted">
                <div>
                  <div className="text-sm font-medium">{pair.replace(/_vs_/g, " vs ")}</div>
                  <div className="text-xs text-muted-foreground">p = {info.p_value.toFixed(4)}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-semibold text-sm">&rho; = {info.rho.toFixed(3)}</span>
                  <Badge variant={info.significant_005 ? "default" : "outline"}>
                    {info.significant_005 ? "Sig." : "N.S."}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ===========================================================================
// Analysis Tab 2: Attack Success
// ===========================================================================
function AttackSuccessContent({ data }: { data: AnalysisResults }) {
  const agg = data.aggregated_by_agent;
  const fisher = data.statistical_tests.fisher_tests;

  const challengeInsights = useMemo(() => buildChallengeInsights(data), [data]);

  // Per-technique ASR
  const allTechs = new Set<string>();
  AGENTS.forEach((a) => {
    Object.keys(agg[a]?.per_technique_asr ?? {}).forEach((t) => allTechs.add(t));
  });
  const techniques = [...allTechs].sort();

  const asrData = techniques.map((tech) => {
    const row: Record<string, string | number> = { name: tech };
    for (const a of AGENTS) {
      row[a] = agg[a]?.per_technique_asr?.[tech]?.asr ?? 0;
    }
    return row;
  });

  const costData = AGENTS
    .filter((a) => agg[a]?.cost_per_success != null)
    .map((a) => ({ name: AGENT_LABELS[a], value: agg[a]!.cost_per_success!, fill: MODEL_COLORS[a] }));

  const tokenData = AGENTS
    .filter((a) => agg[a]?.tokens_per_attack != null)
    .map((a) => ({ name: AGENT_LABELS[a], value: agg[a]!.tokens_per_attack!, fill: MODEL_COLORS[a] }));

  const solvedData = AGENTS
    .filter((a) => agg[a]?.total_solved_challenges != null)
    .map((a) => ({ name: AGENT_LABELS[a], value: agg[a]!.total_solved_challenges!, fill: MODEL_COLORS[a] }));

  const tokensPerChallengeData = AGENTS
    .filter((a) => agg[a]?.tokens_per_challenge != null)
    .map((a) => ({ name: AGENT_LABELS[a], value: agg[a]!.tokens_per_challenge!, fill: MODEL_COLORS[a] }));

  const significantFisher = Object.entries(fisher).flatMap(([tech, pairs]) =>
    Object.entries(pairs)
      .filter(([, info]) => info.significant_005)
      .map(([pair, info]) => ({ tech, pair, ...info }))
  );
  const totalComparisons = Object.values(fisher).reduce((s, pairs) => s + Object.keys(pairs).length, 0);

  return (
    <div className="space-y-6">
      {/* Ground-truth verification callout */}
      <div className="rounded-lg border border-emerald-900/50 bg-emerald-950/20 px-4 py-3 mb-6">
        <p className="text-sm text-emerald-400 font-medium">Ground-Truth Verified</p>
        <p className="text-xs text-muted-foreground mt-1">
          Challenge success rates are verified via the target application&apos;s challenge API (Juice Shop, Vuln Shop),
          not self-reported by agents. Heuristic ASR is based on automated HTTP traffic classification using OWASP CRS patterns.
        </p>
      </div>

      {/* Per-target ASR cards */}
      {Object.keys(data.aggregated_by_target).sort().map((target) => {
        const targetAgg = data.aggregated_by_target[target];
        return (
          <div key={target}>
            <h3 className="text-lg font-semibold mb-3">{tLabel(target)}</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {AGENTS.map((agent) => {
                const a = targetAgg[agent];
                if (!a) return null;
                const hasChallengeAsr = a.avg_challenge_asr != null;
                return (
                  <Card key={agent}>
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: MODEL_COLORS[agent] }} />
                        <span className="font-semibold">{AGENT_LABELS[agent]}</span>
                      </div>
                      <div className="flex items-end gap-6">
                        <div>
                          <div className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Heuristic ASR</div>
                          <div className="text-2xl font-bold">{(a.overall_asr * 100).toFixed(1)}%</div>
                          <div className="text-xs text-muted-foreground">
                            {a.total_successful_attacks} / {a.total_attack_requests} requests
                          </div>
                        </div>
                        {hasChallengeAsr && (
                          <div>
                            <div className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Challenge ASR</div>
                            <div className="text-2xl font-bold" style={{ color: "#10A37F" }}>
                              {(a.avg_challenge_asr! * 100).toFixed(1)}%
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {a.total_solved_challenges} / {a.total_challenges} challenges
                            </div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Per-technique ASR horizontal bar chart */}
      <Card>
        <CardHeader>
          <CardTitle>Per-Technique ASR by Model</CardTitle>
          <CardDescription>Attack success rate for each technique</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={Math.max(300, techniques.length * 35)}>
            <BarChart data={asrData} layout="vertical" margin={{ top: 5, right: 20, left: 100, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={DARK_GRID} />
              <XAxis type="number" tickFormatter={pctFormatter0} tick={DARK_TICK} domain={[0, 1]} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "#a1a1aa" }} width={90} />
              <RTooltip formatter={pctFormatter} contentStyle={DARK_TOOLTIP} />
              <Legend formatter={labelFormatter(AGENT_LABELS)} />
              <Bar dataKey="claude" fill={MODEL_COLORS.claude} radius={[0, 4, 4, 0]} />
              <Bar dataKey="codex" fill={MODEL_COLORS.codex} radius={[0, 4, 4, 0]} />
              <Bar dataKey="gemini" fill={MODEL_COLORS.gemini} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Cost and tokens */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Cost per Successful Attack</CardTitle>
            <CardDescription>USD spent per successful attack</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={costData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={DARK_GRID} />
                <XAxis dataKey="name" tick={DARK_TICK} />
                <YAxis tickFormatter={dollarFormatter} tick={DARK_TICK} />
                <RTooltip formatter={dollarFormatter4} contentStyle={DARK_TOOLTIP} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {costData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tokens per Attack</CardTitle>
            <CardDescription>Average token consumption per attack request</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={tokenData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={DARK_GRID} />
                <XAxis dataKey="name" tick={DARK_TICK} />
                <YAxis tickFormatter={tokenKFormatter} tick={DARK_TICK} />
                <RTooltip formatter={tokenFormatter} contentStyle={DARK_TOOLTIP} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {tokenData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Challenges solved */}
      {solvedData.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Challenges Solved (Total)</CardTitle>
              <CardDescription>Total challenges solved across all experiments</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={solvedData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={DARK_GRID} />
                  <XAxis dataKey="name" tick={DARK_TICK} />
                  <YAxis tick={DARK_TICK} />
                  <RTooltip contentStyle={DARK_TOOLTIP} />
                  <Bar dataKey="value" name="Challenges Solved" radius={[4, 4, 0, 0]}>
                    {solvedData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {tokensPerChallengeData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Tokens per Challenge</CardTitle>
                <CardDescription>Average token cost per solved challenge</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={tokensPerChallengeData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={DARK_GRID} />
                    <XAxis dataKey="name" tick={DARK_TICK} />
                    <YAxis tickFormatter={tokenKFormatter} tick={DARK_TICK} />
                    <RTooltip formatter={tokenFormatter} contentStyle={DARK_TOOLTIP} />
                    <Bar dataKey="value" name="Tokens/Challenge" radius={[4, 4, 0, 0]}>
                      {tokensPerChallengeData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ── Subsection A: Solve Consistency Heatmap (Juice Shop) ── */}
      {challengeInsights.consistency.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Juice Shop — Solve Consistency Heatmap</CardTitle>
            <CardDescription>
              Per-challenge solve count across sessions (Ground Truth via Challenge API).
              Color intensity = how consistently each agent solves the challenge.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-center py-2 pr-2 font-medium text-muted-foreground w-10">D</th>
                    <th className="text-left py-2 pr-4 font-medium">Challenge</th>
                    <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Category</th>
                    {AGENTS.map((a) => (
                      <th key={a} className="text-center py-2 px-3 font-medium">
                        <span className="inline-flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: MODEL_COLORS[a] }} />
                          {AGENT_LABELS[a]}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {challengeInsights.consistency.map((ch) => {
                    const diffColor = ch.difficulty === 1 ? "bg-emerald-900/40 text-emerald-400" : ch.difficulty === 2 ? "bg-blue-900/40 text-blue-400" : ch.difficulty === 3 ? "bg-amber-900/40 text-amber-400" : "bg-red-900/40 text-red-400";
                    return (
                      <tr key={ch.key} className="border-b border-border/40 hover:bg-muted/10">
                        <td className="py-1.5 pr-2 text-center">
                          <span className={`inline-block w-6 h-6 rounded text-xs font-bold flex items-center justify-center ${diffColor}`}>{ch.difficulty}</span>
                        </td>
                        <td className="py-1.5 pr-4 font-medium text-xs">{ch.name}</td>
                        <td className="py-1.5 pr-4 text-muted-foreground text-xs">{ch.category}</td>
                        {AGENTS.map((a) => {
                          const cell = ch.agents[a];
                          const totalSessions = challengeInsights.juiceShopSessions[a] ?? 0;
                          if (!cell || totalSessions === 0) {
                            return (
                              <td key={a} className="text-center py-1.5 px-3">
                                <span className="inline-block px-2 py-0.5 rounded text-xs font-mono font-semibold bg-zinc-800/50 text-zinc-500">—</span>
                              </td>
                            );
                          }
                          const cls =
                            cell.solved === 0 ? "bg-zinc-800/50 text-zinc-500"
                            : cell.solved <= 3 ? "bg-red-900/30 text-red-400"
                            : cell.solved <= 6 ? "bg-amber-900/30 text-amber-400"
                            : cell.solved <= 9 ? "bg-blue-900/30 text-blue-400"
                            : "bg-emerald-900/30 text-emerald-400";
                          return (
                            <td key={a} className="text-center py-1.5 px-3">
                              <span className={`inline-block px-2 py-0.5 rounded text-xs font-mono font-semibold ${cls}`}>
                                {cell.solved}/{cell.total}
                              </span>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                  {/* Footer: unique solved count */}
                  <tr className="font-semibold border-t-2 border-border bg-muted/10">
                    <td />
                    <td className="py-2 pr-4 text-xs text-muted-foreground">Unique solved</td>
                    <td />
                    {AGENTS.map((a) => {
                      const n = challengeInsights.consistency.filter((ch) => (ch.agents[a]?.solved ?? 0) > 0).length;
                      return (
                        <td key={a} className="text-center py-2 px-3">
                          <span className="font-mono font-bold" style={{ color: MODEL_COLORS[a] }}>{n}</span>
                        </td>
                      );
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Subsection B: Challenges by Difficulty Grouped Bar Chart ── */}
      {challengeInsights.difficultyBreakdown.some((d) => AGENTS.some((a) => (d.agents[a] ?? 0) > 0)) && (
        <Card>
          <CardHeader>
            <CardTitle>Challenges Solved by Difficulty</CardTitle>
            <CardDescription>Number of unique challenges solved at least once, grouped by difficulty level (Juice Shop)</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart
                data={challengeInsights.difficultyBreakdown.map((d) => ({
                  name: `D${d.difficulty}`,
                  ...d.agents,
                }))}
                margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={DARK_GRID} />
                <XAxis dataKey="name" tick={DARK_TICK} />
                <YAxis tick={DARK_TICK} allowDecimals={false} />
                { /* eslint-disable-next-line @typescript-eslint/no-explicit-any */ }
                <RTooltip contentStyle={DARK_TOOLTIP} formatter={(val: any, name: any) => [val, AGENT_LABELS[name] ?? name]} />
                <Legend formatter={labelFormatter(AGENT_LABELS)} />
                <Bar dataKey="claude" fill={MODEL_COLORS.claude} radius={[4, 4, 0, 0]} />
                <Bar dataKey="codex" fill={MODEL_COLORS.codex} radius={[4, 4, 0, 0]} />
                <Bar dataKey="gemini" fill={MODEL_COLORS.gemini} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* ── Subsection C: Exclusive Capabilities ── */}
      {(() => {
        const { exclusives } = challengeInsights;
        const totalSolved = new Set([
          ...exclusives.all3.map((c) => c.key),
          ...exclusives.claudeOnly.map((c) => c.key),
          ...exclusives.codexOnly.map((c) => c.key),
          ...exclusives.geminiOnly.map((c) => c.key),
          ...exclusives.claudeCodex.map((c) => c.key),
          ...exclusives.claudeGemini.map((c) => c.key),
          ...exclusives.codexGemini.map((c) => c.key),
        ]).size;
        if (totalSolved === 0) return null;
        const agentExclusives: [string, ChallengeInsightMeta[], string][] = [
          ["claude", exclusives.claudeOnly, MODEL_COLORS.claude],
          ["codex", exclusives.codexOnly, MODEL_COLORS.codex],
          ["gemini", exclusives.geminiOnly, MODEL_COLORS.gemini],
        ];
        const pairOverlaps: [string, ChallengeInsightMeta[], string][] = [
          ["Claude + Codex", exclusives.claudeCodex, "#9c73c2"],
          ["Claude + Gemini", exclusives.claudeGemini, "#9a8060"],
          ["Codex + Gemini", exclusives.codexGemini, "#2d96a0"],
        ];
        return (
          <Card>
            <CardHeader>
              <CardTitle>Exclusive Capabilities</CardTitle>
              <CardDescription>
                Venn-style overlap of solved challenges — which challenges only one agent solves, which pairs share, and which all three solve (Juice Shop).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* All 3 center */}
                <div className="rounded-lg border border-emerald-900/50 bg-emerald-950/20 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-semibold text-emerald-400">All 3 agents solve</span>
                    <span className="font-mono text-sm font-bold text-emerald-400 ml-auto">{exclusives.all3.length} challenges</span>
                  </div>
                  {exclusives.all3.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {exclusives.all3.map((c) => (
                        <span key={c.key} className="text-xs px-2 py-0.5 rounded bg-emerald-900/30 text-emerald-300 font-mono">{c.name}</span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Per-agent exclusives */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {agentExclusives.map(([agent, challenges, color]) => (
                    <div key={agent} className="rounded-lg border p-3" style={{ borderColor: `${color}50` }}>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                        <span className="text-sm font-semibold" style={{ color }}>{AGENT_LABELS[agent]} exclusive</span>
                        <span className="font-mono text-xs font-bold ml-auto" style={{ color }}>{challenges.length}</span>
                      </div>
                      {challenges.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {challenges.map((c) => (
                            <span key={c.key} className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono">{c.name}</span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">No exclusive challenges</span>
                      )}
                    </div>
                  ))}
                </div>

                {/* Pair overlaps */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {pairOverlaps.map(([label, challenges, color]) => (
                    <div key={label} className="rounded-lg border border-border/60 p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-semibold text-muted-foreground">{label}</span>
                        <span className="font-mono text-xs font-bold ml-auto" style={{ color }}>{challenges.length}</span>
                      </div>
                      {challenges.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {challenges.map((c) => (
                            <span key={c.key} className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono">{c.name}</span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">No shared challenges</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })()}

      {/* ── Subsection D: Vuln Shop Summary ── */}
      {challengeInsights.vulnShopMatrix.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Vuln Shop — Challenge Summary</CardTitle>
            <CardDescription>Which challenges each agent solved (Ground Truth via Challenge API)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 pr-4 font-medium">Challenge</th>
                    {AGENTS.map((a) => (
                      <th key={a} className="text-center py-2 px-4 font-medium">
                        <span className="inline-flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: MODEL_COLORS[a] }} />
                          {AGENT_LABELS[a]}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {challengeInsights.vulnShopMatrix.map((row) => (
                    <tr key={row.name} className="border-b border-border/50">
                      <td className="py-2 pr-4 font-medium text-xs">{row.name}</td>
                      {AGENTS.map((a) => (
                        <td key={a} className="text-center py-2 px-4">
                          {row.agents[a] ? (
                            <span className="text-emerald-400 font-bold text-base">&#10003;</span>
                          ) : (
                            <span className="text-zinc-600 text-sm">&mdash;</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Fisher's exact test */}
      <Card>
        <CardHeader>
          <CardTitle>Fisher&apos;s Exact Test — Pairwise ASR Differences</CardTitle>
          <CardDescription>
            {totalComparisons} pairwise comparisons across {Object.keys(fisher).length} techniques.
            {significantFisher.length > 0
              ? ` ${significantFisher.length} significant at p < 0.05 (uncorrected).`
              : " No statistically significant differences found (all p \u2265 0.05)."}
            {significantFisher.length > 0 && ` Bonferroni-adjusted threshold: p < ${(0.05 / Math.max(totalComparisons, 1)).toFixed(4)}.`}
          </CardDescription>
        </CardHeader>
        {significantFisher.length > 0 && (
          <CardContent>
            <div className="space-y-2">
              {significantFisher.map((result, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-muted">
                  <Badge>{result.tech}</Badge>
                  <span className="text-sm">{result.pair.replace(/_vs_/g, " vs ")}</span>
                  <span className="text-xs text-muted-foreground ml-auto flex items-center gap-2">
                    OR = {result.odds_ratio != null ? result.odds_ratio.toFixed(4) : "N/A (zero cell)"}, p = {result.p_value.toFixed(4)}
                    {result.p_value < 0.05 / Math.max(totalComparisons, 1) ? (
                      <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Bonferroni</Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">uncorrected only</Badge>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}

// ===========================================================================
// Analysis Tab 3: Behavioral Patterns
// ===========================================================================
function BehavioralContent({ data }: { data: AnalysisResults }) {
  const agg = data.aggregated_by_agent;

  // Radar chart data -- normalize all axes to [0,1]
  const rawPersistence = AGENTS.map((a) => agg[a]?.avg_persistence_score ?? 0);
  const rawExploration = AGENTS.map((a) => agg[a]?.avg_exploration_rate ?? 0);
  const rawInertia = AGENTS.map((a) => agg[a]?.avg_inertia_rate ?? 0);
  const rawRecon = AGENTS.map((a) => agg[a]?.avg_recon_ratio ?? 0);
  const rawHalluc = AGENTS.map((a) => agg[a]?.avg_hallucinated_attack_bias ?? 0);

  const normPers = normalizeValues(rawPersistence);
  const normExpl = normalizeValues(rawExploration);
  const normIner = normalizeValues(rawInertia);
  const normReco = normalizeValues(rawRecon);
  const normHall = normalizeValues(rawHalluc);

  const radarData = [
    { metric: "Persistence", claude: normPers[0], codex: normPers[1], gemini: normPers[2] },
    { metric: "Exploration", claude: normExpl[0], codex: normExpl[1], gemini: normExpl[2] },
    { metric: "Inertia", claude: normIner[0], codex: normIner[1], gemini: normIner[2] },
    { metric: "Recon", claude: normReco[0], codex: normReco[1], gemini: normReco[2] },
    { metric: "Hallucination", claude: normHall[0], codex: normHall[1], gemini: normHall[2] },
  ];

  // HTTP method distribution
  const methodData = AGENTS.map((a) => ({
    name: AGENT_LABELS[a],
    GET: agg[a]?.method_bias?.get_pct ?? 0,
    POST: agg[a]?.method_bias?.post_pct ?? 0,
    PUT: agg[a]?.method_bias?.put_pct ?? 0,
    DELETE: agg[a]?.method_bias?.delete_pct ?? 0,
    HEAD: agg[a]?.method_bias?.head_pct ?? 0,
    Other: agg[a]?.method_bias?.other_pct ?? 0,
  }));

  // Self-report concordance (all structured conditions)
  const concordanceRecords = data.per_experiment.filter(
    (r) => r.self_report_concordance != null
  );

  return (
    <div className="space-y-6">
      {/* Radar chart */}
      <Card>
        <CardHeader>
          <CardTitle>Behavioral Profile Radar</CardTitle>
          <CardDescription>
            All axes normalized to [0,1]. Persistence, Exploration, Inertia, Recon ratio, and Hallucination bias compared across agents.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RadarChart data={radarData} height={380} />
        </CardContent>
      </Card>

      {/* 4 metric bar charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Persistence Score</CardTitle>
            <CardDescription>Avg consecutive attempts with the same technique (higher = more persistent)</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart
                data={AGENTS.map((a) => ({ name: AGENT_LABELS[a], value: agg[a]?.avg_persistence_score ?? 0 }))}
                margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={DARK_GRID} />
                <XAxis dataKey="name" tick={DARK_TICK} />
                <YAxis tick={DARK_TICK} />
                <RTooltip formatter={numFormatter2} contentStyle={DARK_TOOLTIP} />
                <Bar dataKey="value" name="Persistence" radius={[4, 4, 0, 0]}>
                  {AGENTS.map((a) => <Cell key={a} fill={MODEL_COLORS[a]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Exploration Rate</CardTitle>
            <CardDescription>Unique techniques / total attempts (higher = more exploratory)</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart
                data={AGENTS.map((a) => ({ name: AGENT_LABELS[a], value: agg[a]?.avg_exploration_rate ?? 0 }))}
                margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={DARK_GRID} />
                <XAxis dataKey="name" tick={DARK_TICK} />
                <YAxis tickFormatter={pctFormatter0} tick={DARK_TICK} domain={[0, 1]} />
                <RTooltip formatter={pctFormatter} contentStyle={DARK_TOOLTIP} />
                <Bar dataKey="value" name="Exploration Rate" radius={[4, 4, 0, 0]}>
                  {AGENTS.map((a) => <Cell key={a} fill={MODEL_COLORS[a]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Inertia Rate</CardTitle>
            <CardDescription>Consecutive same-technique pairs / total transitions (higher = more repetitive)</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart
                data={AGENTS.map((a) => ({ name: AGENT_LABELS[a], value: agg[a]?.avg_inertia_rate ?? 0 }))}
                margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={DARK_GRID} />
                <XAxis dataKey="name" tick={DARK_TICK} />
                <YAxis tickFormatter={pctFormatter0} tick={DARK_TICK} domain={[0, 1]} />
                <RTooltip formatter={pctFormatter} contentStyle={DARK_TOOLTIP} />
                <Bar dataKey="value" name="Inertia Rate" radius={[4, 4, 0, 0]}>
                  {AGENTS.map((a) => <Cell key={a} fill={MODEL_COLORS[a]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recon Ratio</CardTitle>
            <CardDescription>Proportion of benign/reconnaissance requests vs total (higher = more recon-focused)</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart
                data={AGENTS.map((a) => ({ name: AGENT_LABELS[a], value: agg[a]?.avg_recon_ratio ?? 0 }))}
                margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={DARK_GRID} />
                <XAxis dataKey="name" tick={DARK_TICK} />
                <YAxis tickFormatter={pctFormatter0} tick={DARK_TICK} domain={[0, 1]} />
                <RTooltip formatter={pctFormatter} contentStyle={DARK_TOOLTIP} />
                <Bar dataKey="value" name="Recon Ratio" radius={[4, 4, 0, 0]}>
                  {AGENTS.map((a) => <Cell key={a} fill={MODEL_COLORS[a]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* HTTP Method Distribution stacked bar */}
      <Card>
        <CardHeader>
          <CardTitle>HTTP Method Distribution</CardTitle>
          <CardDescription>Overall HTTP method breakdown per model (attack POST rate shown in badges)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2 mb-4">
            {AGENTS.map((a) => (
              <Badge key={a} variant="outline" style={{ borderColor: MODEL_COLORS[a] }}>
                {AGENT_LABELS[a]} Attack POST: {((agg[a]?.method_bias?.attack_post_pct ?? 0) * 100).toFixed(1)}%
              </Badge>
            ))}
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={methodData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={DARK_GRID} />
              <XAxis dataKey="name" tick={DARK_TICK} />
              <YAxis tickFormatter={pctFormatter0} tick={DARK_TICK} />
              <RTooltip formatter={pctFormatter} contentStyle={DARK_TOOLTIP} />
              <Legend />
              <Bar dataKey="GET" stackId="a" fill="#60a5fa" />
              <Bar dataKey="POST" stackId="a" fill="#4ade80" />
              <Bar dataKey="PUT" stackId="a" fill="#fbbf24" />
              <Bar dataKey="DELETE" stackId="a" fill="#f87171" />
              <Bar dataKey="HEAD" stackId="a" fill="#9ca3af" />
              <Bar dataKey="Other" stackId="a" fill="#6b7280" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Self-Report Concordance table */}
      <Card>
        <CardHeader>
          <CardTitle>Self-Report Concordance</CardTitle>
          <CardDescription>
            How accurately each model&apos;s self-reported techniques match actual observed labels (structured conditions only)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {concordanceRecords.length === 0 ? (
            <p className="text-sm text-muted-foreground">No self-report data available.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Target</TableHead>
                  <TableHead>Agent</TableHead>
                  <TableHead>Concordance</TableHead>
                  <TableHead>Actual</TableHead>
                  <TableHead>Self-Reported</TableHead>
                  <TableHead>Overclaim</TableHead>
                  <TableHead>Underclaim</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {concordanceRecords.map((r) => {
                  const c = r.self_report_concordance!;
                  return (
                    <TableRow key={`${r.session_id}-${r.agent}`}>
                      <TableCell className="text-xs">{tLabel(r.target)}</TableCell>
                      <TableCell>
                        <span className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: MODEL_COLORS[r.agent] }} />
                          {AGENT_LABELS[r.agent]}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={c.concordance_rate > 0.5 ? "default" : "outline"}>
                          {(c.concordance_rate * 100).toFixed(1)}%
                        </Badge>
                      </TableCell>
                      <TableCell>{c.actual_attack_count}</TableCell>
                      <TableCell>{c.self_reported_count}</TableCell>
                      <TableCell className={c.overclaim > 10 ? "text-red-400 font-bold" : c.overclaim > 0 ? "text-red-500" : "text-muted-foreground"}>
                        {c.overclaim > 0 ? `+${c.overclaim}` : "0"}
                      </TableCell>
                      <TableCell className="text-amber-400">{c.underclaim > 0 ? `-${c.underclaim}` : "0"}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ===========================================================================
// Analysis Tab 4: Cross-Target Shift
// ===========================================================================
function CrossTargetContent({ data }: { data: AnalysisResults }) {
  const byTarget = data.aggregated_by_target;
  const cross = data.cross_target_shift;

  const targets = Object.keys(byTarget).sort();
  const pairKeys = Object.keys(cross).sort();

  function pairLabel(pairKey: string): string {
    const [t1, t2] = pairKey.split("_vs_");
    return `${tLabel(t1)} vs ${tLabel(t2)}`;
  }

  // JSD bar chart data
  const jsdData = pairKeys.map((pk) => {
    const entry: Record<string, unknown> = { name: pairLabel(pk) };
    for (const a of AGENTS) {
      entry[a] = cross[pk]?.[a]?.jsd ?? 0;
    }
    return entry;
  });

  // ASR by target
  const asrData = targets.map((t) => ({
    name: tLabel(t),
    ...Object.fromEntries(AGENTS.map((a) => [a, byTarget[t]?.[a]?.overall_asr ?? 0])),
  }));

  // Attack ratio by target
  const arData = targets.map((t) => ({
    name: tLabel(t),
    ...Object.fromEntries(AGENTS.map((a) => [a, byTarget[t]?.[a]?.overall_attack_ratio ?? 0])),
  }));

  return (
    <div className="space-y-6">
      {/* JSD summary cards + bar chart */}
      <Card>
        <CardHeader>
          <CardTitle>Technique Distribution Shift (JSD)</CardTitle>
          <CardDescription>Jensen-Shannon Divergence between target technique distributions per model</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            {pairKeys.map((pk) => (
              <div key={pk} className="p-4 rounded-lg bg-muted">
                <div className="text-sm font-medium text-muted-foreground mb-2">{pairLabel(pk)}</div>
                {AGENTS.filter((a) => cross[pk]?.[a]).map((a) => (
                  <div key={a} className="flex items-center justify-between mt-1">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full" style={{ backgroundColor: MODEL_COLORS[a] }} />
                      <span className="text-sm">{AGENT_LABELS[a]}</span>
                    </div>
                    <Badge variant="outline">{cross[pk][a].jsd.toFixed(4)}</Badge>
                  </div>
                ))}
              </div>
            ))}
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={jsdData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={DARK_GRID} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#a1a1aa" }} />
              <YAxis tick={DARK_TICK} domain={[0, "auto"]} />
              <RTooltip formatter={numFormatter4} contentStyle={DARK_TOOLTIP} />
              <Legend formatter={labelFormatter(AGENT_LABELS)} />
              <Bar dataKey="claude" fill={MODEL_COLORS.claude} radius={[4, 4, 0, 0]} />
              <Bar dataKey="codex" fill={MODEL_COLORS.codex} radius={[4, 4, 0, 0]} />
              <Bar dataKey="gemini" fill={MODEL_COLORS.gemini} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* ASR + AR side by side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>ASR by Target</CardTitle>
            <CardDescription>Attack success rate comparison between targets</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={asrData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={DARK_GRID} />
                <XAxis dataKey="name" tick={DARK_TICK} />
                <YAxis tickFormatter={pctFormatter0} tick={DARK_TICK} />
                <RTooltip formatter={pctFormatter} contentStyle={DARK_TOOLTIP} />
                <Legend formatter={labelFormatter(AGENT_LABELS)} />
                <Bar dataKey="claude" fill={MODEL_COLORS.claude} radius={[4, 4, 0, 0]} />
                <Bar dataKey="codex" fill={MODEL_COLORS.codex} radius={[4, 4, 0, 0]} />
                <Bar dataKey="gemini" fill={MODEL_COLORS.gemini} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Attack Ratio by Target</CardTitle>
            <CardDescription>Attack aggressiveness comparison between targets</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={arData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={DARK_GRID} />
                <XAxis dataKey="name" tick={DARK_TICK} />
                <YAxis tickFormatter={pctFormatter0} tick={DARK_TICK} />
                <RTooltip formatter={pctFormatter} contentStyle={DARK_TOOLTIP} />
                <Legend formatter={labelFormatter(AGENT_LABELS)} />
                <Bar dataKey="claude" fill={MODEL_COLORS.claude} radius={[4, 4, 0, 0]} />
                <Bar dataKey="codex" fill={MODEL_COLORS.codex} radius={[4, 4, 0, 0]} />
                <Bar dataKey="gemini" fill={MODEL_COLORS.gemini} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Per-target technique distribution heatmaps */}
      {targets.map((target) => {
        const targetTechs = new Set<string>();
        AGENTS.forEach((a) => {
          Object.entries(byTarget[target]?.[a]?.technique_distribution ?? {}).forEach(([tech, count]) => {
            if (count > 0) targetTechs.add(tech);
          });
        });
        const filteredTechs = [...targetTechs].sort();

        const heatmapValues: Record<string, Record<string, number>> = {};
        for (const a of AGENTS) {
          const dist = byTarget[target]?.[a]?.technique_distribution ?? {};
          const total = Object.values(dist).reduce((s, v) => s + v, 0);
          heatmapValues[a] = {};
          for (const t of filteredTechs) {
            heatmapValues[a][t] = total > 0 ? (dist[t] ?? 0) / total : 0;
          }
        }

        return (
          <Card key={target}>
            <CardHeader>
              <CardTitle>Technique Distribution: {tLabel(target)}</CardTitle>
              <CardDescription>{filteredTechs.length} techniques observed</CardDescription>
            </CardHeader>
            <CardContent>
              <Heatmap agents={[...AGENTS]} techniques={filteredTechs} values={heatmapValues} />
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// ===========================================================================
// Analysis Tab 5: Raw Data
// ===========================================================================
function RawDataContent({ data }: { data: AnalysisResults }) {
  const [sortKey, setSortKey] = useState<RawDataSortKey>("session_id");
  const [sortAsc, setSortAsc] = useState(true);
  const [filterAgent, setFilterAgent] = useState<string>("all");
  const [filterTarget, setFilterTarget] = useState<string>("all");

  const allTargets = useMemo(
    () => [...new Set(data.per_experiment.map((e) => e.target))].sort(),
    [data.per_experiment]
  );

  const filtered = useMemo(() => {
    let records = [...data.per_experiment];
    if (filterAgent !== "all") records = records.filter((r) => r.agent === filterAgent);
    if (filterTarget !== "all") records = records.filter((r) => r.target === filterTarget);

    records.sort((a, b) => {
      let av: unknown = a[sortKey];
      let bv: unknown = b[sortKey];
      if (sortKey === ("avg_latency" as RawDataSortKey)) {
        av = a.avg_latency?.all_requests_ms;
        bv = b.avg_latency?.all_requests_ms;
      }
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === "number" && typeof bv === "number") return sortAsc ? av - bv : bv - av;
      return sortAsc ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    });
    return records;
  }, [data.per_experiment, sortKey, sortAsc, filterAgent, filterTarget]);

  const toggleSort = (key: RawDataSortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(true); }
  };

  const sortIcon = (key: RawDataSortKey) => {
    if (sortKey !== key) return "";
    return sortAsc ? " \u2191" : " \u2193";
  };

  const handleDownload = () => {
    const blob = new Blob([JSON.stringify(data.per_experiment, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "per_experiment.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Raw Experiment Data</CardTitle>
          <CardDescription>All per-experiment metrics, sortable and filterable</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 mb-4 items-end">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Agent</label>
              <select
                className="border border-border rounded-md px-2 py-1 text-sm bg-background text-foreground"
                value={filterAgent}
                onChange={(e) => setFilterAgent(e.target.value)}
              >
                <option value="all">All</option>
                <option value="claude">Claude</option>
                <option value="codex">Codex</option>
                <option value="gemini">Gemini</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Target</label>
              <select
                className="border border-border rounded-md px-2 py-1 text-sm bg-background text-foreground"
                value={filterTarget}
                onChange={(e) => setFilterTarget(e.target.value)}
              >
                <option value="all">All</option>
                {allTargets.map((t) => (
                  <option key={t} value={t}>{tLabel(t)}</option>
                ))}
              </select>
            </div>
            <div className="flex items-end gap-2">
              <Badge variant="secondary">{filtered.length} records</Badge>
              <button
                onClick={handleDownload}
                className="px-3 py-1 text-xs rounded-md border border-border bg-muted hover:bg-accent text-foreground transition-colors"
              >
                Download JSON
              </button>
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("target")}>
                  Target{sortIcon("target")}
                </TableHead>
                <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("agent")}>
                  Agent{sortIcon("agent")}
                </TableHead>
                <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("condition")}>
                  Condition{sortIcon("condition")}
                </TableHead>
                <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("total_requests")}>
                  Requests{sortIcon("total_requests")}
                </TableHead>
                <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("attack_ratio")}>
                  AR{sortIcon("attack_ratio")}
                </TableHead>
                <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("overall_asr")}>
                  ASR{sortIcon("overall_asr")}
                </TableHead>
                <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("shannon_entropy")}>
                  Entropy{sortIcon("shannon_entropy")}
                </TableHead>
                <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("agent_cost_usd")}>
                  Cost{sortIcon("agent_cost_usd")}
                </TableHead>
                <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("persistence_score")}>
                  Persistence{sortIcon("persistence_score")}
                </TableHead>
                <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("exploration_rate")}>
                  Exploration{sortIcon("exploration_rate")}
                </TableHead>
                <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("inertia_rate")}>
                  Inertia{sortIcon("inertia_rate")}
                </TableHead>
                <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("hallucinated_attack_bias")}>
                  Halluc.{sortIcon("hallucinated_attack_bias")}
                </TableHead>
                <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("unique_endpoints")}>
                  Endpoints{sortIcon("unique_endpoints")}
                </TableHead>
                <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("avg_latency")}>
                  Latency{sortIcon("avg_latency")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => (
                <TableRow key={`${r.session_id}-${r.agent}`}>
                  <TableCell className="text-xs">{tLabel(r.target)}</TableCell>
                  <TableCell>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: MODEL_COLORS[r.agent] }} />
                      {AGENT_LABELS[r.agent]}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs">{r.condition.replace(/_/g, " / ").replace(/\b\w/g, c => c.toUpperCase())}</TableCell>
                  <TableCell>{r.total_requests}</TableCell>
                  <TableCell>{(r.attack_ratio * 100).toFixed(1)}%</TableCell>
                  <TableCell>{(r.overall_asr * 100).toFixed(1)}%</TableCell>
                  <TableCell>{r.shannon_entropy.toFixed(2)}</TableCell>
                  <TableCell>${r.agent_cost_usd.toFixed(2)}</TableCell>
                  <TableCell>{r.persistence_score.toFixed(2)}</TableCell>
                  <TableCell>{(r.exploration_rate * 100).toFixed(1)}%</TableCell>
                  <TableCell>{r.inertia_rate != null ? `${(r.inertia_rate * 100).toFixed(1)}%` : "N/A"}</TableCell>
                  <TableCell>{r.hallucinated_attack_bias != null ? `${(r.hallucinated_attack_bias * 100).toFixed(1)}%` : "N/A"}</TableCell>
                  <TableCell>{r.unique_endpoints}</TableCell>
                  <TableCell>{r.avg_latency?.all_requests_ms != null ? `${r.avg_latency.all_requests_ms.toFixed(0)}ms` : "N/A"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default function HomePage() {
  const [data, setData] = useState<AnalysisResults | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadAnalysisData()
      .then(setData)
      .catch((e) => setError(String(e)));
  }, []);

  // Compute hero stats from data (or show placeholder)
  const totalAttacks = data
    ? Object.values(data.aggregated_by_agent).reduce(
        (s, a) => s + (a.total_attack_requests ?? 0),
        0
      )
    : null;

  const totalSuccess = data
    ? Object.values(data.aggregated_by_agent).reduce(
        (s, a) => s + (a.total_successful_attacks ?? 0),
        0
      )
    : null;

  const chiSqP = data?.statistical_tests?.chi_squared?.p_value ?? null;


  return (
    <div className="flex flex-col min-h-0">
      {/* -- Section A: Hero ------------------------------------------------- */}
      <section className="bg-grid relative overflow-hidden border-b border-border py-20 px-4">
        {/* radial glow */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-[500px] w-[700px] rounded-full bg-primary/5 blur-[120px]" />
        </div>

        <div className="relative mx-auto max-w-5xl text-center space-y-6">
          {/* Title */}
          <div className="space-y-3">
            <h1 className="text-gradient text-5xl sm:text-6xl font-black tracking-tight leading-none">
              CyBiasBench
            </h1>
            <p className="text-muted-foreground text-lg sm:text-xl max-w-2xl mx-auto leading-relaxed">
              Benchmarking Bias in LLM Agents for Cyber-Attack Scenarios
            </p>
          </div>

          {/* Experiment summary */}
          <p className="font-mono text-xs text-muted-foreground tracking-widest uppercase">
            3 LLM agents &times; 3 targets &times; 4 conditions &times; 3 runs = 108 experiments
          </p>

          {/* Category winners */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 max-w-3xl mx-auto">
            {error ? (
              <p className="col-span-full text-destructive text-sm font-mono">{error}</p>
            ) : data == null ? (
              <>
                {[0, 1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-[72px] rounded-xl" />
                ))}
              </>
            ) : (
              (() => {
                const agents = AGENTS.filter((a) => data.aggregated_by_agent[a]);
                const bestAsr = agents.reduce((best, a) =>
                  (data.aggregated_by_agent[a]?.overall_asr ?? 0) > (data.aggregated_by_agent[best]?.overall_asr ?? 0) ? a : best
                , agents[0]);
                const bestCost = agents.filter((a) => data.aggregated_by_agent[a]?.cost_per_success != null)
                  .reduce((best, a) =>
                    (data.aggregated_by_agent[a]!.cost_per_success!) < (data.aggregated_by_agent[best]?.cost_per_success ?? Infinity) ? a : best
                  , agents[0]);
                const bestEntropy = agents.reduce((best, a) =>
                  (data.aggregated_by_agent[a]?.shannon_entropy ?? 0) > (data.aggregated_by_agent[best]?.shannon_entropy ?? 0) ? a : best
                , agents[0]);
                const bestChallenges = agents.reduce((best, a) =>
                  (data.aggregated_by_agent[a]?.total_solved_challenges ?? 0) > (data.aggregated_by_agent[best]?.total_solved_challenges ?? 0) ? a : best
                , agents[0]);
                const winners: { label: string; agent: string; value: string }[] = [
                  { label: "Highest ASR", agent: bestAsr, value: fmtPct(data.aggregated_by_agent[bestAsr]?.overall_asr) },
                  { label: "Most Cost-Efficient", agent: bestCost, value: fmtDollar(data.aggregated_by_agent[bestCost]?.cost_per_success) + "/hit" },
                  { label: "Most Diverse", agent: bestEntropy, value: `H=${fmt(data.aggregated_by_agent[bestEntropy]?.shannon_entropy, 2)}` },
                  { label: "Most Challenges", agent: bestChallenges, value: `${data.aggregated_by_agent[bestChallenges]?.total_solved_challenges ?? 0} solved` },
                ];
                return winners.map((w) => (
                  <div key={w.label} className="glow-cyber flex flex-col items-center gap-1 rounded-xl border border-border bg-card px-4 py-3">
                    <span className="text-[10px] text-muted-foreground uppercase tracking-widest">{w.label}</span>
                    <span className="font-mono text-sm font-bold" style={{ color: MODEL_COLORS[w.agent] ?? "#71717a" }}>
                      {AGENT_LABELS[w.agent] ?? w.agent} — {w.value}
                    </span>
                  </div>
                ));
              })()
            )}
          </div>

          {/* Compact stats */}
          {data != null && (
            <p className="font-mono text-xs text-muted-foreground">
              {fmtInt(totalAttacks)} attacks classified · {fmtInt(totalSuccess)} succeeded · &chi;&sup2; p &lt; 0.001
            </p>
          )}

          {/* CTA */}
          <div className="flex items-center justify-center gap-4 pt-2">
            <a
              href="https://github.com/taeng0204/llm-cyber-attack-bias"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl border border-border px-5 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground hover:border-foreground/30"
            >
              GitHub
            </a>
          </div>
        </div>
      </section>

      <div className="mx-auto w-full max-w-6xl px-4 py-14 space-y-16">
        {/* -- Section B: Agent Profile Cards -------------------------------- */}
        <section className="space-y-5">
          <div className="space-y-1">
            <h2 className="text-2xl font-bold text-foreground">Agent Profiles</h2>
            <p className="text-muted-foreground text-sm">
              Aggregated performance across all targets and conditions
            </p>
          </div>

          {data == null ? (
            <div className="flex gap-4">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="flex-1 h-52 rounded-xl" />
              ))}
            </div>
          ) : (
            <div className="flex flex-wrap gap-4">
              {AGENTS.map((agent) => {
                const agg = data.aggregated_by_agent[agent];
                if (!agg) return null;
                return <AgentCard key={agent} agent={agent} data={agg} />;
              })}
            </div>
          )}
        </section>

        {/* -- Section C: Leaderboard ---------------------------------------- */}
        <section className="space-y-5">
          <div className="space-y-1">
            <h2 className="text-2xl font-bold text-foreground">Leaderboard</h2>
            <p className="text-muted-foreground text-sm">
              Click column headers to sort. Toggle dimensions for different views.
            </p>
          </div>

          {data == null ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-64 rounded-lg" />
              <Skeleton className="h-64 rounded-xl" />
            </div>
          ) : (
            <Leaderboard data={data} />
          )}
        </section>

        {/* -- Section D: Technique Distribution Preview ---------------------- */}
        <section className="space-y-5">
          <div className="space-y-1">
            <h2 className="text-2xl font-bold text-foreground">Technique Distribution</h2>
            <p className="text-muted-foreground text-sm">
              Proportion of each attack technique per agent (top 12 techniques by total volume)
            </p>
          </div>

          <InView>
            <Card>
              <CardContent className="pt-2 pb-2">
                {data == null ? (
                  <Skeleton className="h-64 rounded-lg" />
                ) : (
                  <TechniqueHeatmapSection data={data} />
                )}
              </CardContent>
            </Card>
          </InView>
        </section>

        {/* -- Statistical Significance callout ------------------------------- */}
        {data != null && (
          <section>
            <div className="rounded-xl border border-border bg-card px-6 py-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="flex-1 space-y-1">
                <p className="font-semibold text-foreground text-sm">Statistical Significance</p>
                <p className="text-muted-foreground text-xs leading-relaxed">
                  Chi-squared test across all agents &amp; techniques:{" "}
                  <span className="font-mono text-foreground">
                    &chi;&sup2;({data.statistical_tests.chi_squared.dof}) ={" "}
                    {fmt(data.statistical_tests.chi_squared.chi2, 2)}
                  </span>
                  ,{" "}
                  <span
                    className={[
                      "font-mono",
                      data.statistical_tests.chi_squared.significant_005
                        ? "text-emerald-400"
                        : "text-muted-foreground",
                    ].join(" ")}
                  >
                    p ={" "}
                    {data.statistical_tests.chi_squared.p_value < 0.001
                      ? "< 0.001"
                      : fmt(data.statistical_tests.chi_squared.p_value, 4)}
                  </span>
                  .{" "}
                  {data.statistical_tests.chi_squared.significant_005 ? (
                    <span className="text-emerald-400">
                      Technique preferences differ significantly (p &lt; 0.05).
                    </span>
                  ) : (
                    <span className="text-muted-foreground">
                      No significant difference detected (p &ge; 0.05).
                    </span>
                  )}
                </p>
              </div>
            </div>
          </section>
        )}

        {/* -- Section E: Technique Bias ─────────────────────────────────────── */}
        {data != null && (
          <section id="technique-bias" className="space-y-5">
            <div className="space-y-1">
              <h2 className="text-2xl font-bold text-foreground">Technique Bias</h2>
              <p className="text-muted-foreground text-sm">
                Distribution divergence, concentration metrics, and statistical tests across agents.
              </p>
            </div>
            <InView>
              <TechniqueBiasContent data={data} />
            </InView>
          </section>
        )}

        {/* -- Section F: Attack Success ──────────────────────────────────────── */}
        {data != null && (
          <section id="attack-success" className="space-y-5">
            <div className="space-y-1">
              <h2 className="text-2xl font-bold text-foreground">Attack Success</h2>
              <p className="text-muted-foreground text-sm">
                Per-target and per-technique success rates, cost efficiency, and challenge results.
              </p>
            </div>
            <InView>
              <AttackSuccessContent data={data} />
            </InView>
          </section>
        )}

        {/* -- Section G: Behavioral Patterns ─────────────────────────────────── */}
        {data != null && (
          <section id="behavioral" className="space-y-5">
            <div className="space-y-1">
              <h2 className="text-2xl font-bold text-foreground">Behavioral Patterns</h2>
              <p className="text-muted-foreground text-sm">
                Persistence, exploration, inertia, HTTP method bias, and self-report concordance.
              </p>
            </div>
            <InView>
              <BehavioralContent data={data} />
            </InView>
          </section>
        )}

        {/* -- Section H: Cross-Target Shift ──────────────────────────────────── */}
        {data != null && (
          <section id="cross-target" className="space-y-5">
            <div className="space-y-1">
              <h2 className="text-2xl font-bold text-foreground">Cross-Target Shift</h2>
              <p className="text-muted-foreground text-sm">
                How agent behavior changes across different target applications.
              </p>
            </div>
            <InView>
              <CrossTargetContent data={data} />
            </InView>
          </section>
        )}

        {/* -- Data Access ─────────────────────────────────────────────────── */}
        {data != null && (
          <section className="space-y-4">
            <div className="space-y-1">
              <h2 className="text-2xl font-bold text-foreground">Data Access</h2>
              <p className="text-muted-foreground text-sm">
                Download the full analysis results for your own research.
              </p>
            </div>
            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-wrap gap-3">
                  <a
                    href={`${process.env.NODE_ENV === "production" ? "/CyBiasBench" : ""}/data/analysis_results.json`}
                    download="analysis_results.json"
                    className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    Analysis Results (JSON)
                  </a>
                  <button
                    onClick={() => {
                      const blob = new Blob([JSON.stringify(data.per_experiment, null, 2)], { type: "application/json" });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = "per_experiment.json";
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                    className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    Per-Experiment Data (JSON)
                  </button>
                </div>
                <p className="text-xs text-muted-foreground mt-3">
                  108 experiments · 3 agents · 3 targets · 4 conditions · 3 runs ·{" "}
                  <a href="https://github.com/taeng0204/llm-cyber-attack-bias" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                    View on GitHub
                  </a>
                </p>
              </CardContent>
            </Card>
          </section>
        )}

      </div>
    </div>
  );
}
