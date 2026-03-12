import test from "node:test";
import assert from "node:assert/strict";
import {
  buildLatencyChartSvg,
  buildThroughputChartSvg,
  generateMarkdownReport,
  summarizeScenario,
} from "./benchmark-helpers.mjs";

test("summarizeScenario computes percentile and throughput data", () => {
  const summary = summarizeScenario({
    label: "Entity listing",
    method: "GET",
    path: "/api/entities",
    concurrency: 4,
    durationMs: 2_000,
    successCount: 8,
    failureCount: 2,
    statusCounts: { 200: 8, 500: 2 },
    latenciesMs: [10, 15, 20, 22, 24, 30, 32, 40, 48, 60],
    errors: ["HTTP 500"],
  });

  assert.equal(summary.requestCount, 10);
  assert.equal(summary.requestsPerSecond, 5);
  assert.equal(summary.p50LatencyMs, 24);
  assert.equal(summary.p95LatencyMs, 60);
  assert.equal(summary.successRate, 0.8);
});

test("report and charts include benchmark summary content", () => {
  const benchmark = {
    generatedAt: "2026-03-12T00:00:00.000Z",
    baseUrl: "http://localhost:3000",
    seedSummary: { entityCount: 24 },
    environment: {
      nodeVersion: "v22.14.0",
      platform: "linux",
      arch: "x64",
      dockerCompose: { command: "docker compose up -d --build" },
    },
    scenarios: [
      summarizeScenario({
        label: "Health check",
        method: "GET",
        path: "/api/health",
        concurrency: 20,
        durationMs: 4_000,
        successCount: 400,
        failureCount: 0,
        statusCounts: { 200: 400 },
        latenciesMs: [5, 6, 7, 8, 9, 10, 11, 12],
        errors: [],
      }),
      summarizeScenario({
        label: "Authenticated post creation",
        method: "POST",
        path: "/api/entities",
        concurrency: 5,
        durationMs: 5_000,
        successCount: 80,
        failureCount: 2,
        statusCounts: { 200: 80, 500: 2 },
        latenciesMs: [40, 45, 50, 55, 60, 72, 90, 110],
        errors: ["POST /api/entities -> HTTP 500"],
      }),
    ],
  };

  const markdown = generateMarkdownReport(benchmark);
  const throughput = buildThroughputChartSvg(benchmark.scenarios);
  const latency = buildLatencyChartSvg(benchmark.scenarios);

  assert.match(markdown, /Backend stress benchmark report/);
  assert.match(markdown, /!\[Throughput chart\]\(\.\/backend-stress-throughput\.svg\)/);
  assert.match(markdown, /\| Health check \|/);
  assert.match(markdown, /Authenticated post creation/);
  assert.match(throughput, /Backend stress throughput/);
  assert.match(throughput, /Health check/);
  assert.match(latency, /latency percentiles/i);
  assert.match(latency, /P95/);
});
