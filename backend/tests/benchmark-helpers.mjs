import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";

const numberFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const integerFormatter = new Intl.NumberFormat("en-US");

export const percentile = (values, percentileValue) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil((percentileValue / 100) * sorted.length) - 1)
  );
  return sorted[index];
};

export const summarizeScenario = (scenario) => {
  const latencies = scenario.latenciesMs ?? [];
  const successCount = scenario.successCount ?? 0;
  const failureCount = scenario.failureCount ?? 0;
  const requestCount = successCount + failureCount;
  const durationSeconds = (scenario.durationMs ?? 0) / 1000;
  const totalLatency = latencies.reduce((sum, value) => sum + value, 0);

  return {
    ...scenario,
    requestCount,
    durationSeconds,
    requestsPerSecond: durationSeconds > 0 ? requestCount / durationSeconds : 0,
    avgLatencyMs: latencies.length ? totalLatency / latencies.length : 0,
    minLatencyMs: latencies.length ? Math.min(...latencies) : 0,
    p50LatencyMs: percentile(latencies, 50),
    p95LatencyMs: percentile(latencies, 95),
    p99LatencyMs: percentile(latencies, 99),
    maxLatencyMs: latencies.length ? Math.max(...latencies) : 0,
    successRate: requestCount ? successCount / requestCount : 0,
  };
};

const chartColor = (index) =>
  ["#2563eb", "#0f766e", "#9333ea", "#ea580c", "#dc2626"][index % 5];

const escapeXml = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

const formatNumber = (value) => numberFormatter.format(value);

const formatPercent = (value) => `${formatNumber(value * 100)}%`;

