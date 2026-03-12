/**
 * Demo Video – Deep Research: Mention / References
 *
 * Demonstrates the entity reference (mention) lookup feature:
 *   • Two users create entities that cross-reference each other
 *   • Navigate to the Research page and switch to the references tab
 *   • Use the entity search widget to find entities
 *   • Display which entities reference the selected entity
 *
 * Uses SEPARATE browser pages per user (no login/logout switching).
 *
 * Usage:
 *   node backend/tests/demo-research-mention.test.mjs
 *
 * Outputs:
 *   artifacts/demo-research-mention.mp4
 */

import path from "node:path";
import { mkdir } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import {
  root, backendUrl, frontendUrl, artifactDir,
  composeUp, composeDown, waitForStack,
  fetchJson, signup,
  launchBrowser, clickButtonByText, slowType, pause, clearInput,
  showOverlay, hideOverlay, showSceneTitle,
  concatSegmentsToMp4, loginViaUI, waitForEntityByTitle,
  navigateToCollaborative,
} from "./demo-helpers.mjs";

const mp4Path = path.join(artifactDir, "demo-research-mention.mp4");

const run = async () => {
  composeUp();

  try {
    await waitForStack();

    /* ---- Create two users ---- */
    const ts = Date.now();
    const aliceName = `alice_ref_${ts}`;
    const bobName   = `bob_ref_${ts}`;
    const pw = "DemoPass#42";

    const aliceCreds = await signup(aliceName, pw);
    const bobCreds   = await signup(bobName, pw);

    /* ---- Build cross-referencing entities ---- */
    console.log("  Setting up cross-referencing entities …");

    const e1 = await fetchJson("/api/entities", {
      method: "POST",
      body: JSON.stringify({
        type: "post",
        title: "Campus Bike-Sharing Program",
        body: "A new bike-sharing program launched at the main gate with 50 bicycles available for students.",
        references: [],
      }),
    }, aliceCreds.token);
    const id1 = e1.entity.id;

    const e2 = await fetchJson("/api/entities", {
      method: "POST",
      body: JSON.stringify({
        type: "post",
        title: "Student Health & Fitness Report",
        body: "Annual fitness report shows cycling and walking are the most popular physical activities on campus.",
        references: [id1],
      }),
    }, bobCreds.token);
    const id2 = e2.entity.id;

    const e3 = await fetchJson("/api/entities", {
      method: "POST",
      body: JSON.stringify({
        type: "post",
        title: "Sustainable Transport Strategy",
        body: "The university's five-year plan to reduce car traffic by promoting bikes, shuttles, and walking paths.",
        references: [id1, id2],
      }),
    }, aliceCreds.token);
    const id3 = e3.entity.id;

    const e4 = await fetchJson("/api/entities", {
      method: "POST",
      body: JSON.stringify({
        type: "post",
        title: "Campus Shuttle Expansion",
        body: "New shuttle routes connect the dormitories to the library and engineering building.",
        references: [id3],
      }),
    }, bobCreds.token);
    const id4 = e4.entity.id;

    const e5 = await fetchJson("/api/entities", {
      method: "POST",
      body: JSON.stringify({
        type: "post",
        title: "Green Commuting Awards",
        body: "Awards ceremony recognizing students and faculty who use sustainable commuting options.",
        references: [id1, id3, id4],
      }),
    }, aliceCreds.token);
    const id5 = e5.entity.id;

    console.log("  5 entities created with cross-references");

    /* ---- Launch browser with TWO pages ---- */
    await mkdir(artifactDir, { recursive: true });
    const browser = await launchBrowser();

    const alicePage = await browser.newPage();
    const bobPage   = await browser.newPage();

    alicePage.on("dialog", async (d) => d.accept());
    bobPage.on("dialog", async (d) => d.accept());

    /* ---- Navigate & log in both users ---- */
    console.log("▶ Setting up Alice's page …");
    await alicePage.goto(frontendUrl, { waitUntil: "networkidle2" });
    await navigateToCollaborative(alicePage);
    await loginViaUI(alicePage, aliceName, pw);

    console.log("▶ Setting up Bob's page …");
    await bobPage.goto(frontendUrl, { waitUntil: "networkidle2" });
    await navigateToCollaborative(bobPage);
    await loginViaUI(bobPage, bobName, pw);

    console.log("✔ Both users logged in — starting demo");

    /* Segment tracking */
    const segments = [];
    let segIdx = 0;
    const segPath = () =>
      path.join(artifactDir, `ref-seg-${String(segIdx++).padStart(2, "0")}.webm`);

    /* ============================================================== */
    /*  SCENE 1 – Intro (Alice's page)                                */
    /* ============================================================== */
    let sp = segPath();
    let rec = await alicePage.screencast({ path: sp });
    segments.push(sp);

    console.log("  Scene 1: Intro");
    await showSceneTitle(
      alicePage,
      "🔗 Deep Research — Mentions & References",
      "Find which entities reference a given entity",
      3000
    );

    /* ============================================================== */
    /*  SCENE 2 – Alice navigates to Research > References            */
    /* ============================================================== */
    console.log("  Scene 2: Alice opens references tab");
    await showOverlay(alicePage, `👤 Alice — ${aliceName}`, "#2563eb");
    await pause(1000);

    await showOverlay(alicePage, "🔗 Opening the Research page", "#2563eb");
    await clickButtonByText(alicePage, "🔎 Research");
    await alicePage.waitForFunction(() =>
      document.body.textContent?.includes("Deep Research"),
      { timeout: 15_000 }
    );
    await pause(1000);

    // Switch to references tab
    await alicePage.evaluate(() => {
      const tab = document.querySelector('[data-research-tab="references"]');
      if (tab) tab.click();
    });
    await pause(800);

    /* ============================================================== */
    /*  SCENE 3 – Search for "Bike-Sharing" and view its references   */
    /* ============================================================== */
    console.log("  Scene 3: Search Bike-Sharing references");
    await showOverlay(alicePage, '🔗 Searching entity: "Bike-Sharing"', "#7c3aed");
    await slowType(alicePage, "#research-entity-search", "Bike", 60);
    await pause(2000);

    // Click the first matching result
    await alicePage.evaluate(() => {
      const results = document.querySelector("#research-entity-search-results");
      if (results) {
        const first = results.querySelector("div, li, button");
        if (first) first.click();
      }
    });
    await pause(1000);

    // Click the search-by-refs button
    await alicePage.evaluate(() => {
      const btn = document.querySelector("#research-by-refs");
      if (btn) btn.click();
    });
    await pause(2500);

    await showOverlay(alicePage, "✅ 3 entities reference the Bike-Sharing Program", "#16a34a");
    await pause(2500);

    await alicePage.evaluate(() =>
      window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" })
    );
    await pause(1500);
    await alicePage.evaluate(() =>
      window.scrollTo({ top: 0, behavior: "smooth" })
    );
    await pause(1000);

    /* ============================================================== */
    /*  SCENE 4 – Search for "Transport Strategy" references          */
    /* ============================================================== */
    console.log("  Scene 4: Search Transport Strategy references");
    await clearInput(alicePage, "#research-entity-search");
    await showOverlay(alicePage, '🔗 Searching entity: "Transport"', "#7c3aed");
    await slowType(alicePage, "#research-entity-search", "Transport", 60);
    await pause(2000);

    await alicePage.evaluate(() => {
      const results = document.querySelector("#research-entity-search-results");
      if (results) {
        const first = results.querySelector("div, li, button");
        if (first) first.click();
      }
    });
    await pause(1000);

    await alicePage.evaluate(() => {
      const btn = document.querySelector("#research-by-refs");
      if (btn) btn.click();
    });
    await pause(2500);

    await showOverlay(alicePage, "✅ Shuttle and Awards entities reference the Transport Strategy", "#16a34a");
    await pause(2500);

    await rec.stop();

    /* ============================================================== */
    /*  SCENE 5 – Bob's perspective (switch to Bob's page)            */
    /* ============================================================== */
    console.log("  Scene 5: Bob's perspective");
    sp = segPath();
    rec = await bobPage.screencast({ path: sp });
    segments.push(sp);

    await showSceneTitle(
      bobPage,
      "Bob's Perspective",
      `${bobName} explores references from his view`,
      2500
    );

    await showOverlay(bobPage, `👤 Bob — ${bobName}`, "#dc2626");
    await pause(800);

    await showOverlay(bobPage, "🔗 Bob opens the Research page", "#dc2626");
    await clickButtonByText(bobPage, "🔎 Research");
    await bobPage.waitForFunction(() =>
      document.body.textContent?.includes("Deep Research"),
      { timeout: 15_000 }
    );
    await pause(1000);

    // Switch to references tab
    await bobPage.evaluate(() => {
      const tab = document.querySelector('[data-research-tab="references"]');
      if (tab) tab.click();
    });
    await pause(800);

    /* ============================================================== */
    /*  SCENE 6 – Bob searches for "Shuttle" references               */
    /* ============================================================== */
    console.log("  Scene 6: Bob searches Shuttle references");
    await showOverlay(bobPage, '🔗 Searching entity: "Shuttle"', "#7c3aed");
    await slowType(bobPage, "#research-entity-search", "Shuttle", 60);
    await pause(2000);

    await bobPage.evaluate(() => {
      const results = document.querySelector("#research-entity-search-results");
      if (results) {
        const first = results.querySelector("div, li, button");
        if (first) first.click();
      }
    });
    await pause(1000);

    await bobPage.evaluate(() => {
      const btn = document.querySelector("#research-by-refs");
      if (btn) btn.click();
    });
    await pause(2500);

    await showOverlay(bobPage, "✅ Green Commuting Awards references the Shuttle Expansion", "#16a34a");
    await pause(2500);

    /* ============================================================== */
    /*  SCENE 7 – Outro                                               */
    /* ============================================================== */
    console.log("  Scene 7: Outro");
    await showSceneTitle(
      bobPage,
      "Demo Complete",
      "Entity references let you trace connections across the knowledge graph",
      3000
    );

    await rec.stop();

    /* ---- Concatenate segments and convert ---- */
    await browser.close();
    console.log(`▶ Concatenating ${segments.length} segments …`);
    await concatSegmentsToMp4(segments, mp4Path);

    console.log("\n🎬 Mention / references demo complete!");
  } finally {
    composeDown();
  }
};

run().catch((err) => {
  console.error("❌ Demo failed:", err);
  try { composeDown(); } catch {}
  process.exit(1);
});
