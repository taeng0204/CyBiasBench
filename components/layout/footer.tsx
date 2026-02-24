export function Footer() {
  return (
    <footer className="border-t border-border mt-20">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <div>
            <span className="font-medium text-foreground">CyBiasBench</span>
            {" "}&mdash; Benchmarking Bias in LLM Agents for Cyber-Attack Scenarios
          </div>
          <div className="flex items-center gap-4">
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors"
            >
              GitHub
            </a>
            <span className="text-border">|</span>
            <span>2026</span>
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-border text-xs text-muted-foreground">
          <p>
            <strong>Citation:</strong> If you use this benchmark in your research, please cite:
          </p>
          <pre className="mt-2 p-3 rounded-md bg-muted font-mono text-xs overflow-x-auto">
{`@misc{cybiasbench2026,
  title={CyBiasBench: Benchmarking Bias in LLM Agents for Cyber-Attack Scenarios},
  year={2026},
  note={3 LLM agents, 3 targets, 4 conditions, 3 runs, 108 experiments}
}`}
          </pre>
        </div>
      </div>
    </footer>
  );
}
