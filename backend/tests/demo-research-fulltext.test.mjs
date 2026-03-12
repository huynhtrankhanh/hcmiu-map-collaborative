/**
 * Demo Video – Deep Research: Full-Text Search
 *
 * Demonstrates the full-text search capability across entities:
 *   • Create several entities covering campus topics
 *   • Search for different terms and show matching results
 *   • Show empty results for a term with no matches
 *   • Clear and repeat searches
 *
 * Usage:
 *   node backend/tests/demo-research-fulltext.test.mjs
 *
 * Outputs:
 *   artifacts/demo-research-fulltext.mp4
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

const webmPath = path.join(artifactDir, "demo-research-fulltext.webm");
const mp4Path  = path.join(artifactDir, "demo-research-fulltext.mp4");

const run = async () => {
  composeUp();

  try {
    await waitForStack();

    /* ---- Create user ---- */
    const ts = Date.now();
    const userName = `researcher_ft_${ts}`;
    const pw = "DemoPass#42";
    const creds = await signup(userName, pw);

    /* ---- Create entities covering various campus topics ---- */
    console.log("  Setting up entities …");

    await fetchJson("/api/entities", {
      method: "POST",
      body: JSON.stringify({
        type: "post",
        title: "Solar Energy on Campus",
        body: "The university installed solar panels on rooftops of buildings A1 and A2, reducing electricity costs by 30%.",
        references: [],
      }),
    }, creds.token);

    await fetchJson("/api/entities", {
      method: "POST",
      body: JSON.stringify({
        type: "post",
        title: "Campus Library Renovation",
        body: "The main library underwent a major renovation including new study rooms, digital archives, and a café.",
        references: [],
      }),
    }, creds.token);

    await fetchJson("/api/entities", {
      method: "POST",
      body: JSON.stringify({
        type: "post",
        title: "Recycling Program Update",
        body: "Campus recycling bins were upgraded. Composting stations added near the cafeteria and dormitories.",
        references: [],
      }),
    }, creds.token);

    await fetchJson("/api/entities", {
      method: "POST",
      body: JSON.stringify({
        type: "post",
        title: "Student Transportation Survey",
        body: "Survey results show 60% of students prefer bicycles, 25% use the campus shuttle, and 15% drive.",
        references: [],
      }),
    }, creds.token);

    await fetchJson("/api/entities", {
      method: "POST",
      body: JSON.stringify({
        type: "post",
        title: "Green Campus Award Ceremony",
        body: "The university won the national Green Campus award for its solar and recycling initiatives.",
        references: [],
      }),
    }, creds.token);

    console.log("  5 entities created");

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
      "🔎 Deep Research — Full-Text Search",
      "Search across all entities by keyword",
      3000
    );

    /* ============================================================== */
    /*  SCENE 2 – Navigate to Research page                           */
    /* ============================================================== */
    console.log("  Scene 2: Navigate to Research");
    await showOverlay(page, `👤 Logged in as ${userName}`, "#2563eb");
    await pause(1000);

    await showOverlay(page, "🔎 Opening the Research page", "#2563eb");
    await clickButtonByText(page, "🔎 Research");
    await page.waitForFunction(() =>
      document.body.textContent?.includes("Deep Research"),
      { timeout: 15_000 }
    );
    await pause(1000);

    // Switch to fulltext tab
    await researchTabSwitch(page, "fulltext");
    await pause(800);

    /* ============================================================== */
    /*  SCENE 3 – Search for "solar"                                  */
    /* ============================================================== */
    console.log("  Scene 3: Search for 'solar'");
    await showOverlay(page, '🔎 Searching for "solar"', "#7c3aed");
    await slowType(page, "#research-fulltext", "solar", 60);
    await pause(500);
    await clickSearchButton(page);
    await pause(2500);
    await showOverlay(page, '✅ Found "Solar Energy on Campus" and "Green Campus Award Ceremony"', "#16a34a");
    await pause(2500);

    /* ============================================================== */
    /*  SCENE 4 – Search for "library"                                */
    /* ============================================================== */
    console.log("  Scene 4: Search for 'library'");
    await clearInput(page, "#research-fulltext");
    await showOverlay(page, '🔎 Searching for "library"', "#7c3aed");
    await slowType(page, "#research-fulltext", "library", 60);
    await pause(500);
    await clickSearchButton(page);
    await pause(2500);
    await showOverlay(page, '✅ Found "Campus Library Renovation"', "#16a34a");
    await pause(2500);

    /* ============================================================== */
    /*  SCENE 5 – Search for "recycling"                              */
    /* ============================================================== */
    console.log("  Scene 5: Search for 'recycling'");
    await clearInput(page, "#research-fulltext");
    await showOverlay(page, '🔎 Searching for "recycling"', "#7c3aed");
    await slowType(page, "#research-fulltext", "recycling", 60);
    await pause(500);
    await clickSearchButton(page);
    await pause(2500);
    await showOverlay(page, '✅ Found "Recycling Program Update" and "Green Campus Award Ceremony"', "#16a34a");
    await pause(2500);

    /* ============================================================== */
    /*  SCENE 6 – Empty results for unknown term                      */
    /* ============================================================== */
    console.log("  Scene 6: Empty search");
    await clearInput(page, "#research-fulltext");
    await showOverlay(page, '🔎 Searching for "quantum" (no matches expected)', "#7c3aed");
    await slowType(page, "#research-fulltext", "quantum", 60);
    await pause(500);
    await clickSearchButton(page);
    await pause(2500);
    await showOverlay(page, "❌ No results — term not found in any entity", "#dc2626");
    await pause(2500);

    /* ============================================================== */
    /*  SCENE 7 – One more search to wrap up                          */
    /* ============================================================== */
    console.log("  Scene 7: Search for 'campus'");
    await clearInput(page, "#research-fulltext");
    await showOverlay(page, '🔎 Searching for "campus" — broad term', "#7c3aed");
    await slowType(page, "#research-fulltext", "campus", 60);
    await pause(500);
    await clickSearchButton(page);
    await pause(2500);
    await showOverlay(page, "✅ Multiple entities match the broad term", "#16a34a");
    await page.evaluate(() =>
      window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" })
    );
    await pause(1500);
    await page.evaluate(() =>
      window.scrollTo({ top: 0, behavior: "smooth" })
    );
    await pause(1500);

    /* ============================================================== */
    /*  SCENE 8 – Outro                                               */
    /* ============================================================== */
    console.log("  Scene 8: Outro");
    await showSceneTitle(
      page,
      "Demo Complete",
      "Full-text search finds entities by any keyword in their title or body",
      3000
    );

    /* ---- Stop and convert ---- */
    console.log("▶ Stopping screencast …");
    await recorder.stop();
    await browser.close();
    console.log(`✔ WebM saved → ${webmPath}`);

    convertToMp4(webmPath, mp4Path);
    try { await unlink(webmPath); } catch {}

    console.log("\n🎬 Full-text search demo complete!");
  } finally {
    composeDown();
  }
};

/* ---- Helpers local to this script ---- */

async function researchTabSwitch(page, tabName) {
  await page.evaluate((name) => {
    const tab = document.querySelector(`[data-research-tab="${name}"]`);
    if (tab) tab.click();
  }, tabName);
}

async function clickSearchButton(page) {
  try {
    await page.evaluate(() => {
      const btn =
        document.querySelector("#research-fulltext-btn") ||
        Array.from(document.querySelectorAll("button")).find(
          (b) => (b.textContent || "").toLowerCase().includes("search")
        );
      if (btn) btn.click();
    });
  } catch { /* button may not exist yet; the demo continues gracefully */ }
}

run().catch((err) => {
  console.error("❌ Demo failed:", err);
  try { composeDown(); } catch {}
  process.exit(1);
});
