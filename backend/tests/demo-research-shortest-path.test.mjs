/**
 * Demo Video – Deep Research: Shortest Path (Degree of Separation)
 *
 * Demonstrates the degree-of-separation / shortest-path feature:
 *   • Create a chain of entities: A → B → C → D (each referencing the next)
 *   • Navigate to the Research page and switch to the degree tab
 *   • Find shortest path between A and D (3 hops)
 *   • Find direct connection between A and B (1 hop)
 *   • Compare path lengths to show how the graph is traversed
 *
 * Usage:
 *   node backend/tests/demo-research-shortest-path.test.mjs
 *
 * Outputs:
 *   artifacts/demo-research-shortest-path.mp4
 */

import path from "node:path";
import { mkdir, unlink } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import {
  root, backendUrl, frontendUrl, artifactDir,
  composeUp, composeDown, waitForStack,
  fetchJson, signup,
  launchBrowser, clickButtonByText, slowType, pause, clearInput,
  showOverlay, hideOverlay, showSceneTitle,
  convertToMp4, loginViaUI, waitForEntityByTitle,
  navigateToCollaborative,
} from "./demo-helpers.mjs";

const webmPath = path.join(artifactDir, "demo-research-shortest-path.webm");
const mp4Path  = path.join(artifactDir, "demo-research-shortest-path.mp4");

