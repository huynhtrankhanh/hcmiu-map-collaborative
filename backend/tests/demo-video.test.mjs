/**
 * Comprehensive E2E Demo Video Script
 *
 * Launches the full Docker Compose stack (ArangoDB + backend), records a
 * Puppeteer screencast that walks through every major feature of the HCMIU
 * Map Collaborative application, and produces a finished MP4 video.
 *
 * Usage:
 *   node backend/tests/demo-video.test.mjs
 *
 * Outputs:
 *   artifacts/demo.mp4   – final demo video
 */

import { spawnSync, execSync } from "node:child_process";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import puppeteer from "puppeteer";
import sodium from "libsodium-wrappers-sumo";

const root =
  "/home/runner/work/hcmiu-map-collaborative/hcmiu-map-collaborative";
const backendUrl = "http://localhost:3000";
const frontendUrl = backendUrl;
const artifactDir = path.join(root, "artifacts");
const webmPath = path.join(artifactDir, "demo.webm");
const mp4Path = path.join(artifactDir, "demo.mp4");

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

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

const fetchJson = async (urlPath, options = {}, token) => {
  const response = await fetch(`${backendUrl}${urlPath}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  const body = response.status === 204 ? null : await response.json();
  if (!response.ok)
    throw new Error(`${urlPath} failed: ${body?.error || response.status}`);
  return body;
};

const pwhash = async (password, saltBase64) => {
  await sodium.ready;
  const salt = sodium.from_base64(
    saltBase64,
    sodium.base64_variants.ORIGINAL
  );
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
  return fetchJson("/api/auth/signup/finish", {
    method: "POST",
    body: JSON.stringify({
      username,
      clientHash,
      clientSalt: start.clientSalt,
      serverSalt: start.serverSalt,
    }),
  });
};

const waitForEntityByTitle = async (title, timeoutMs = 30_000) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const result = await fetchJson(
        `/api/research/fulltext?q=${encodeURIComponent(title)}`
      );
      const found = result.entities.find((x) => x.title === title);
      if (found) return found.id;
    } catch {}
    await delay(500);
  }
  throw new Error(`Timed out waiting for entity title: ${title}`);
};

/** Click a button whose visible text includes `text`. */
const clickButtonByText = async (page, text) => {
  await page.waitForFunction(
    (t) =>
      Array.from(document.querySelectorAll("button")).some((b) =>
        (b.textContent || "").includes(t)
      ),
    { timeout: 30_000 },
    text
  );
  await page.evaluate((t) => {
    const btn = Array.from(document.querySelectorAll("button")).find((b) =>
      (b.textContent || "").includes(t)
    );
    if (!btn) throw new Error(`button not found: ${t}`);
    btn.scrollIntoView({ behavior: "smooth", block: "center" });
    btn.click();
  }, text);
};

/** Slowly type characters so the video shows typing animation. */
const slowType = async (page, selector, text, ms = 80) => {
  await page.waitForSelector(selector, { timeout: 15_000 });
  await page.click(selector);
  for (const ch of text) {
    await page.type(selector, ch, { delay: 0 });
    await delay(ms);
  }
};

/** Pause long enough for the viewer to see what is on screen. */
const pause = (ms = 1500) => delay(ms);

/* ------------------------------------------------------------------ */
/*  Main demo flow                                                    */
/* ------------------------------------------------------------------ */

const run = async () => {
  // 1. Bring up the full Docker Compose stack
  console.log("▶ Starting Docker Compose stack …");
  runCommand(["compose", "up", "-d", "--build"]);

  try {
    console.log("▶ Waiting for backend health …");
    await waitFor(`${backendUrl}/api/health`);
    await waitFor(frontendUrl);
    console.log("✔ Stack is healthy");

    // 2. Pre-create users via API so the demo flows smoothly
    const now = Date.now();
    const demoUser = `demo_user_${now}`;
    const otherUser = `other_user_${now}`;
    const judgeUser = `judge_${now}`;
    const password = "DemoPass#42";

    const userCreds = await signup(demoUser, password);
    const otherCreds = await signup(otherUser, password);
    const judgeCreds = await signup(judgeUser, password);

    // 3. Launch Puppeteer with screencast recording
    await mkdir(artifactDir, { recursive: true });

    const browser = await puppeteer.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--window-size=1280,800",
      ],
      defaultViewport: { width: 1280, height: 800 },
    });

    const page = await browser.newPage();

    // Auto-accept dialogs that may appear
    page.on("dialog", async (dialog) => {
      if (dialog.type() === "prompt")
        await dialog.accept("Demo edit via E2E video");
      else await dialog.accept();
    });

    // Start screen recording
    console.log("▶ Starting screencast …");
    const recorder = await page.screencast({ path: webmPath });

    /* ============================================================== */
    /*  SCENE 1 – Landing Page                                        */
    /* ============================================================== */
    console.log("  Scene 1: Landing page");
    await page.goto(frontendUrl, { waitUntil: "networkidle2" });
    await pause(3000);

    // Scroll down slowly to reveal the full landing page
    await page.evaluate(() => window.scrollTo({ top: 300, behavior: "smooth" }));
    await pause(1500);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
    await pause(1000);

    /* ============================================================== */
    /*  SCENE 2 – Map Explorer                                        */
    /* ============================================================== */
    console.log("  Scene 2: Map Explorer");
    await clickButtonByText(page, "View Map");
    await page.waitForFunction(() =>
      document.body.textContent?.includes("Map Collaboration")
    );
    await pause(2000);

    // Switch between floors
    await page.waitForSelector("select[name='floor']");
    await page.select("select[name='floor']", "0"); // Floor 1
    await pause(1500);
    await page.select("select[name='floor']", "1"); // Floor 2
    await pause(1500);
    await page.select("select[name='floor']", "2"); // Floor 3
    await pause(1500);
    await page.select("select[name='floor']", "0"); // Back to Floor 1
    await pause(1000);

    // Quick search for a room
    await slowType(page, "#map-quick-search", "Floor 2: A2.203", 60);
    await page.waitForFunction(() =>
      Array.from(document.querySelectorAll("div")).some((el) =>
        (el.textContent || "").includes("Floor 2: A2.203")
      )
    );
    await pause(1000);
    await page.evaluate(() => {
      const suggestion = Array.from(document.querySelectorAll("div")).find(
        (el) => (el.textContent || "").includes("Floor 2: A2.203")
      );
      if (suggestion instanceof HTMLElement) suggestion.click();
    });
    await pause(2000);

    // Click a room on the map to open its thread
    await page.select("select[name='floor']", "0"); // Floor 1
    await pause(1000);
    await page.evaluate(() => {
      const room = Array.from(
        document.querySelectorAll("[data-constructname]")
      ).find((x) =>
        (x.getAttribute("data-constructname") || "").includes("A1.109")
      );
      if (room) room.click();
    });
    await page.waitForFunction(() =>
      document.body.textContent?.includes("Open in HCMIU Collaborative")
    );
    await pause(2000);

    // Open the room in Collaborative
    await clickButtonByText(page, "Open in HCMIU Collaborative");
    await page.waitForFunction(() =>
      document.body.textContent?.includes("Entities")
    );
    await pause(2000);

    /* ============================================================== */
    /*  SCENE 3 – Collaborative: Auth                                 */
    /* ============================================================== */
    console.log("  Scene 3: Auth (Login)");
    await clickButtonByText(page, "🔐 Auth");
    await page.waitForSelector("#username");
    await pause(500);
    await slowType(page, "#username", demoUser, 40);
    await slowType(page, "#password", password, 40);
    await pause(500);
    await page.click("#login");
    await page.waitForFunction(
      () => document.body.textContent?.includes("Logged in as"),
      { timeout: 30_000 }
    );
    await pause(2000);

    /* ============================================================== */
    /*  SCENE 4 – Collaborative: Create & Edit Entities               */
    /* ============================================================== */
    console.log("  Scene 4: Entities (Create / Comment / Edit)");
    await clickButtonByText(page, "📡 Entities");
    await page.waitForSelector("#entity-title");
    await pause(500);

    // Create a post
    await slowType(page, "#entity-title", "Campus Library Review", 50);
    await slowType(
      page,
      "#entity-body",
      "The first-floor library offers great study pods and fast WiFi.",
      30
    );
    await pause(500);
    await page.click("#create-entity");
    const entityId = await waitForEntityByTitle(
      "Campus Library Review",
      40_000
    );
    await pause(2000);

    // Add a comment via the API (to populate the thread)
    await fetchJson(
      "/api/entities",
      {
        method: "POST",
        body: JSON.stringify({
          type: "comment",
          title: "",
          body: "I agree – the pods on the east side are my favorite!",
          parentEntityId: entityId,
          references: [entityId],
        }),
      },
      userCreds.token
    );

    // Edit the entity body via the API
    await fetchJson(
      `/api/entities/${entityId}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          body: "The first-floor library offers great study pods, fast WiFi, and quiet reading corners.",
        }),
      },
      userCreds.token
    );
    await pause(1500);

    // Follow the entity as the other user (for notifications later)
    await fetchJson(
      `/api/entities/${entityId}/follow`,
      { method: "POST" },
      otherCreds.token
    );

    // Add a second comment (triggers notification for follower)
    await fetchJson(
      "/api/entities",
      {
        method: "POST",
        body: JSON.stringify({
          type: "comment",
          title: "",
          body: "Just visited – they also added new whiteboards near the entrance.",
          parentEntityId: entityId,
          references: [entityId],
        }),
      },
      userCreds.token
    );
    await pause(1500);

    // Scroll down on the entities page to show any listing
    await page.evaluate(() =>
      window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" })
    );
    await pause(1500);
    await page.evaluate(() =>
      window.scrollTo({ top: 0, behavior: "smooth" })
    );
    await pause(1000);

    /* ============================================================== */
    /*  SCENE 5 – Collaborative: Trials (Court of Justice)            */
    /* ============================================================== */
    console.log("  Scene 5: Trials (Court of Justice)");

    // Create trial via API
    const trial = await fetchJson(
      "/api/trials",
      {
        method: "POST",
        body: JSON.stringify({
          title: "Library Noise Dispute",
          description:
            "Disagreement about acceptable noise levels in the group study area.",
          defendantUsername: otherUser,
        }),
      },
      userCreds.token
    );
    // Plaintiff proposes judge
    await fetchJson(
      `/api/trials/${trial.trial.id}/propose-judges`,
      {
        method: "POST",
        body: JSON.stringify({ judges: [judgeUser] }),
      },
      userCreds.token
    );
    // Defendant accepts
    await fetchJson(
      `/api/trials/${trial.trial.id}/accept-judges`,
      { method: "POST" },
      otherCreds.token
    );
    // Judge votes
    await fetchJson(
      `/api/trials/${trial.trial.id}/vote`,
      {
        method: "POST",
        body: JSON.stringify({ vote: "plaintiff" }),
      },
      judgeCreds.token
    );

    // Navigate to Trials page in the UI
    await clickButtonByText(page, "⚖️ Trials");
    await page.waitForFunction(() =>
      document.body.textContent?.includes("Court of Justice")
    );
    await page.waitForFunction(
      (t) => document.body.textContent?.includes(t),
      {},
      "Library Noise Dispute"
    );
    await pause(2500);
    // Scroll to show the full trial details
    await page.evaluate(() =>
      window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" })
    );
    await pause(1500);
    await page.evaluate(() =>
      window.scrollTo({ top: 0, behavior: "smooth" })
    );
    await pause(1000);

    /* ============================================================== */
    /*  SCENE 6 – Collaborative: Activity Feed                        */
    /* ============================================================== */
    console.log("  Scene 6: Activity Feed");
    await clickButtonByText(page, "📰 Activity");
    await page.waitForFunction(() =>
      document.body.textContent?.includes("Activity Feed")
    );
    await pause(2500);
    await page.evaluate(() =>
      window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" })
    );
    await pause(1000);
    await page.evaluate(() =>
      window.scrollTo({ top: 0, behavior: "smooth" })
    );
    await pause(1000);

    /* ============================================================== */
    /*  SCENE 7 – Collaborative: Research                             */
    /* ============================================================== */
    console.log("  Scene 7: Research (Full-text / References / Degree)");
    await clickButtonByText(page, "🔎 Research");
    await page.waitForFunction(() =>
      document.body.textContent?.includes("Deep Research")
    );
    await pause(2000);

    // Attempt full-text search in the UI if there is a search input
    const hasSearchInput = await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll("input"));
      return inputs.some(
        (i) =>
          i.placeholder?.toLowerCase().includes("search") ||
          i.id?.includes("search") ||
          i.name?.includes("search")
      );
    });
    if (hasSearchInput) {
      const selector = await page.evaluate(() => {
        const input = Array.from(document.querySelectorAll("input")).find(
          (i) =>
            i.placeholder?.toLowerCase().includes("search") ||
            i.id?.includes("search") ||
            i.name?.includes("search")
        );
        if (input && input.id) return `#${input.id}`;
        return null;
      });
      if (selector) {
        await slowType(page, selector, "Campus Library", 50);
        await pause(1500);
        // Try to find and click a search button if one exists
        try {
          const hasSearchButton = await page.evaluate(() =>
            Array.from(document.querySelectorAll("button")).some((b) =>
              (b.textContent || "").toLowerCase().includes("search")
            )
          );
          if (hasSearchButton) {
            await page.evaluate(() => {
              const btn = Array.from(document.querySelectorAll("button")).find(
                (b) => (b.textContent || "").toLowerCase().includes("search")
              );
              if (btn) btn.click();
            });
            await pause(2500);
          }
        } catch {}
      }
    }
    await pause(1500);

    /* ============================================================== */
    /*  SCENE 8 – Collaborative: Notifications                        */
    /* ============================================================== */
    console.log("  Scene 8: Notifications");
    await clickButtonByText(page, "🔔 Notifications");
    await page.waitForFunction(() =>
      document.body.textContent?.includes("Notifications")
    );
    await pause(2500);

    /* ============================================================== */
    /*  SCENE 9 – Collaborative: Tutorial                             */
    /* ============================================================== */
    console.log("  Scene 9: Tutorial");
    await clickButtonByText(page, "📖 Tutorial");
    await page.waitForFunction(() =>
      document.body.textContent?.includes("How to Use HCMIU Collaborative")
    );
    await pause(2000);
    await page.evaluate(() =>
      window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" })
    );
    await pause(1500);
    await page.evaluate(() =>
      window.scrollTo({ top: 0, behavior: "smooth" })
    );
    await pause(1000);

    /* ============================================================== */
    /*  SCENE 10 – Back to Landing, Shortest Path                     */
    /* ============================================================== */
    console.log("  Scene 10: Shortest Path");
    // Navigate back to landing page
    await page.goto(frontendUrl, { waitUntil: "networkidle2" });
    await pause(1500);

    await clickButtonByText(page, "Find Shortest Path");
    await page.waitForFunction(() =>
      document.body.textContent?.includes("Shortest Path")
    );
    await pause(1500);

    // Fill in source and destination using suggest box
    // The ShortestPathForm uses SuggestBox components
    const inputFields = await page.$$("input[type='text']");
    if (inputFields.length >= 2) {
      // Type source
      await inputFields[0].click();
      await inputFields[0].type("Floor 1: A1.109", { delay: 50 });
      await pause(1000);
      // Select from suggestion dropdown
      await page.evaluate(() => {
        const suggestions = Array.from(document.querySelectorAll("div")).filter(
          (el) => (el.textContent || "").trim() === "Floor 1: A1.109"
        );
        const suggestion = suggestions[suggestions.length - 1];
        if (suggestion instanceof HTMLElement) suggestion.click();
      });
      await pause(500);

      // Type destination
      await inputFields[1].click();
      await inputFields[1].type("Floor 2: A2.203", { delay: 50 });
      await pause(1000);
      await page.evaluate(() => {
        const suggestions = Array.from(document.querySelectorAll("div")).filter(
          (el) => (el.textContent || "").trim() === "Floor 2: A2.203"
        );
        const suggestion = suggestions[suggestions.length - 1];
        if (suggestion instanceof HTMLElement) suggestion.click();
      });
      await pause(500);

      // Click Find Path
      await clickButtonByText(page, "Find Path");
      await pause(3000);

      // Scroll to see route result
      await page.evaluate(() =>
        window.scrollTo({
          top: document.body.scrollHeight,
          behavior: "smooth",
        })
      );
      await pause(2000);
      await page.evaluate(() =>
        window.scrollTo({ top: 0, behavior: "smooth" })
      );
      await pause(1500);
    }

    /* ============================================================== */
    /*  SCENE 11 – Traveling Salesman                                 */
    /* ============================================================== */
    console.log("  Scene 11: Traveling Salesman");
    await page.goto(frontendUrl, { waitUntil: "networkidle2" });
    await pause(1500);

    await clickButtonByText(page, "Solve Traveling Salesman");
    await page.waitForFunction(() =>
      document.body.textContent?.includes("Traveling Salesman")
    );
    await pause(1500);

    // Use a route preset for quick demo
    await clickButtonByText(page, "Load classroom loop");
    await pause(2000);

    // Click Find Path
    await clickButtonByText(page, "Find Path");
    await pause(3000);

    // Scroll to review result
    await page.evaluate(() =>
      window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" })
    );
    await pause(2000);
    await page.evaluate(() =>
      window.scrollTo({ top: 0, behavior: "smooth" })
    );
    await pause(1500);

    /* ============================================================== */
    /*  SCENE 12 – HCMIU Collaborative (direct entry)                 */
    /* ============================================================== */
    console.log("  Scene 12: Collaborative Hub (direct entry)");
    await page.goto(frontendUrl, { waitUntil: "networkidle2" });
    await pause(1000);
    await clickButtonByText(page, "HCMIU Collaborative");
    await page.waitForFunction(() =>
      document.body.textContent?.includes("Entities")
    );
    await pause(2000);

    /* ============================================================== */
    /*  SCENE 13 – Final Landing Page (end of demo)                   */
    /* ============================================================== */
    console.log("  Scene 13: Final landing page");
    await page.goto(frontendUrl, { waitUntil: "networkidle2" });
    await pause(3000);

    /* ============================================================== */
    /*  Stop recording and convert                                    */
    /* ============================================================== */
    console.log("▶ Stopping screencast …");
    await recorder.stop();
    await browser.close();
    console.log(`✔ WebM saved → ${webmPath}`);

    // Convert WebM to MP4
    console.log("▶ Converting to MP4 …");
    execSync(
      `ffmpeg -y -i ${JSON.stringify(webmPath)} -c:v libx264 -preset fast -crf 23 -pix_fmt yuv420p -movflags +faststart ${JSON.stringify(mp4Path)}`,
      { stdio: "inherit", cwd: root }
    );
    console.log(`✔ MP4 saved → ${mp4Path}`);

    console.log("\n🎬 Demo video generation complete!");
  } finally {
    console.log("▶ Tearing down Docker Compose stack …");
    runCommand(["compose", "down", "-v"]);
  }
};

run().catch((err) => {
  console.error("❌ Demo video script failed:", err);
  try {
    runCommand(["compose", "down", "-v"]);
  } catch {}
  process.exit(1);
});
