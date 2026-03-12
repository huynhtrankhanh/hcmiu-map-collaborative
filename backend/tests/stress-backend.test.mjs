import os from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";
import {
  artifactDir,
  backendUrl,
  composeDown,
  composeUp,
  fetchJson,
  signup,
  waitForStack,
} from "./demo-helpers.mjs";
import { writeBenchmarkArtifacts } from "./benchmark-helpers.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const docsBenchmarkDir = path.join(root, "docs", "benchmarks");
const benchmarkArtifactDir = path.join(artifactDir, "benchmarks");

const benchmarkPassword = "BenchPass#42";

const postJson = (urlPath, body, token) =>
  fetchJson(
    urlPath,
    {
      method: "POST",
      body: JSON.stringify(body),
    },
    token
  );

const seedBenchmarkEntities = async (token) => {
  const createdIds = [];

  for (let index = 0; index < 24; index += 1) {
    const entity = await postJson(
      "/api/entities",
      {
        type: "post",
        title: `Benchmark Seed ${index + 1}`,
        body: `Synthetic benchmark entity ${index + 1} for docker compose stress testing.`,
        references: createdIds.length ? [createdIds[createdIds.length - 1]] : [],
      },
      token
    );
    createdIds.push(entity.entity.id);
  }

  return {
    entityCount: createdIds.length,
    entityIds: createdIds,
  };
};

const runScenario = async ({
  label,
  method,
  path: scenarioPath,
  concurrency,
  durationMs,
  buildRequest,
}) => {
  let sequence = 0;
  const latenciesMs = [];
  const errors = [];
  const statusCounts = {};
  let successCount = 0;
  let failureCount = 0;
  const startedAt = performance.now();
  const deadline = startedAt + durationMs;

  const workers = Array.from({ length: concurrency }, async (_, workerIndex) => {
    while (performance.now() < deadline) {
      const requestIndex = sequence;
      sequence += 1;
      const request = await buildRequest({ requestIndex, workerIndex });
      const requestStartedAt = performance.now();

      try {
        const response = await fetch(`${backendUrl}${request.path}`, {
          method: request.method ?? method,
          headers: {
            ...(request.body ? { "Content-Type": "application/json" } : {}),
            ...(request.token ? { Authorization: `Bearer ${request.token}` } : {}),
            ...(request.headers ?? {}),
          },
          body: request.body,
        });

        await response.text();

        const latency = performance.now() - requestStartedAt;
        latenciesMs.push(latency);
        statusCounts[response.status] = (statusCounts[response.status] ?? 0) + 1;

        if (response.ok) successCount += 1;
        else {
          failureCount += 1;
          if (errors.length < 8) {
            errors.push(`${request.method ?? method} ${request.path} -> HTTP ${response.status}`);
          }
        }
      } catch (error) {
        const latency = performance.now() - requestStartedAt;
        latenciesMs.push(latency);
        failureCount += 1;
        statusCounts.error = (statusCounts.error ?? 0) + 1;
        if (errors.length < 8) errors.push(error.message);
      }
    }
  });

  await Promise.all(workers);
  const duration = performance.now() - startedAt;

  return {
    label,
    method,
    path: scenarioPath,
    concurrency,
    durationMs: duration,
    successCount,
    failureCount,
    statusCounts,
    errors,
    latenciesMs,
  };
};

const run = async () => {
  composeUp();

  try {
    await waitForStack();

    const runId = Date.now();
    const writer = await signup(`benchmark_writer_${runId}`, benchmarkPassword);
    const reader = await signup(`benchmark_reader_${runId}`, benchmarkPassword);
    const seedSummary = await seedBenchmarkEntities(writer.token);

    const scenarios = [];

    scenarios.push(
      await runScenario({
        label: "Health check",
        method: "GET",
        path: "/api/health",
        concurrency: 20,
        durationMs: 4_000,
        buildRequest: async () => ({ path: "/api/health" }),
      })
    );

    scenarios.push(
      await runScenario({
        label: "Entity listing",
        method: "GET",
        path: "/api/entities?type=post",
        concurrency: 12,
        durationMs: 6_000,
        buildRequest: async () => ({ path: "/api/entities?type=post" }),
      })
    );

    scenarios.push(
      await runScenario({
        label: "Full-text search",
        method: "GET",
        path: `/api/research/fulltext?q=${encodeURIComponent("benchmark entity")}`,
        concurrency: 10,
        durationMs: 6_000,
        buildRequest: async () => ({
          path: `/api/research/fulltext?q=${encodeURIComponent("benchmark entity")}`,
        }),
      })
    );

    scenarios.push(
      await runScenario({
        label: "Authenticated post creation",
        method: "POST",
        path: "/api/entities",
        concurrency: 5,
        durationMs: 5_000,
        buildRequest: async ({ requestIndex }) => ({
          path: "/api/entities",
          method: "POST",
          token: writer.token,
          body: JSON.stringify({
            type: "post",
            title: `Benchmark Write ${runId}-${requestIndex}`,
            body: `Write-heavy benchmark request ${requestIndex} from docker compose stress suite.`,
            references: requestIndex % 2 === 0 && seedSummary.entityIds.length
              ? [seedSummary.entityIds[requestIndex % seedSummary.entityIds.length]]
              : [],
          }),
        }),
      })
    );

    scenarios.push(
      await runScenario({
        label: "Notifications fetch",
        method: "GET",
        path: "/api/notifications",
        concurrency: 8,
        durationMs: 4_000,
        buildRequest: async () => ({
          path: "/api/notifications",
          token: reader.token,
        }),
      })
    );

    const benchmark = {
      slug: "backend-stress",
      generatedAt: new Date().toISOString(),
      baseUrl: backendUrl,
      seedSummary,
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        cpuCount: os.cpus().length,
        dockerCompose: {
          command: "docker compose up -d --build",
        },
      },
      scenarios,
    };

    const result = await writeBenchmarkArtifacts(benchmark, {
      outputDir: benchmarkArtifactDir,
      docsDir: docsBenchmarkDir,
      slug: benchmark.slug,
    });

    console.log("Backend stress benchmark complete:");
    console.log(`- JSON: ${result.jsonPath}`);
    console.log(`- Markdown: ${result.docsMarkdownPath}`);
    console.log(`- Throughput chart: ${result.throughputSvgPath}`);
    console.log(`- Latency chart: ${result.latencySvgPath}`);
  } finally {
    composeDown();
  }
};

run().catch((error) => {
  console.error(error);
  try {
    composeDown();
  } catch {}
  process.exit(1);
});
