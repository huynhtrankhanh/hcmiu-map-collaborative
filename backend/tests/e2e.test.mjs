import { spawnSync } from "node:child_process";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import puppeteer from "puppeteer";
import sodium from "libsodium-wrappers-sumo";

const root = "/home/runner/work/hcmiu-map-collaborative/hcmiu-map-collaborative";
const backendUrl = "http://localhost:3000";
const frontendUrl = "http://localhost:5173";
const screenshotDir = path.join(root, "artifacts", "screenshots");

const runCommand = (args) => {
  const result = spawnSync("docker", args, {
    cwd: root,
    stdio: "inherit",
    env: process.env,
  });
  if (result.status !== 0) {
    throw new Error(`docker ${args.join(" ")} failed with status ${result.status}`);
  }
};

const waitFor = async (url, timeoutMs = 180_000) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {}
    await delay(1000);
  }
  throw new Error(`Timed out waiting for ${url}`);
};

const waitForEntityByTitle = async (title, timeoutMs = 30_000) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const result = await fetchJson(`/api/research/fulltext?q=${encodeURIComponent(title)}`);
      const found = result.entities.find((x) => x.title === title);
      if (found) return found.id;
    } catch {}
    await delay(500);
  }
  throw new Error(`Timed out waiting for entity title: ${title}`);
};