export const buildThroughputChartSvg = (scenarios) => {
  const width = 960;
  const height = 420;
  const margin = { top: 60, right: 40, bottom: 110, left: 90 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;
  const barWidth = innerWidth / Math.max(scenarios.length, 1) * 0.6;
  const step = innerWidth / Math.max(scenarios.length, 1);
  const maxValue = Math.max(1, ...scenarios.map((scenario) => scenario.requestsPerSecond));

  const axisLines = Array.from({ length: 5 }, (_, index) => {
    const ratio = index / 4;
    const y = margin.top + innerHeight - ratio * innerHeight;
    const label = formatNumber(maxValue * ratio);
    return `
      <line x1="${margin.left}" y1="${y}" x2="${width - margin.right}" y2="${y}" stroke="#d1d5db" stroke-dasharray="4 4" />
      <text x="${margin.left - 12}" y="${y + 5}" font-size="12" text-anchor="end" fill="#475569">${label}</text>
    `;
  }).join("");

  const bars = scenarios
    .map((scenario, index) => {
      const x = margin.left + step * index + (step - barWidth) / 2;
      const barHeight = (scenario.requestsPerSecond / maxValue) * innerHeight;
      const y = margin.top + innerHeight - barHeight;
      const labelY = y - 8;
      return `
        <rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" rx="8" fill="${chartColor(index)}" />
        <text x="${x + barWidth / 2}" y="${labelY}" font-size="12" text-anchor="middle" fill="#0f172a">${formatNumber(scenario.requestsPerSecond)}</text>
        <text x="${x + barWidth / 2}" y="${height - margin.bottom + 24}" font-size="12" text-anchor="end" transform="rotate(-28 ${x + barWidth / 2} ${height - margin.bottom + 24})" fill="#334155">${escapeXml(scenario.label)}</text>
      `;
    })
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc">
  <title id="title">Backend stress throughput by scenario</title>
  <desc id="desc">Requests per second achieved by each Docker Compose benchmark scenario.</desc>
  <rect width="100%" height="100%" fill="#f8fafc" />
  <text x="${width / 2}" y="32" text-anchor="middle" font-size="22" font-weight="700" fill="#0f172a">Backend stress throughput</text>
  <text x="${width / 2}" y="52" text-anchor="middle" font-size="13" fill="#475569">Higher is better • requests per second against docker compose</text>
  ${axisLines}
  <line x1="${margin.left}" y1="${margin.top + innerHeight}" x2="${width - margin.right}" y2="${margin.top + innerHeight}" stroke="#475569" />
  ${bars}
  <text x="18" y="${margin.top + innerHeight / 2}" transform="rotate(-90 18 ${margin.top + innerHeight / 2})" font-size="13" fill="#334155">Requests / second</text>
</svg>`;
};

export const buildLatencyChartSvg = (scenarios) => {
  const width = 960;
  const height = 460;
  const margin = { top: 70, right: 40, bottom: 130, left: 90 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;
  const groupWidth = innerWidth / Math.max(scenarios.length, 1);
  const barWidth = Math.min(34, groupWidth / 4);
  const maxLatency = Math.max(
    1,
    ...scenarios.flatMap((scenario) => [
      scenario.p50LatencyMs,
      scenario.p95LatencyMs,
      scenario.p99LatencyMs,
    ])
  );

  const series = [
    { key: "p50LatencyMs", label: "P50", color: "#2563eb" },
    { key: "p95LatencyMs", label: "P95", color: "#ea580c" },
    { key: "p99LatencyMs", label: "P99", color: "#dc2626" },
  ];

  const axisLines = Array.from({ length: 5 }, (_, index) => {
    const ratio = index / 4;
    const y = margin.top + innerHeight - ratio * innerHeight;
    const label = formatNumber(maxLatency * ratio);
    return `
      <line x1="${margin.left}" y1="${y}" x2="${width - margin.right}" y2="${y}" stroke="#d1d5db" stroke-dasharray="4 4" />
      <text x="${margin.left - 12}" y="${y + 5}" font-size="12" text-anchor="end" fill="#475569">${label}</text>
    `;
  }).join("");

  const groups = scenarios
    .map((scenario, scenarioIndex) => {
      const originX = margin.left + groupWidth * scenarioIndex + groupWidth / 2 - (series.length * barWidth) / 2;
      const bars = series
        .map((entry, entryIndex) => {
          const value = scenario[entry.key];
          const heightValue = (value / maxLatency) * innerHeight;
          const x = originX + entryIndex * barWidth;
          const y = margin.top + innerHeight - heightValue;
          return `
            <rect x="${x}" y="${y}" width="${barWidth - 4}" height="${heightValue}" rx="6" fill="${entry.color}" />
            <text x="${x + (barWidth - 4) / 2}" y="${y - 8}" font-size="11" text-anchor="middle" fill="#0f172a">${formatNumber(value)}</text>
          `;
        })
        .join("");

      return `
        ${bars}
        <text x="${margin.left + groupWidth * scenarioIndex + groupWidth / 2}" y="${height - margin.bottom + 28}" font-size="12" text-anchor="end" transform="rotate(-28 ${margin.left + groupWidth * scenarioIndex + groupWidth / 2} ${height - margin.bottom + 28})" fill="#334155">${escapeXml(scenario.label)}</text>
      `;
    })
    .join("");

  const legend = series
    .map(
      (entry, index) => `
        <rect x="${margin.left + index * 120}" y="36" width="18" height="18" rx="4" fill="${entry.color}" />
        <text x="${margin.left + 26 + index * 120}" y="50" font-size="12" fill="#334155">${entry.label}</text>
      `
    )
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc">
  <title id="title">Backend stress latency percentiles by scenario</title>
  <desc id="desc">P50, P95, and P99 latency in milliseconds for each Docker Compose benchmark scenario.</desc>
  <rect width="100%" height="100%" fill="#f8fafc" />
  <text x="${width / 2}" y="30" text-anchor="middle" font-size="22" font-weight="700" fill="#0f172a">Backend stress latency percentiles</text>
  <text x="${width / 2}" y="52" text-anchor="middle" font-size="13" fill="#475569">Lower is better • milliseconds per request</text>
  ${legend}
  ${axisLines}
  <line x1="${margin.left}" y1="${margin.top + innerHeight}" x2="${width - margin.right}" y2="${margin.top + innerHeight}" stroke="#475569" />
  ${groups}
  <text x="18" y="${margin.top + innerHeight / 2}" transform="rotate(-90 18 ${margin.top + innerHeight / 2})" font-size="13" fill="#334155">Latency (ms)</text>
</svg>`;
};

export const generateMarkdownReport = (benchmark, options = {}) => {
  const throughputChart = options.throughputChartPath ?? "./backend-stress-throughput.svg";
  const latencyChart = options.latencyChartPath ?? "./backend-stress-latency.svg";
  const scenarios = benchmark.scenarios.map(summarizeScenario);
  const totalRequests = scenarios.reduce((sum, scenario) => sum + scenario.requestCount, 0);
  const totalFailures = scenarios.reduce((sum, scenario) => sum + scenario.failureCount, 0);

  const summaryRows = scenarios
    .map(
      (scenario) =>
        `| ${scenario.label} | ${integerFormatter.format(scenario.requestCount)} | ${formatNumber(
          scenario.requestsPerSecond
        )} | ${formatNumber(scenario.avgLatencyMs)} | ${formatNumber(
          scenario.p95LatencyMs
        )} | ${formatPercent(scenario.successRate)} |`
    )
    .join("\n");

  const scenarioSections = scenarios
    .map((scenario) => {
      const statusBreakdown = Object.entries(scenario.statusCounts ?? {})
        .map(([status, count]) => `${status}: ${integerFormatter.format(count)}`)
        .join(", ");
      const errorSummary = (scenario.errors ?? []).length
        ? `- Errors sampled: ${(scenario.errors ?? [])
            .map((error) => `\`${error}\``)
            .join(", ")}`
        : "- Errors sampled: none";

      return `### ${scenario.label}

- Method / path: \`${scenario.method}\` \`${scenario.path}\`
- Concurrency: ${scenario.concurrency}
- Runtime: ${formatNumber(scenario.durationSeconds)} s
- Requests: ${integerFormatter.format(scenario.requestCount)} (${integerFormatter.format(
        scenario.successCount
      )} ok / ${integerFormatter.format(scenario.failureCount)} failed)
- Throughput: ${formatNumber(scenario.requestsPerSecond)} req/s
- Latency: avg ${formatNumber(scenario.avgLatencyMs)} ms · p50 ${formatNumber(
        scenario.p50LatencyMs
      )} ms · p95 ${formatNumber(scenario.p95LatencyMs)} ms · p99 ${formatNumber(
        scenario.p99LatencyMs
      )} ms · max ${formatNumber(scenario.maxLatencyMs)} ms
- Statuses: ${statusBreakdown || "none"}
${errorSummary}`;
    })
    .join("\n\n");

  const environment = benchmark.environment ?? {};
  const docker = environment.dockerCompose ?? {};

  return `# Backend stress benchmark report

- Generated at: ${benchmark.generatedAt}
- Stack under test: Docker Compose backend service on \`${benchmark.baseUrl}\`
- Seeded dataset: ${integerFormatter.format(benchmark.seedSummary?.entityCount ?? 0)} benchmark entities
- Aggregate requests: ${integerFormatter.format(totalRequests)}
- Aggregate failures: ${integerFormatter.format(totalFailures)}
- Docker image / compose context: ${docker.command ?? "docker compose up -d --build"}
- Node.js: ${environment.nodeVersion ?? process.version}
- Platform: ${environment.platform ?? process.platform} (${environment.arch ?? process.arch})

## Scenario summary

| Scenario | Requests | Req/s | Avg latency (ms) | P95 latency (ms) | Success rate |
| --- | ---: | ---: | ---: | ---: | ---: |
${summaryRows}

## Charts

### Throughput

![Throughput chart](${throughputChart})

### Latency percentiles

![Latency percentile chart](${latencyChart})

## Per-scenario notes

${scenarioSections}

## Reproduce

\`\`\`bash
npm run test:stress-backend
npm run benchmark:report -- --input ./artifacts/benchmarks/<run>.json
\`\`\`
`;
};