const run = async () => {
  composeUp();

  try {
    await waitForStack();

    /* ---- Create user ---- */
    const ts = Date.now();
    const userName = `pathfinder_${ts}`;
    const pw = "DemoPass#42";
    const creds = await signup(userName, pw);

    /* ---- Create a chain of entities: A → B → C → D ---- */
    console.log("  Setting up entity chain A → B → C → D …");

    const eA = await fetchJson("/api/entities", {
      method: "POST",
      body: JSON.stringify({
        type: "post",
        title: "Research Lab Proposal",
        body: "Proposal to build a new AI research lab on the third floor of building A2.",
        references: [],
      }),
    }, creds.token);
    const idA = eA.entity.id;

    const eB = await fetchJson("/api/entities", {
      method: "POST",
      body: JSON.stringify({
        type: "post",
        title: "Budget Approval Document",
        body: "Finance committee approved the budget for the new research lab construction.",
        references: [idA],
      }),
    }, creds.token);
    const idB = eB.entity.id;

    const eC = await fetchJson("/api/entities", {
      method: "POST",
      body: JSON.stringify({
        type: "post",
        title: "Construction Timeline",
        body: "Construction begins in Q2 and is expected to complete by end of Q4 this year.",
        references: [idB],
      }),
    }, creds.token);
    const idC = eC.entity.id;

    const eD = await fetchJson("/api/entities", {
      method: "POST",
      body: JSON.stringify({
        type: "post",
        title: "Grand Opening Ceremony",
        body: "The grand opening of the AI research lab is scheduled for January next year.",
        references: [idC],
      }),
    }, creds.token);
    const idD = eD.entity.id;

    console.log("  4 entities created: A → B → C → D");

    /* ---- Launch browser ---- */
    await mkdir(artifactDir, { recursive: true });
    const browser = await launchBrowser();
    const page = await browser.newPage();
    page.on("dialog", async (d) => d.accept());

    /* ---- Navigate & log in ---- */
    await page.goto(frontendUrl, { waitUntil: "networkidle2" });
    await navigateToCollaborative(page);
    await loginViaUI(page, userName, pw);

    console.log("▶ Starting screencast …");
    const recorder = await page.screencast({ path: webmPath });

    /* ============================================================== */
    /*  SCENE 1 – Intro                                               */
    /* ============================================================== */
    console.log("  Scene 1: Intro");
    await showSceneTitle(
      page,
      "🔢 Deep Research — Shortest Path",
      "Find degrees of separation between entities in the knowledge graph",
      3000
    );

    /* ============================================================== */
    /*  SCENE 2 – Navigate to Research > Degree tab                   */
    /* ============================================================== */
    console.log("  Scene 2: Navigate to degree tab");
    await showOverlay(page, `👤 Logged in as ${userName}`, "#2563eb");
    await pause(1000);

    await showOverlay(page, "🔢 Opening the Research page", "#2563eb");
    await clickButtonByText(page, "🔎 Research");
    await page.waitForFunction(() =>
      document.body.textContent?.includes("Deep Research"),
      { timeout: 15_000 }
    );
    await pause(1000);

    // Switch to degree tab
    await page.evaluate(() => {
      const tab = document.querySelector('[data-research-tab="degree"]');
      if (tab) tab.click();
    });
    await pause(1000);

    await showOverlay(page, "🔢 Degree of Separation — find shortest paths in the graph", "#7c3aed");
    await pause(1500);

    /* ============================================================== */
    /*  SCENE 3 – Shortest path: A → D (3 hops)                      */
    /* ============================================================== */
    console.log("  Scene 3: Path A → D (long path)");
    await showOverlay(page, '🔢 From: "Research Lab Proposal" → To: "Grand Opening Ceremony"', "#7c3aed");
    await pause(1000);

    // Select "from" entity
    await slowType(page, "#degree-from-search", "Research Lab", 60);
    await pause(2000);
    await page.evaluate(() => {
      const results = document.querySelector("#degree-from-search-results");
      if (results) {
        const first = results.querySelector("div, li, button");
        if (first) first.click();
      }
    });
    await pause(1000);

    // Select "to" entity
    await slowType(page, "#degree-to-search", "Grand Opening", 60);
    await pause(2000);
    await page.evaluate(() => {
      const results = document.querySelector("#degree-to-search-results");
      if (results) {
        const first = results.querySelector("div, li, button");
        if (first) first.click();
      }
    });
    await pause(1000);

    // Click the degree search button
    await showOverlay(page, "🔢 Computing shortest path …", "#eab308");
    await page.evaluate(() => {
      const btn = document.querySelector("#research-degree");
      if (btn) btn.click();
    });
    await pause(3000);

    await showOverlay(page, "✅ Path found: A → B → C → D (3 degrees of separation)", "#16a34a");
    await page.evaluate(() =>
      window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" })
    );
    await pause(2000);
    await page.evaluate(() =>
      window.scrollTo({ top: 0, behavior: "smooth" })
    );
    await pause(1500);

    /* ============================================================== */
    /*  SCENE 4 – Direct connection: A → B (1 hop)                    */
    /* ============================================================== */
    console.log("  Scene 4: Path A → B (direct)");
    await showOverlay(page, '🔢 Now trying a direct connection: A → B', "#7c3aed");
    await pause(1000);

    // Clear inputs
    await clearInput(page, "#degree-from-search");
    await clearInput(page, "#degree-to-search");

    // Select "from" entity
    await slowType(page, "#degree-from-search", "Research Lab", 60);
    await pause(2000);
    await page.evaluate(() => {
      const results = document.querySelector("#degree-from-search-results");
      if (results) {
        const first = results.querySelector("div, li, button");
        if (first) first.click();
      }
    });
    await pause(1000);

    // Select "to" entity
    await slowType(page, "#degree-to-search", "Budget Approval", 60);
    await pause(2000);
    await page.evaluate(() => {
      const results = document.querySelector("#degree-to-search-results");
      if (results) {
        const first = results.querySelector("div, li, button");
        if (first) first.click();
      }
    });
    await pause(1000);

    await showOverlay(page, "🔢 Computing direct path …", "#eab308");
    await page.evaluate(() => {
      const btn = document.querySelector("#research-degree");
      if (btn) btn.click();
    });
    await pause(3000);

    await showOverlay(page, "✅ Direct: A → B (1 degree of separation)", "#16a34a");
    await pause(2500);

    /* ============================================================== */
    /*  SCENE 5 – Mid-range path: B → D (2 hops)                     */
    /* ============================================================== */
    console.log("  Scene 5: Path B → D (2 hops)");
    await showOverlay(page, '🔢 Trying mid-range path: B → D', "#7c3aed");
    await pause(1000);

    await clearInput(page, "#degree-from-search");
    await clearInput(page, "#degree-to-search");

    // Select "from" entity
    await slowType(page, "#degree-from-search", "Budget Approval", 60);
    await pause(2000);
    await page.evaluate(() => {
      const results = document.querySelector("#degree-from-search-results");
      if (results) {
        const first = results.querySelector("div, li, button");
        if (first) first.click();
      }
    });
    await pause(1000);

    // Select "to" entity
    await slowType(page, "#degree-to-search", "Grand Opening", 60);
    await pause(2000);
    await page.evaluate(() => {
      const results = document.querySelector("#degree-to-search-results");
      if (results) {
        const first = results.querySelector("div, li, button");
        if (first) first.click();
      }
    });
    await pause(1000);

    await showOverlay(page, "🔢 Computing path …", "#eab308");
    await page.evaluate(() => {
      const btn = document.querySelector("#research-degree");
      if (btn) btn.click();
    });
    await pause(3000);

    await showOverlay(page, "✅ B → C → D (2 degrees of separation)", "#16a34a");
    await page.evaluate(() =>
      window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" })
    );
    await pause(2000);
    await page.evaluate(() =>
      window.scrollTo({ top: 0, behavior: "smooth" })
    );
    await pause(1500);

    /* ============================================================== */
    /*  SCENE 6 – Outro                                               */
    /* ============================================================== */
    console.log("  Scene 6: Outro");
    await showSceneTitle(
      page,
      "Demo Complete",
      "Shortest path reveals how entities connect across the knowledge graph",
      3000
    );

    /* ---- Stop and convert ---- */
    console.log("▶ Stopping screencast …");
    await recorder.stop();
    await browser.close();
    console.log(`✔ WebM saved → ${webmPath}`);

    convertToMp4(webmPath, mp4Path);
    try { await unlink(webmPath); } catch {}

    console.log("\n🎬 Shortest path demo complete!");
  } finally {
    composeDown();
  }
};

run().catch((err) => {
  console.error("❌ Demo failed:", err);
  try { composeDown(); } catch {}
  process.exit(1);
});
