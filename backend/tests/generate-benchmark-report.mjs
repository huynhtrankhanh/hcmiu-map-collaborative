import path from "node:path";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { writeBenchmarkArtifacts } from "./benchmark-helpers.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const defaultOutputDir = path.join(root, "artifacts", "benchmarks");
const defaultDocsDir = path.join(root, "docs", "benchmarks");

const parseArgs = (argv) => {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--input") {
      parsed.input = argv[index + 1];
      index += 1;
    } else if (value === "--output-dir") {
      parsed.outputDir = argv[index + 1];
      index += 1;
    } else if (value === "--docs-dir") {
      parsed.docsDir = argv[index + 1];
      index += 1;
    }
  }
  return parsed;
};

const main = async () => {
  const args = parseArgs(process.argv.slice(2));
  if (!args.input) {
    throw new Error("Usage: node backend/tests/generate-benchmark-report.mjs --input <benchmark-json>");
  }

  const inputPath = path.resolve(root, args.input);
  const benchmark = JSON.parse(await readFile(inputPath, "utf8"));
  const result = await writeBenchmarkArtifacts(benchmark, {
    outputDir: path.resolve(root, args.outputDir ?? defaultOutputDir),
    docsDir: path.resolve(root, args.docsDir ?? defaultDocsDir),
    slug: benchmark.slug ?? "backend-stress",
  });

  console.log("Benchmark report regenerated:");
  console.log(`- JSON: ${result.jsonPath}`);
  console.log(`- Markdown: ${result.docsMarkdownPath}`);
  console.log(`- Throughput chart: ${result.throughputSvgPath}`);
  console.log(`- Latency chart: ${result.latencySvgPath}`);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