export const writeBenchmarkArtifacts = async (benchmark, options) => {
  const docsDir = options.docsDir;
  const outputDir = options.outputDir;
  const slug = options.slug ?? "backend-stress";
  const timestampSlug = benchmark.generatedAt.replaceAll(":", "-");
  const jsonPath = path.join(outputDir, `${slug}-${timestampSlug}.json`);
  const runMarkdownPath = path.join(outputDir, `${slug}-${timestampSlug}.md`);
  const docsMarkdownPath = path.join(docsDir, `${slug}-report.md`);
  const throughputSvgPath = path.join(docsDir, `${slug}-throughput.svg`);
  const latencySvgPath = path.join(docsDir, `${slug}-latency.svg`);
  const summarizedBenchmark = {
    ...benchmark,
    scenarios: benchmark.scenarios.map(summarizeScenario),
  };
  const markdown = generateMarkdownReport(summarizedBenchmark, {
    throughputChartPath: `./${path.basename(throughputSvgPath)}`,
    latencyChartPath: `./${path.basename(latencySvgPath)}`,
  });

  await mkdir(outputDir, { recursive: true });
  await mkdir(docsDir, { recursive: true });

  await Promise.all([
    writeFile(jsonPath, `${JSON.stringify(summarizedBenchmark, null, 2)}\n`),
    writeFile(runMarkdownPath, `${markdown}\n`),
    writeFile(docsMarkdownPath, `${markdown}\n`),
    writeFile(throughputSvgPath, buildThroughputChartSvg(summarizedBenchmark.scenarios)),
    writeFile(latencySvgPath, buildLatencyChartSvg(summarizedBenchmark.scenarios)),
  ]);

  return {
    jsonPath,
    runMarkdownPath,
    docsMarkdownPath,
    throughputSvgPath,
    latencySvgPath,
  };
};
