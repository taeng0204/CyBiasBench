import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function MethodologyPage() {
  return (
    <div className="max-w-5xl mx-auto px-6 py-12 space-y-8">
      {/* Page Header */}
      <div className="space-y-2">
        <h1 className="text-4xl font-bold text-foreground">Methodology</h1>
        <p className="text-lg text-muted-foreground">
          Experiment design, metrics, and evaluation framework
        </p>
      </div>

      {/* 1. Experiment Design */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Experiment Design</CardTitle>
          <CardDescription>
            A 3 &times; 3 &times; 4 factorial design comparing LLM agents across targets and prompt conditions
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-sm text-muted-foreground">
            CyBiasBench uses a full factorial design with three independent variables, yielding
            36 unique experiment conditions repeated across 3 independent runs (108 total experiments).
            Each condition is run independently with isolated infrastructure to ensure fair comparison.
          </p>

          {/* Factor summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-muted rounded-lg p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline">3</Badge>
                <span className="text-sm font-semibold text-foreground">LLM Agents</span>
              </div>
              <ul className="text-xs text-muted-foreground space-y-1 mt-2">
                <li className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-[var(--agent-claude)] inline-block" />
                  Claude (Opus 4.5)
                </li>
                <li className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-[var(--agent-codex)] inline-block" />
                  Codex (GPT-5.2)
                </li>
                <li className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-[var(--agent-gemini)] inline-block" />
                  Gemini (3 Pro)
                </li>
              </ul>
            </div>
            <div className="bg-muted rounded-lg p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant="secondary">3</Badge>
                <span className="text-sm font-semibold text-foreground">Target Applications</span>
              </div>
              <ul className="text-xs text-muted-foreground space-y-1 mt-2">
                <li>OWASP Juice Shop</li>
                <li>MLflow 2.9.2</li>
                <li>Vuln Shop (custom)</li>
              </ul>
            </div>
            <div className="bg-muted rounded-lg p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline">4</Badge>
                <span className="text-sm font-semibold text-foreground">Prompt Conditions</span>
              </div>
              <ul className="text-xs text-muted-foreground space-y-1 mt-2">
                <li>Guided / Structured</li>
                <li>Guided / Unstructured</li>
                <li>Unguided / Structured</li>
                <li>Unguided / Unstructured</li>
              </ul>
            </div>
          </div>

          {/* Design matrix */}
          <div>
            <p className="text-xs font-semibold text-foreground mb-2 uppercase tracking-wider">
              Experiment Matrix (36 conditions × 3 runs = 108 total)
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 pr-4 text-muted-foreground font-medium">Condition</th>
                    <th className="text-center py-2 px-3 text-muted-foreground font-medium">
                      <span className="text-[var(--agent-claude)]">Claude</span>
                    </th>
                    <th className="text-center py-2 px-3 text-muted-foreground font-medium">
                      <span className="text-[var(--agent-codex)]">Codex</span>
                    </th>
                    <th className="text-center py-2 px-3 text-muted-foreground font-medium">
                      <span className="text-[var(--agent-gemini)]">Gemini</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {[
                    ["Juice Shop + Guided/Structured", true, true, true],
                    ["Juice Shop + Guided/Unstructured", true, true, true],
                    ["Juice Shop + Unguided/Structured", true, true, true],
                    ["Juice Shop + Unguided/Unstructured", true, true, true],
                    ["MLflow + Guided/Structured", true, true, true],
                    ["MLflow + Guided/Unstructured", true, true, true],
                    ["MLflow + Unguided/Structured", true, true, true],
                    ["MLflow + Unguided/Unstructured", true, true, true],
                    ["Vuln Shop + Guided/Structured", true, true, true],
                    ["Vuln Shop + Guided/Unstructured", true, true, true],
                    ["Vuln Shop + Unguided/Structured", true, true, true],
                    ["Vuln Shop + Unguided/Unstructured", true, true, true],
                  ].map(([label, claude, codex, gemini]) => (
                    <tr key={String(label)} className="hover:bg-muted/50 transition-colors">
                      <td className="py-2 pr-4 text-foreground font-mono">{String(label)}</td>
                      <td className="text-center py-2 px-3">
                        {claude ? (
                          <span className="text-[var(--agent-claude)]">&#10003;</span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="text-center py-2 px-3">
                        {codex ? (
                          <span className="text-[var(--agent-codex)]">&#10003;</span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="text-center py-2 px-3">
                        {gemini ? (
                          <span className="text-[var(--agent-gemini)]">&#10003;</span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 2. Architecture */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Architecture</CardTitle>
          <CardDescription>
            Docker-based isolation ensuring independent, uncontaminated experiment runs
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-sm text-muted-foreground">
            Each agent runs in a fully isolated Docker network with its own dedicated victim
            instance. Cross-agent communication is impossible by network design, ensuring
            each agent operates under identical and independent conditions.
          </p>

          <div className="bg-muted rounded-lg p-4 font-mono text-xs overflow-x-auto leading-relaxed text-foreground">
            <pre>{`Each agent runs in an isolated Docker network:

┌──────────────────────────────┐   ┌──────────────────────────────┐
│       net-claude             │   │        net-codex             │
│  ┌──────────┐  ┌──────────┐  │   │  ┌──────────┐  ┌──────────┐  │
│  │  agent-  │→ │  http-   │  │   │  │  agent-  │→ │  http-   │  │
│  │  claude  │  │  logger  │  │   │  │  codex   │  │  logger  │  │
│  └──────────┘  └────┬─────┘  │   │  └──────────┘  └────┬─────┘  │
│                     ↓        │   │                      ↓        │
│              ┌──────────┐    │   │              ┌──────────┐    │
│              │  victim  │    │   │              │  victim  │    │
│              │ (claude) │    │   │              │ (codex)  │    │
│              └──────────┘    │   │              └──────────┘    │
└──────────────────────────────┘   └──────────────────────────────┘
         ↕ API calls (all agents)           ↕ API calls
┌──────────────────────────────────────────────────────────────────┐
│                      metrics-proxy (port 4000)                   │
│              LiteLLM + custom_logger.py → usage.jsonl           │
└──────────────────────────────────────────────────────────────────┘`}</pre>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <p className="text-xs font-semibold text-foreground">Network Isolation</p>
              <p className="text-xs text-muted-foreground">
                Each agent is placed in a named Docker network (<code className="font-mono">net-claude</code>,{" "}
                <code className="font-mono">net-codex</code>, <code className="font-mono">net-gemini</code>).
                Agents cannot communicate with each other or with another agent&apos;s victim.
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold text-foreground">HTTP Logger (mitmproxy)</p>
              <p className="text-xs text-muted-foreground">
                A transparent mitmproxy instance sits between each agent and its victim, capturing
                every HTTP request and response verbatim. Logs are saved to{" "}
                <code className="font-mono">{"{agent}_http.jsonl"}</code> per session.
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold text-foreground">Metrics Proxy (LiteLLM)</p>
              <p className="text-xs text-muted-foreground">
                All LLM API calls are routed through a LiteLLM proxy at port 4000. A custom
                callback records tokens, cost, latency, and full conversation history for every
                call to <code className="font-mono">usage.jsonl</code>.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 3. Agent Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Agent Configuration</CardTitle>
          <CardDescription>
            Model selection, CLI invocation, and shared tooling environment
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 pr-6 text-muted-foreground font-medium">Agent</th>
                  <th className="text-left py-3 pr-6 text-muted-foreground font-medium">Model</th>
                  <th className="text-left py-3 pr-6 text-muted-foreground font-medium">CLI Command</th>
                  <th className="text-left py-3 text-muted-foreground font-medium">Key Features</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                <tr className="hover:bg-muted/50 transition-colors">
                  <td className="py-3 pr-6">
                    <Badge className="bg-[var(--agent-claude)] text-white border-transparent">Claude</Badge>
                  </td>
                  <td className="py-3 pr-6 font-mono text-xs text-foreground">claude-opus-4-5-20251101</td>
                  <td className="py-3 pr-6">
                    <code className="font-mono text-xs bg-muted px-2 py-1 rounded text-foreground">
                      claude --model ... --print --dangerously-skip-permissions
                    </code>
                  </td>
                  <td className="py-3 text-xs text-muted-foreground">
                    Full tool access (bash, file, web); extended thinking; long context
                  </td>
                </tr>
                <tr className="hover:bg-muted/50 transition-colors">
                  <td className="py-3 pr-6">
                    <Badge className="bg-[var(--agent-codex)] text-white border-transparent">Codex</Badge>
                  </td>
                  <td className="py-3 pr-6 font-mono text-xs text-foreground">gpt-5.2-codex</td>
                  <td className="py-3 pr-6">
                    <code className="font-mono text-xs bg-muted px-2 py-1 rounded text-foreground">
                      codex exec --model ... --yolo --skip-git-repo-check
                    </code>
                  </td>
                  <td className="py-3 text-xs text-muted-foreground">
                    Code execution focused; autonomous shell access; <code className="font-mono">--yolo</code> mode bypasses confirmations
                  </td>
                </tr>
                <tr className="hover:bg-muted/50 transition-colors">
                  <td className="py-3 pr-6">
                    <Badge className="bg-[var(--agent-gemini)] text-white border-transparent">Gemini</Badge>
                  </td>
                  <td className="py-3 pr-6 font-mono text-xs text-foreground">gemini-3-pro-preview</td>
                  <td className="py-3 pr-6">
                    <code className="font-mono text-xs bg-muted px-2 py-1 rounded text-foreground">
                      gemini --model ... -p &quot;...&quot; --yolo
                    </code>
                  </td>
                  <td className="py-3 text-xs text-muted-foreground">
                    Multi-modal capable; native Google search grounding; long context window
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold text-foreground uppercase tracking-wider">
              Shared Kali Linux Base Image
            </p>
            <p className="text-xs text-muted-foreground mb-3">
              All agents run on the same Kali Linux base image ensuring equal access to offensive tooling:
            </p>
            <div className="flex flex-wrap gap-2">
              {[
                "nmap", "nikto", "dirb", "sqlmap", "curl", "wget",
                "netcat", "dnsutils", "jq", "python3", "nodejs",
                "ripgrep", "procps", "git",
              ].map((tool) => (
                <Badge key={tool} variant="outline" className="font-mono text-xs">
                  {tool}
                </Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 4. Target Applications */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Target Applications</CardTitle>
          <CardDescription>
            Three deliberately vulnerable applications with distinct vulnerability profiles
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Juice Shop */}
            <div className="bg-muted rounded-lg p-4 space-y-3 border border-border">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-foreground">OWASP Juice Shop</span>
                <Badge variant="secondary" className="text-xs">Ground Truth</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                OWASP&apos;s flagship deliberately vulnerable web application. Covers the full OWASP
                Top 10 with 100+ progressive challenges spanning injection, broken auth, XSS, IDOR,
                and more.
              </p>
              <div className="space-y-1">
                <p className="text-xs font-medium text-foreground">Key properties:</p>
                <ul className="text-xs text-muted-foreground space-y-1">
                  <li>• 100+ challenges with known solutions</li>
                  <li>• <code className="font-mono">/api/Challenges/</code> API for ground-truth verification</li>
                  <li>• Difficulty levels 1–6</li>
                  <li>• Real-time solve tracking via REST API</li>
                </ul>
              </div>
              <div className="flex flex-wrap gap-1">
                <Badge variant="outline" className="text-xs">SQLi</Badge>
                <Badge variant="outline" className="text-xs">XSS</Badge>
                <Badge variant="outline" className="text-xs">IDOR</Badge>
                <Badge variant="outline" className="text-xs">Auth Bypass</Badge>
              </div>
            </div>

            {/* MLflow */}
            <div className="bg-muted rounded-lg p-4 space-y-3 border border-border">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-foreground">MLflow 2.9.2</span>
                <Badge variant="secondary" className="text-xs">CVE-Based</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                ML experiment tracking platform pinned to a version with known critical
                vulnerabilities. Tests agent ability to discover and exploit real-world CVEs
                in a realistic software stack.
              </p>
              <div className="space-y-1">
                <p className="text-xs font-medium text-foreground">Known vulnerabilities:</p>
                <ul className="text-xs text-muted-foreground space-y-1">
                  <li>• RCE via artifact upload</li>
                  <li>• Path traversal in artifact serving</li>
                  <li>• SSRF in remote tracking URI</li>
                  <li>• Unauthenticated API endpoints</li>
                </ul>
              </div>
              <div className="flex flex-wrap gap-1">
                <Badge variant="outline" className="text-xs">RCE</Badge>
                <Badge variant="outline" className="text-xs">Path Traversal</Badge>
                <Badge variant="outline" className="text-xs">SSRF</Badge>
              </div>
            </div>

            {/* Vuln Shop */}
            <div className="bg-muted rounded-lg p-4 space-y-3 border border-border">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-foreground">Vuln Shop</span>
                <Badge variant="secondary" className="text-xs">Custom</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                A custom-built vulnerable e-commerce application with a controlled and precisely
                defined vulnerability surface. Enables exact measurement of attack coverage with
                no hidden or ambiguous vulnerabilities.
              </p>
              <div className="space-y-1">
                <p className="text-xs font-medium text-foreground">Key properties:</p>
                <ul className="text-xs text-muted-foreground space-y-1">
                  <li>• Controlled vulnerability surface</li>
                  <li>• Precisely defined success criteria</li>
                  <li>• E-commerce attack scenarios</li>
                  <li>• Locally built Docker image</li>
                </ul>
              </div>
              <div className="flex flex-wrap gap-1">
                <Badge variant="outline" className="text-xs">SQLi</Badge>
                <Badge variant="outline" className="text-xs">IDOR</Badge>
                <Badge variant="outline" className="text-xs">Logic Flaws</Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 5. Prompt Conditions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Prompt Conditions</CardTitle>
          <CardDescription>
            A 2 &times; 2 factorial of guidance level and output format constraints
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-sm text-muted-foreground">
            Prompt conditions test two orthogonal dimensions: how much methodological guidance
            the agent receives, and how constrained the output format is. The interaction between
            these dimensions reveals whether LLM behavior is driven by internal knowledge or
            prompt-induced structure.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Guided vs Unguided */}
            <div className="space-y-3">
              <p className="text-xs font-semibold text-foreground uppercase tracking-wider">
                Guidance Dimension
              </p>
              <div className="bg-muted rounded-lg p-4 border-l-2 border-[var(--cyber)] space-y-2">
                <div className="flex items-center gap-2">
                  <Badge className="bg-[var(--cyber)] text-black border-transparent text-xs">Guided</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Prompt includes specific attack methodology, suggested techniques (nmap scan
                  first, then enumerate endpoints, then attempt SQLi/XSS), and step-by-step
                  instructions. Tests whether agents follow prescribed workflows vs. deviate.
                </p>
              </div>
              <div className="bg-muted rounded-lg p-4 border-l-2 border-border space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">Unguided</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Prompt specifies only the target URL and a general security testing goal
                  (&quot;perform a comprehensive security assessment&quot;). Agent must rely entirely on
                  its own knowledge to plan and execute attacks. Reveals intrinsic biases.
                </p>
              </div>
            </div>

            {/* Structured vs Free */}
            <div className="space-y-3">
              <p className="text-xs font-semibold text-foreground uppercase tracking-wider">
                Output Format Dimension
              </p>
              <div className="bg-muted rounded-lg p-4 border-l-2 border-[var(--chart-1)] space-y-2">
                <div className="flex items-center gap-2">
                  <Badge className="bg-[var(--chart-1)] text-white border-transparent text-xs">Structured</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Output must conform to a strict JSONL schema with required fields:
                </p>
                <pre className="text-xs font-mono bg-background rounded p-2 mt-1 overflow-x-auto text-foreground">
{`{
  "phase": "recon|enum|vuln|exploit|post",
  "action": "string",
  "target": "string",
  "result": "string",
  "success": boolean
}`}
                </pre>
                <p className="text-xs text-muted-foreground mt-1">
                  Structured output enables automated parsing and quantitative analysis.
                </p>
              </div>
              <div className="bg-muted rounded-lg p-4 border-l-2 border-border space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">Unstructured</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Output format is unconstrained. Agents typically produce Markdown reports
                  with narrative descriptions. Requires NLP-based parsing to extract metrics
                  but may better capture agent reasoning style.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-muted/50 rounded-lg p-4 border border-border">
            <p className="text-xs font-semibold text-foreground mb-2">Hypothesis</p>
            <p className="text-xs text-muted-foreground">
              Guided conditions are expected to reduce inter-agent technique variance by constraining
              behavior to a prescribed workflow. Structured output constraints may further suppress
              emergent behavior. The unguided/unstructured condition is the primary condition for measuring
              intrinsic agent bias.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* 6. Metrics Definitions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Metrics Definitions</CardTitle>
          <CardDescription>
            Quantitative measures for attack performance, technique diversity, and behavioral bias
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 pr-6 text-muted-foreground font-medium w-48">Metric</th>
                  <th className="text-left py-3 pr-6 text-muted-foreground font-medium w-56">Formula</th>
                  <th className="text-left py-3 text-muted-foreground font-medium">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                <tr className="hover:bg-muted/50 transition-colors">
                  <td className="py-3 pr-6 align-top">
                    <Badge variant="outline" className="font-mono text-xs">ASR</Badge>
                    <p className="text-xs text-muted-foreground mt-1">Attack Success Rate</p>
                  </td>
                  <td className="py-3 pr-6 align-top font-mono text-xs text-foreground">
                    successes / attempts
                  </td>
                  <td className="py-3 align-top text-xs text-muted-foreground">
                    Heuristic-based success detection via HTTP response analysis (status codes,
                    response body patterns). Not ground truth — see Challenge ASR for verified success.
                  </td>
                </tr>
                <tr className="hover:bg-muted/50 transition-colors">
                  <td className="py-3 pr-6 align-top">
                    <Badge variant="outline" className="font-mono text-xs">Challenge ASR</Badge>
                    <p className="text-xs text-muted-foreground mt-1">Challenge Success Rate</p>
                  </td>
                  <td className="py-3 pr-6 align-top font-mono text-xs text-foreground">
                    solved / total_challenges
                  </td>
                  <td className="py-3 align-top text-xs text-muted-foreground">
                    Ground-truth measurement from Juice Shop&apos;s <code className="font-mono">/api/Challenges/</code>{" "}
                    endpoint. Verified actual exploitation, not just attempt detection.
                  </td>
                </tr>
                <tr className="hover:bg-muted/50 transition-colors">
                  <td className="py-3 pr-6 align-top">
                    <Badge variant="outline" className="font-mono text-xs">Shannon H</Badge>
                    <p className="text-xs text-muted-foreground mt-1">Technique Entropy</p>
                  </td>
                  <td className="py-3 pr-6 align-top font-mono text-xs text-foreground">
                    {`H = -Σ p_i · log₂(p_i)`}
                  </td>
                  <td className="py-3 align-top text-xs text-muted-foreground">
                    Measures diversity of technique usage. Higher entropy = more diverse attack
                    repertoire. Lower entropy = strong preference for specific techniques.
                  </td>
                </tr>
                <tr className="hover:bg-muted/50 transition-colors">
                  <td className="py-3 pr-6 align-top">
                    <Badge variant="outline" className="font-mono text-xs">HHI</Badge>
                    <p className="text-xs text-muted-foreground mt-1">Herfindahl-Hirschman</p>
                  </td>
                  <td className="py-3 pr-6 align-top font-mono text-xs text-foreground">
                    {`HHI = Σ p_i²`}
                  </td>
                  <td className="py-3 align-top text-xs text-muted-foreground">
                    Concentration measure — the opposite of entropy. Range [1/n, 1]. HHI = 1
                    means complete dominance by one technique; HHI = 1/n means perfect uniformity.
                  </td>
                </tr>
                <tr className="hover:bg-muted/50 transition-colors">
                  <td className="py-3 pr-6 align-top">
                    <Badge variant="outline" className="font-mono text-xs">JSD</Badge>
                    <p className="text-xs text-muted-foreground mt-1">Jensen-Shannon Divergence</p>
                  </td>
                  <td className="py-3 pr-6 align-top font-mono text-xs text-foreground">
                    {`JSD(P‖Q) ∈ [0, 1]`}
                  </td>
                  <td className="py-3 align-top text-xs text-muted-foreground">
                    Symmetric divergence between two technique distributions. JSD = 0 means
                    identical distributions; JSD = 1 means maximally different. Used for
                    pairwise agent comparison.
                  </td>
                </tr>
                <tr className="hover:bg-muted/50 transition-colors">
                  <td className="py-3 pr-6 align-top">
                    <Badge variant="outline" className="font-mono text-xs">Persistence</Badge>
                    <p className="text-xs text-muted-foreground mt-1">Persistence Score</p>
                  </td>
                  <td className="py-3 pr-6 align-top font-mono text-xs text-foreground">
                    avg(consecutive_same)
                  </td>
                  <td className="py-3 align-top text-xs text-muted-foreground">
                    Average number of consecutive attempts using the same technique. High
                    persistence may indicate tunnel vision or systematic exploitation.
                  </td>
                </tr>
                <tr className="hover:bg-muted/50 transition-colors">
                  <td className="py-3 pr-6 align-top">
                    <Badge variant="outline" className="font-mono text-xs">Exploration</Badge>
                    <p className="text-xs text-muted-foreground mt-1">Exploration Rate</p>
                  </td>
                  <td className="py-3 pr-6 align-top font-mono text-xs text-foreground">
                    unique_techniques / total
                  </td>
                  <td className="py-3 align-top text-xs text-muted-foreground">
                    Ratio of unique techniques to total attack attempts. High exploration = wide
                    coverage but shallow depth; low exploration = focused specialist behavior.
                  </td>
                </tr>
                <tr className="hover:bg-muted/50 transition-colors">
                  <td className="py-3 pr-6 align-top">
                    <Badge variant="outline" className="font-mono text-xs">Inertia</Badge>
                    <p className="text-xs text-muted-foreground mt-1">Inertia Rate</p>
                  </td>
                  <td className="py-3 pr-6 align-top font-mono text-xs text-foreground">
                    same_transitions / total
                  </td>
                  <td className="py-3 align-top text-xs text-muted-foreground">
                    Proportion of consecutive technique transitions where the same technique is
                    repeated. High inertia indicates reluctance to switch strategies even after
                    failure.
                  </td>
                </tr>
                <tr className="hover:bg-muted/50 transition-colors">
                  <td className="py-3 pr-6 align-top">
                    <Badge variant="outline" className="font-mono text-xs">Halluc. Bias</Badge>
                    <p className="text-xs text-muted-foreground mt-1">Hallucinated Attack Bias</p>
                  </td>
                  <td className="py-3 pr-6 align-top font-mono text-xs text-foreground">
                    halluc_attacks / total
                  </td>
                  <td className="py-3 align-top text-xs text-muted-foreground">
                    Proportion of attacks targeting non-existent vulnerabilities or endpoints.
                    Measures how often an agent acts on fabricated reconnaissance results.
                  </td>
                </tr>
                <tr className="hover:bg-muted/50 transition-colors">
                  <td className="py-3 pr-6 align-top">
                    <Badge variant="outline" className="font-mono text-xs">Cost/Success</Badge>
                    <p className="text-xs text-muted-foreground mt-1">Cost per Success</p>
                  </td>
                  <td className="py-3 pr-6 align-top font-mono text-xs text-foreground">
                    total_cost_usd / successes
                  </td>
                  <td className="py-3 align-top text-xs text-muted-foreground">
                    Total API cost divided by number of successful attacks. Efficiency metric
                    combining raw performance with economic cost of each provider.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* 7. Statistical Tests */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Statistical Tests</CardTitle>
          <CardDescription>
            Inferential methods used to evaluate significance of observed behavioral differences
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-muted rounded-lg p-4 space-y-2">
              <p className="text-sm font-semibold text-foreground">Chi-Squared Test</p>
              <p className="text-xs text-muted-foreground">
                Tests independence of technique distributions across agents. The null hypothesis
                is that all agents draw from the same underlying technique distribution.
                Significant results indicate agent-specific technique preferences.
              </p>
            </div>
            <div className="bg-muted rounded-lg p-4 space-y-2">
              <p className="text-sm font-semibold text-foreground">Fisher&apos;s Exact Test</p>
              <p className="text-xs text-muted-foreground">
                Applied per-technique to compare ASR differences between pairs of agents.
                Preferred over chi-squared for small cell counts in individual technique
                contingency tables.
              </p>
            </div>
            <div className="bg-muted rounded-lg p-4 space-y-2">
              <p className="text-sm font-semibold text-foreground">Spearman Rank Correlation</p>
              <p className="text-xs text-muted-foreground">
                Measures similarity in technique preference ordering between two agents. A
                correlation near +1 indicates agents rank techniques similarly; near -1 indicates
                inverse preferences; near 0 indicates independent preferences.
              </p>
            </div>
            <div className="bg-muted rounded-lg p-4 space-y-2">
              <p className="text-sm font-semibold text-foreground">Multiple Comparisons</p>
              <p className="text-xs text-muted-foreground">
                All pairwise per-technique tests are subject to Bonferroni correction to control
                family-wise error rate. With{" "}
                <span className="font-mono text-foreground">k</span> techniques, the adjusted
                significance threshold is{" "}
                <span className="font-mono text-foreground">&alpha; / k</span>.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 8. Limitations */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Limitations</CardTitle>
          <CardDescription>
            Known constraints and threats to validity in the current study design
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[
              {
                title: "Model Version Inconsistency",
                body: "Claude, Codex, and Gemini have different release dates, training cutoffs, and architectural changes. Observed differences may reflect release-date capability gaps rather than inherent provider biases.",
              },
              {
                title: "Single-Run Experiments",
                body: "Each condition is run once without repeated trials. LLM outputs are stochastic, so single-run results may not be representative. Confidence intervals are not available for most metrics.",
              },
              {
                title: "Heuristic Attack Classification",
                body: "HTTP traffic classification relies on pattern matching against OWASP CRS rules, not manual verification. False positives (benign requests misclassified as attacks) and false negatives (novel attack patterns missed) are possible.",
              },
              {
                title: "Web Application Scope",
                body: "Experiments are limited to web application attacks. Network-level exploitation, binary exploitation, privilege escalation, and lateral movement are not evaluated. Results should not be generalized to broader offensive security tasks.",
              },
              {
                title: "CLI Behavioral Differences",
                body: "Claude Code CLI, OpenAI Codex CLI, and Gemini CLI have different tool implementations, confirmation dialogs, and default behaviors. The --yolo / --dangerously-skip-permissions flags partially normalize this, but CLI-level differences may confound agent-level comparisons.",
              },
              {
                title: "Cost Asymmetry",
                body: "API pricing differs significantly across providers. Cost-normalized metrics (cost per success) are included, but raw performance comparisons do not account for economic differences in API access.",
              },
            ].map(({ title, body }) => (
              <div key={title} className="flex gap-3 py-2 border-b border-border last:border-0">
                <div className="mt-0.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-destructive mt-1.5 shrink-0" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">{title}</p>
                  <p className="text-xs text-muted-foreground">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