const fetchJson = async (path, options = {}, token) => {
  const response = await fetch(`${backendUrl}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  const body = response.status === 204 ? null : await response.json();
  if (!response.ok) throw new Error(`${path} failed: ${body?.error || response.status}`);
  return body;
};

const pwhash = async (password, saltBase64) => {
  await sodium.ready;
  const salt = sodium.from_base64(saltBase64, sodium.base64_variants.ORIGINAL);
  const derived = sodium.crypto_pwhash(
    32,
    password,
    salt,
    sodium.crypto_pwhash_OPSLIMIT_INTERACTIVE,
    sodium.crypto_pwhash_MEMLIMIT_INTERACTIVE,
    sodium.crypto_pwhash_ALG_DEFAULT,
    "uint8array"
  );
  return sodium.to_base64(derived, sodium.base64_variants.ORIGINAL);
};

const signup = async (username, password) => {
  const start = await fetchJson("/api/auth/signup/start", {
    method: "POST",
    body: JSON.stringify({ username }),
  });
  const clientHash = await pwhash(password, start.clientSalt);
  return await fetchJson("/api/auth/signup/finish", {
    method: "POST",
    body: JSON.stringify({
      username,
      clientHash,
      clientSalt: start.clientSalt,
      serverSalt: start.serverSalt,
    }),
  });
};

const clickButtonByText = async (page, text) => {
  await page.waitForFunction(
    (targetText) => Array.from(document.querySelectorAll("button")).some((x) => (x.textContent || "").includes(targetText)),
    {},
    text
  );
  await page.evaluate((targetText) => {
    const button = Array.from(document.querySelectorAll("button")).find((x) => (x.textContent || "").includes(targetText));
    if (!button) throw new Error(`button not found: ${targetText}`);
    button.click();
  }, text);
};

const run = async () => {
  runCommand(["compose", "up", "-d", "--build"]);

  try {
    await waitFor(`${backendUrl}/api/health`);
    await waitFor(frontendUrl);

    const now = Date.now();
    const plaintiffUser = `plaintiff_${now}`;
    const defendantUser = `defendant_${now}`;
    const judgeUser = `judge_${now}`;
    const password = "Password#123";

    const plaintiff = await signup(plaintiffUser, password);
    const defendant = await signup(defendantUser, password);
    const judge = await signup(judgeUser, password);

    const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox"] });
    const page = await browser.newPage();
    page.on("dialog", async (dialog) => {
      if (dialog.type() === "prompt") await dialog.accept("Edited from comprehensive E2E");
      else await dialog.accept();
    });

    await page.goto(frontendUrl, { waitUntil: "networkidle2" });
    await mkdir(screenshotDir, { recursive: true });
    await page.screenshot({ path: path.join(screenshotDir, "landing-page.png"), fullPage: true });

    // Map -> Collaborative deep integration
    await clickButtonByText(page, "View Map");
    await page.waitForFunction(() => document.body.textContent?.includes("Map Collaboration"));
    await page.screenshot({ path: path.join(screenshotDir, "map-view-page.png"), fullPage: true });
    await page.evaluate(() => {
      const room = Array.from(document.querySelectorAll("[data-constructname]")).find((x) =>
        (x.getAttribute("data-constructname") || "").includes("A1.109")
      );
      if (!room) throw new Error("map room not found");
      room.click();
    });
    await page.waitForFunction(() => document.body.textContent?.includes("Open in HCMIU Collaborative"));
    await clickButtonByText(page, "Open in HCMIU Collaborative");

    // New multi-page UI: should land on entities sub-page when focused
    await page.waitForFunction(() => document.body.textContent?.includes("Entities"));
    await page.screenshot({ path: path.join(screenshotDir, "collaborative-entities-page.png"), fullPage: true });

    // Navigate to Auth page and login
    await clickButtonByText(page, "🔐 Auth");
    await page.waitForSelector("#username");
    await page.type("#username", plaintiffUser);
    await page.type("#password", password);
    await page.click("#login");
    await page.waitForFunction(() => document.body.textContent?.includes("Logged in as"), { timeout: 30_000 });
    await page.screenshot({ path: path.join(screenshotDir, "collaborative-auth-page.png"), fullPage: true });

    // Navigate to Entities page and create entity
    await clickButtonByText(page, "📡 Entities");
    await page.waitForSelector("#entity-title");
    await page.type("#entity-title", "E2E Core Entity");
    await page.type("#entity-body", "Created in comprehensive docker-compose e2e test");
    await page.click("#create-entity");
    const createdEntityId = await waitForEntityByTitle("E2E Core Entity", 40_000);

    // Add comment and edit entity through API in deployed stack
    await fetchJson(
      "/api/entities",
      {
        method: "POST",
        body: JSON.stringify({
          type: "comment",
          title: "",
          body: "Comment from comprehensive E2E",
          parentEntityId: createdEntityId,
          references: [createdEntityId],
        }),
      },
      plaintiff.token
    );
    await fetchJson(
      `/api/entities/${createdEntityId}`,
      {
        method: "PATCH",
        body: JSON.stringify({ body: "Edited from comprehensive E2E" }),
      },
      plaintiff.token
    );

    // API-side deep checks in same deployed environment
    await fetchJson(`/api/entities/${createdEntityId}/follow`, { method: "POST" }, defendant.token);
    await fetchJson(
      "/api/entities",
      {
        method: "POST",
        body: JSON.stringify({
          type: "comment",
          title: "",
          body: "Defendant comments",
          parentEntityId: createdEntityId,
          references: [createdEntityId],
        }),
      },
      plaintiff.token
    );
    const defendantNotifications = await fetchJson("/api/notifications", {}, defendant.token);
    if (!defendantNotifications.notifications.length) throw new Error("expected notifications for follower");

    // Trial with interactive judge dialogue
    const trial = await fetchJson(
      "/api/trials",
      {
        method: "POST",
        body: JSON.stringify({ title: "E2E Trial", description: "Comprehensive trial", defendantUsername: defendantUser }),
      },
      plaintiff.token
    );
    // Plaintiff proposes judges
    await fetchJson(`/api/trials/${trial.trial.id}/propose-judges`, { method: "POST", body: JSON.stringify({ judges: [judgeUser] }) }, plaintiff.token);
    // Defendant accepts the proposal
    await fetchJson(`/api/trials/${trial.trial.id}/accept-judges`, { method: "POST" }, defendant.token);
    // Judge votes
    const voted = await fetchJson(`/api/trials/${trial.trial.id}/vote`, { method: "POST", body: JSON.stringify({ vote: "plaintiff" }) }, judge.token);
    if (voted.trial.status !== "resolved") throw new Error("expected trial resolution");

    // Navigate to Trials page and take screenshot
    await clickButtonByText(page, "⚖️ Trials");
    await page.waitForFunction(() => document.body.textContent?.includes("Court of Justice"));
    await page.screenshot({ path: path.join(screenshotDir, "collaborative-trials-page.png"), fullPage: true });

    // Navigate to Activity Feed and take screenshot
    await clickButtonByText(page, "📰 Activity");
    await page.waitForFunction(() => document.body.textContent?.includes("Activity Feed"));
    await page.screenshot({ path: path.join(screenshotDir, "collaborative-activity-page.png"), fullPage: true });

    // Navigate to Research page and take screenshot
    await clickButtonByText(page, "🔎 Research");
    await page.waitForFunction(() => document.body.textContent?.includes("Deep Research"));
    await page.screenshot({ path: path.join(screenshotDir, "collaborative-research-page.png"), fullPage: true });

    // Navigate to Notifications page and take screenshot
    await clickButtonByText(page, "🔔 Notifications");
    await page.waitForFunction(() => document.body.textContent?.includes("Notifications"));
    await page.screenshot({ path: path.join(screenshotDir, "collaborative-notifications-page.png"), fullPage: true });

    // Navigate to Tutorial page and take screenshot
    await clickButtonByText(page, "📖 Tutorial");
    await page.waitForFunction(() => document.body.textContent?.includes("How to Use HCMIU Collaborative"));
    await page.screenshot({ path: path.join(screenshotDir, "collaborative-tutorial-page.png"), fullPage: true });

    const refs = await fetchJson(`/api/research/references?ids=${encodeURIComponent(createdEntityId)}`);
    if (!refs.entities.length) throw new Error("expected referencing entities");

    const fulltext = await fetchJson("/api/research/fulltext?q=Edited%20from%20comprehensive%20E2E");
    if (!fulltext.entities.some((x) => x.id === createdEntityId)) throw new Error("expected fulltext match");

    const degree = await fetchJson(`/api/research/degree?from=${encodeURIComponent(createdEntityId)}&to=${encodeURIComponent(refs.entities[0].id)}`);
    if (!degree.path.length) throw new Error("expected non-empty degree path");

    // Activity feed API check
    const activity = await fetchJson("/api/activity?limit=10");
    if (!activity.items.length) throw new Error("expected activity items");

    await browser.close();
    console.log("Comprehensive Puppeteer/API E2E passed against Docker Compose stack");
  } finally {
    runCommand(["compose", "down", "-v"]);
  }
};

run().catch((err) => {
  console.error(err);
  try {
    runCommand(["compose", "down", "-v"]);
  } catch {}
  process.exit(1);
});
