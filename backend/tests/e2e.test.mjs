import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import puppeteer from "puppeteer";

const root = "/home/runner/work/hcmiu-map-collaborative/hcmiu-map-collaborative";

const waitFor = async (url, timeoutMs = 45_000) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {}
    await delay(500);
  }
  throw new Error(`Timed out waiting for ${url}`);
};

const run = async () => {
  const backendPort = 3000;
  const frontendPort = 5173;

  const backend = spawn("npm", ["run", "dev:backend"], {
    cwd: root,
    env: { ...process.env, PORT: String(backendPort), USE_IN_MEMORY_DB: "1", FRONTEND_ORIGIN: `http://127.0.0.1:${frontendPort}` },
    stdio: "inherit",
  });
  const frontend = spawn("npm", ["run", "dev", "--", "--host", "127.0.0.1", "--port", String(frontendPort)], {
    cwd: root,
    env: { ...process.env, VITE_API_BASE_URL: `http://127.0.0.1:${backendPort}` },
    stdio: "inherit",
  });

  try {
    await waitFor(`http://127.0.0.1:${backendPort}/api/health`);
    await waitFor(`http://127.0.0.1:${frontendPort}`);

    const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox"] });
    const page = await browser.newPage();
    await page.goto(`http://127.0.0.1:${frontendPort}`, { waitUntil: "networkidle2" });

    await page.waitForFunction(() =>
      Array.from(document.querySelectorAll("button")).some((b) =>
        (b.textContent || "").includes("HCMIU Collaborative")
      )
    );
    await page.evaluate(() => {
      const button = Array.from(document.querySelectorAll("button")).find((b) =>
        (b.textContent || "").includes("HCMIU Collaborative")
      );
      if (!button) throw new Error("Collaborative button not found");
      button.click();
    });

    await page.waitForSelector("#username");
    await page.type("#username", "e2e_user");
    await page.type("#password", "e2e_password");
    await page.click("#signup");

    await page.waitForFunction(() => document.body.textContent?.includes("Logged in as"), { timeout: 20000 });

    await page.type("#entity-title", "E2E Entity");
    await page.type("#entity-body", "Created in puppeteer test");
    await page.click("#create-entity");

    await page.waitForFunction(() => document.body.textContent?.includes("E2E Entity"), { timeout: 20000 });

    await browser.close();
    console.log("Puppeteer E2E passed");
  } finally {
    if (backend.pid) {
      try { process.kill(backend.pid, "SIGTERM"); } catch {}
    }
    if (frontend.pid) {
      try { process.kill(frontend.pid, "SIGTERM"); } catch {}
    }
  }
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
