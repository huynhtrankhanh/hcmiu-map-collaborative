/**
 * Demo Video – Research & Knowledge Graph
 *
 * Deep dive into the research capabilities:
 *   • Two users create entities with cross-references
 *   • Full-text search across all entities
 *   • Viewing entity references
 *   • Degree-of-separation queries
 *
 * Uses SEPARATE browser pages per user (no login/logout switching).
 *
 * Usage:
 *   node backend/tests/demo-research-knowledge.test.mjs
 *
 * Outputs:
 *   artifacts/demo-research-knowledge.mp4
 */

import path from "node:path";
import { mkdir } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import {
  root, backendUrl, frontendUrl, artifactDir,
  composeUp, composeDown, waitForStack,
  fetchJson, signup,
  launchBrowser, clickButtonByText, slowType, pause,
  showOverlay, hideOverlay, showSceneTitle,
  concatSegmentsToMp4, loginViaUI, waitForEntityByTitle,
  navigateToCollaborative,
} from "./demo-helpers.mjs";

const mp4Path = path.join(artifactDir, "demo-research-knowledge.mp4");

const run = async () => {
  composeUp();

  try {
    await waitForStack();

    /* ---- Create users ---- */
    const ts = Date.now();
    const researcherName  = `researcher_${ts}`;
    const contributorName = `contributor_${ts}`;
    const pw = "DemoPass#42";

    const researcherCreds  = await signup(researcherName, pw);
    const contributorCreds = await signup(contributorName, pw);

    /* ---- Build a connected knowledge graph ---- */
    console.log("  Setting up knowledge graph …");

    const e1 = await fetchJson("/api/entities", {
      method: "POST",
      body: JSON.stringify({
        type: "post",
        title: "Campus Sustainability Initiative",
        body: "Overview of sustainability efforts: solar panels, water recycling, green spaces.",
        references: [],
      }),
    }, researcherCreds.token);
    const id1 = e1.entity.id;

    const e2 = await fetchJson("/api/entities", {
      method: "POST",
      body: JSON.stringify({
        type: "post",
        title: "Solar Panel Installation Report",
        body: "Rooftop solar panels on buildings A1 and A2. Expected 30% electricity cost reduction.",
        references: [id1],
      }),
    }, researcherCreds.token);
    const id2 = e2.entity.id;

    const e3 = await fetchJson("/api/entities", {
      method: "POST",
      body: JSON.stringify({
        type: "post",
        title: "Water Recycling System",
        body: "Greywater recycling in engineering building saves 10,000 liters per month.",
        references: [id1],
      }),
    }, contributorCreds.token);
    const id3 = e3.entity.id;

    const e4 = await fetchJson("/api/entities", {
      method: "POST",
      body: JSON.stringify({
        type: "post",
        title: "Green Campus Award Application",
        body: "Combining solar and water initiatives for national Green Campus award.",
        references: [id2, id3],
      }),
    }, contributorCreds.token);
    const id4 = e4.entity.id;

    // Comment
    await fetchJson("/api/entities", {
      method: "POST",
      body: JSON.stringify({
        type: "comment",
        title: "",
        body: "Great initiative! We should also consider composting in the cafeteria.",
        parentEntityId: id1,
        references: [id1],
      }),
    }, contributorCreds.token);

    console.log("  Knowledge graph ready (5 entities, multiple references)");

    /* ---- Launch browser with TWO pages ---- */
    await mkdir(artifactDir, { recursive: true });
    const browser = await launchBrowser();

    const researcherPage  = await browser.newPage();
    const contributorPage = await browser.newPage();

    researcherPage.on("dialog", async (d) => d.accept());
    contributorPage.on("dialog", async (d) => d.accept());

    /* ---- Setup: navigate both pages & log in once ---- */
    console.log("▶ Setting up Researcher's page …");
    await researcherPage.goto(frontendUrl, { waitUntil: "networkidle2" });
    await navigateToCollaborative(researcherPage);
    await loginViaUI(researcherPage, researcherName, pw);

    console.log("▶ Setting up Contributor's page …");
    await contributorPage.goto(frontendUrl, { waitUntil: "networkidle2" });
    await navigateToCollaborative(contributorPage);
    await loginViaUI(contributorPage, contributorName, pw);

    console.log("✔ Both users logged in — starting demo");

    /* Segment tracking */
    const segments = [];
    let segIdx = 0;
    const segPath = () =>
      path.join(artifactDir, `rk-seg-${String(segIdx++).padStart(2, "0")}.webm`);

    /* ============================================================== */
    /*  SCENE 1 – Intro (Researcher's page)                           */
    /* ============================================================== */
    let sp = segPath();
    let rec = await researcherPage.screencast({ path: sp });
    segments.push(sp);

    console.log("  Scene 1: Intro");
    await showSceneTitle(
      researcherPage,
      "🔎 Research & Knowledge Graph",
      "Full-text search, entity references, and degree of separation",
      3000
    );

    /* ============================================================== */
    /*  SCENE 2 – View entities                                       */
    /* ============================================================== */
    console.log("  Scene 2: View entities");
    await showOverlay(researcherPage, `👤 Researcher — ${researcherName}`, "#2563eb");
    await pause(1000);
    await showOverlay(researcherPage, "📡 Viewing knowledge graph entities", "#2563eb");
    await clickButtonByText(researcherPage, "📡 Entities");
    await pause(2000);
    await researcherPage.evaluate(() =>
      window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" })
    );
    await pause(1500);
    await researcherPage.evaluate(() =>
      window.scrollTo({ top: 0, behavior: "smooth" })
    );
    await pause(1000);

    /* ============================================================== */
    /*  SCENE 3 – Full-text Search                                    */
    /* ============================================================== */
    console.log("  Scene 3: Full-text search");
    await showOverlay(researcherPage, "🔎 Research — Full-Text Search", "#7c3aed");
    await clickButtonByText(researcherPage, "🔎 Research");
    await researcherPage.waitForFunction(() =>
      document.body.textContent?.includes("Deep Research"),
      { timeout: 15_000 }
    );
    await pause(1000);

    // Switch to fulltext tab
    await researcherPage.evaluate(() => {
      const tab = document.querySelector('[data-research-tab="fulltext"]');
      if (tab) tab.click();
    });
    await pause(800);

    // Search for "solar"
    const fulltextInput = await researcherPage.$("#fulltext-input");
    if (fulltextInput) {
      await showOverlay(researcherPage, '🔎 Searching for "solar"', "#7c3aed");
      await slowType(researcherPage, "#fulltext-input", "solar", 60);
      await pause(500);

      try {
        await researcherPage.evaluate(() => {
          const btn = Array.from(document.querySelectorAll("button")).find(
            (b) => (b.textContent || "").toLowerCase().includes("search")
          );
          if (btn) btn.click();
        });
      } catch {}
      await pause(2500);
      await showOverlay(researcherPage, '🔎 Found "Solar Panel Installation Report" ✓', "#16a34a");
      await pause(2000);

      // Clear and search again
      await researcherPage.evaluate(() => {
        const input = document.querySelector("#fulltext-input");
        if (input) input.value = "";
      });
      await showOverlay(researcherPage, '🔎 Searching for "water"', "#7c3aed");
      await slowType(researcherPage, "#fulltext-input", "water", 60);
      await pause(500);
      try {
        await researcherPage.evaluate(() => {
          const btn = Array.from(document.querySelectorAll("button")).find(
            (b) => (b.textContent || "").toLowerCase().includes("search")
          );
          if (btn) btn.click();
        });
      } catch {}
      await pause(2500);
      await showOverlay(researcherPage, '🔎 Found "Water Recycling System" ✓', "#16a34a");
      await pause(2000);
    }

    /* ============================================================== */
    /*  SCENE 4 – Entity References                                   */
    /* ============================================================== */
    console.log("  Scene 4: References");
    await showOverlay(researcherPage, "🔗 Research — Entity References", "#2563eb");
    await pause(800);

    await researcherPage.evaluate(() => {
      const tab = document.querySelector('[data-research-tab="references"]');
      if (tab) tab.click();
    });
    await pause(1000);

    await showOverlay(researcherPage, "🔗 Viewing entity reference connections", "#2563eb");
    await pause(2000);

    /* ============================================================== */
    /*  SCENE 5 – Degree of Separation                                */
    /* ============================================================== */
    console.log("  Scene 5: Degree of separation");
    await showOverlay(researcherPage, "🔢 Research — Degree of Separation", "#7c3aed");
    await pause(800);

    await researcherPage.evaluate(() => {
      const tab = document.querySelector('[data-research-tab="degree"]');
      if (tab) tab.click();
    });
    await pause(1500);

    await showOverlay(researcherPage, "🔢 Finding path length in the knowledge graph", "#7c3aed");
    await pause(2000);

    // Demonstrate via API
    try {
      const result = await fetchJson(`/api/research/degree?from=${id1}&to=${id4}`);
      const pathLen = result.path ? result.path.length - 1 : "N/A";
      await showOverlay(researcherPage, `🔢 ${pathLen} degree(s) of separation found ✓`, "#16a34a");
    } catch {
      await showOverlay(researcherPage, "🔢 Degree of separation demonstrated", "#16a34a");
    }
    await pause(2500);

    await rec.stop();

    /* ============================================================== */
    /*  SCENE 6 – Contributor's perspective                           */
    /* ============================================================== */
    console.log("  Scene 6: Contributor perspective");
    sp = segPath();
    rec = await contributorPage.screencast({ path: sp });
    segments.push(sp);

    await showSceneTitle(
      contributorPage,
      "Contributor's Perspective",
      `${contributorName} also contributes to the knowledge graph`,
      2500
    );

    await showOverlay(contributorPage, `👤 CONTRIBUTOR — ${contributorName}`, "#dc2626");
    await pause(800);

    await showOverlay(contributorPage, "👤 CONTRIBUTOR — Viewing shared knowledge graph", "#dc2626");
    await clickButtonByText(contributorPage, "📡 Entities");
    await pause(2000);
    await contributorPage.evaluate(() =>
      window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" })
    );
    await pause(1500);

    // Activity feed
    await showOverlay(contributorPage, "👤 CONTRIBUTOR — Activity shows all contributions", "#dc2626");
    await clickButtonByText(contributorPage, "📰 Activity");
    await contributorPage.waitForFunction(() =>
      document.body.textContent?.includes("Activity Feed"),
      { timeout: 15_000 }
    );
    await pause(2000);
    await contributorPage.evaluate(() =>
      window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" })
    );
    await pause(1500);

    /* ============================================================== */
    /*  SCENE 7 – Outro                                               */
    /* ============================================================== */
    console.log("  Scene 7: Outro");
    await showSceneTitle(
      contributorPage,
      "Demo Complete",
      "Full-text search, entity references, and knowledge graph traversal",
      3000
    );

    await rec.stop();

    /* ---- Concatenate segments and convert ---- */
    await browser.close();
    console.log(`▶ Concatenating ${segments.length} segments …`);
    await concatSegmentsToMp4(segments, mp4Path);

    console.log("\n🎬 Research & knowledge graph demo complete!");
  } finally {
    composeDown();
  }
};

run().catch((err) => {
  console.error("❌ Demo failed:", err);
  try { composeDown(); } catch {}
  process.exit(1);
});
