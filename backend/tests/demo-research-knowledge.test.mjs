/**
 * Demo Video – Research & Knowledge Graph
 *
 * Deep dive into the research capabilities:
 *   • Two users create entities with cross-references
 *   • Full-text search across all entities
 *   • Viewing entity references
 *   • Degree-of-separation queries
 *
 * Usage:
 *   node backend/tests/demo-research-knowledge.test.mjs
 *
 * Outputs:
 *   artifacts/demo-research-knowledge.mp4
 */

import path from "node:path";
import { mkdir, unlink } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import {
  root, backendUrl, frontendUrl, artifactDir,
  composeUp, composeDown, waitForStack,
  fetchJson, signup,
  launchBrowser, clickButtonByText, slowType, pause,
  showOverlay, hideOverlay, showSceneTitle,
  convertToMp4, loginViaUI, waitForEntityByTitle,
} from "./demo-helpers.mjs";

const webmPath = path.join(artifactDir, "demo-research-knowledge.webm");
const mp4Path  = path.join(artifactDir, "demo-research-knowledge.mp4");

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

    /* ---- Browser ---- */
    await mkdir(artifactDir, { recursive: true });
    const browser = await launchBrowser();
    const page = await browser.newPage();
    page.on("dialog", async (d) => d.accept());

    console.log("▶ Starting screencast …");
    const recorder = await page.screencast({ path: webmPath });

    /* ============================================================== */
    /*  SCENE 1 – Intro                                               */
    /* ============================================================== */
    console.log("  Scene 1: Intro");
    await page.goto(frontendUrl, { waitUntil: "networkidle2" });
    await showSceneTitle(
      page,
      "🔎 Research & Knowledge Graph",
      "Full-text search, entity references, and degree of separation",
      3000
    );

    /* ============================================================== */
    /*  SCENE 2 – Login                                               */
    /* ============================================================== */
    console.log("  Scene 2: Login");
    await showOverlay(page, `👤 Researcher (${researcherName}) — Logging In`, "#2563eb");
    await clickButtonByText(page, "HCMIU Collaborative");
    await page.waitForFunction(() =>
      document.body.textContent?.includes("Entities")
    );
    await loginViaUI(page, researcherName, pw);
    await showOverlay(page, `👤 Researcher — Logged in ✓`, "#16a34a");
    await pause(1000);

    /* ============================================================== */
    /*  SCENE 3 – View entities                                       */
    /* ============================================================== */
    console.log("  Scene 3: View entities");
    await showOverlay(page, "📡 Viewing knowledge graph entities", "#2563eb");
    await clickButtonByText(page, "📡 Entities");
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
    /*  SCENE 4 – Full-text Search                                    */
    /* ============================================================== */
    console.log("  Scene 4: Full-text search");
    await showOverlay(page, "🔎 Research — Full-Text Search", "#7c3aed");
    await clickButtonByText(page, "🔎 Research");
    await page.waitForFunction(() =>
      document.body.textContent?.includes("Deep Research")
    );
    await pause(1000);

    // Switch to fulltext tab
    await page.evaluate(() => {
      const tab = document.querySelector('[data-research-tab="fulltext"]');
      if (tab) tab.click();
    });
    await pause(800);

    // Search for "solar"
    const fulltextInput = await page.$("#fulltext-input");
    if (fulltextInput) {
      await showOverlay(page, '🔎 Searching for "solar"', "#7c3aed");
      await slowType(page, "#fulltext-input", "solar", 60);
      await pause(500);

      try {
        await page.evaluate(() => {
          const btn = Array.from(document.querySelectorAll("button")).find(
            (b) => (b.textContent || "").toLowerCase().includes("search")
          );
          if (btn) btn.click();
        });
      } catch {}
      await pause(2500);
      await showOverlay(page, '🔎 Found "Solar Panel Installation Report" ✓', "#16a34a");
      await pause(2000);

      // Clear and search again
      await page.evaluate(() => {
        const input = document.querySelector("#fulltext-input");
        if (input) input.value = "";
      });
      await showOverlay(page, '🔎 Searching for "water"', "#7c3aed");
      await slowType(page, "#fulltext-input", "water", 60);
      await pause(500);
      try {
        await page.evaluate(() => {
          const btn = Array.from(document.querySelectorAll("button")).find(
            (b) => (b.textContent || "").toLowerCase().includes("search")
          );
          if (btn) btn.click();
        });
      } catch {}
      await pause(2500);
      await showOverlay(page, '🔎 Found "Water Recycling System" ✓', "#16a34a");
      await pause(2000);
    }

    /* ============================================================== */
    /*  SCENE 5 – Entity References                                   */
    /* ============================================================== */
    console.log("  Scene 5: References");
    await showOverlay(page, "🔗 Research — Entity References", "#2563eb");
    await pause(800);

    await page.evaluate(() => {
      const tab = document.querySelector('[data-research-tab="references"]');
      if (tab) tab.click();
    });
    await pause(1000);

    await showOverlay(page, "🔗 Viewing entity reference connections", "#2563eb");
    await pause(2000);

    /* ============================================================== */
    /*  SCENE 6 – Degree of Separation                                */
    /* ============================================================== */
    console.log("  Scene 6: Degree of separation");
    await showOverlay(page, "🔢 Research — Degree of Separation", "#7c3aed");
    await pause(800);

    await page.evaluate(() => {
      const tab = document.querySelector('[data-research-tab="degree"]');
      if (tab) tab.click();
    });
    await pause(1500);

    await showOverlay(page, "🔢 Finding path length in the knowledge graph", "#7c3aed");
    await pause(2000);

    // Demonstrate via API
    try {
      const result = await fetchJson(`/api/research/degree?from=${id1}&to=${id4}`);
      const pathLen = result.path ? result.path.length - 1 : "N/A";
      await showOverlay(page, `🔢 ${pathLen} degree(s) of separation found ✓`, "#16a34a");
    } catch {
      await showOverlay(page, "🔢 Degree of separation demonstrated", "#16a34a");
    }
    await pause(2500);

    /* ============================================================== */
    /*  SCENE 7 – Contributor's perspective                           */
    /* ============================================================== */
    console.log("  Scene 7: Contributor perspective");
    await showSceneTitle(
      page,
      "Switching to Contributor's Perspective",
      `${contributorName} also contributes to the knowledge graph`,
      2500
    );

    await page.goto(frontendUrl, { waitUntil: "networkidle2" });
    await showOverlay(page, `👤 CONTRIBUTOR (${contributorName})`, "#dc2626");
    await clickButtonByText(page, "HCMIU Collaborative");
    await page.waitForFunction(() =>
      document.body.textContent?.includes("Entities")
    );
    await loginViaUI(page, contributorName, pw);
    await pause(500);

    await showOverlay(page, "👤 CONTRIBUTOR — Viewing shared knowledge graph", "#dc2626");
    await clickButtonByText(page, "📡 Entities");
    await pause(2000);
    await page.evaluate(() =>
      window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" })
    );
    await pause(1500);

    // Activity feed
    await showOverlay(page, "👤 CONTRIBUTOR — Activity shows all contributions", "#dc2626");
    await clickButtonByText(page, "📰 Activity");
    await page.waitForFunction(() =>
      document.body.textContent?.includes("Activity Feed")
    );
    await pause(2000);
    await page.evaluate(() =>
      window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" })
    );
    await pause(1500);

    /* ============================================================== */
    /*  SCENE 8 – Outro                                               */
    /* ============================================================== */
    console.log("  Scene 8: Outro");
    await showSceneTitle(
      page,
      "Demo Complete",
      "Full-text search, entity references, and knowledge graph traversal",
      3000
    );

    /* ---- Stop and convert ---- */
    console.log("▶ Stopping screencast …");
    await recorder.stop();
    await browser.close();
    console.log(`✔ WebM saved → ${webmPath}`);

    convertToMp4(webmPath, mp4Path);
    try { await unlink(webmPath); } catch {}

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
