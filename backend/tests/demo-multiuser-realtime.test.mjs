/**
 * Demo Video – Multi-User Real-Time Collaboration
 *
 * Shows two users (Alice and Bob) interacting simultaneously:
 *   • Alice creates an entity → shows it was created
 *   • Bob follows the entity → Alice edits it → Bob gets a notification
 *   • Both users comment on the entity in a discussion thread
 *   • Perspective banners clearly mark which user is on screen
 *
 * Uses SEPARATE browser pages per user (no login/logout switching).
 * Segments are recorded from each page and concatenated into the
 * final MP4 with ffmpeg.
 *
 * Usage:
 *   node backend/tests/demo-multiuser-realtime.test.mjs
 *
 * Outputs:
 *   artifacts/demo-multiuser-realtime.mp4
 */

import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { mkdir } from "node:fs/promises";
import {
  root, backendUrl, frontendUrl, artifactDir,
  composeUp, composeDown, waitForStack,
  fetchJson, signup,
  launchBrowser, clickButtonByText, slowType, pause,
  showOverlay, hideOverlay, showSceneTitle,
  concatSegmentsToMp4, loginViaUI, waitForEntityByTitle,
  navigateToCollaborative,
} from "./demo-helpers.mjs";

const mp4Path = path.join(artifactDir, "demo-multiuser-realtime.mp4");

const run = async () => {
  composeUp();

  try {
    await waitForStack();

    /* ---- Create users via API ---- */
    const ts = Date.now();
    const aliceName = `alice_${ts}`;
    const bobName   = `bob_${ts}`;
    const pw        = "DemoPass#42";

    const aliceCreds = await signup(aliceName, pw);
    const bobCreds   = await signup(bobName, pw);

    /* ---- Launch browser with TWO pages ---- */
    await mkdir(artifactDir, { recursive: true });
    const browser = await launchBrowser();

    const alicePage = await browser.newPage();
    const bobPage   = await browser.newPage();

    alicePage.on("dialog", async (d) => d.accept());
    bobPage.on("dialog", async (d) => d.accept());

    /* ---- Setup: navigate both pages & log in once ---- */
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
      path.join(artifactDir, `mu-seg-${String(segIdx++).padStart(2, "0")}.webm`);

    /* ============================================================== */
    /*  SCENE 1 – Introduction (shown on Alice's page)                */
    /* ============================================================== */
    let sp = segPath();
    let rec = await alicePage.screencast({ path: sp });
    segments.push(sp);

    await showSceneTitle(
      alicePage,
      "Multi-User Real-Time Collaboration",
      "Demonstrating live updates between Alice and Bob",
      3000
    );

    /* ============================================================== */
    /*  SCENE 2 – Alice creates an entity                             */
    /* ============================================================== */
    console.log("  Scene 2: Alice creates an entity");
    await showOverlay(alicePage, `👤 ALICE — Logged in as ${aliceName}`, "#2563eb");
    await pause(1500);

    await showOverlay(alicePage, "👤 ALICE — Creating a new discussion entity", "#2563eb");
    await pause(800);
    await clickButtonByText(alicePage, "📡 Entities");
    await alicePage.waitForSelector("#entity-title", { timeout: 15_000 });
    await pause(500);

    await slowType(alicePage, "#entity-title", "Campus WiFi Improvements", 45);
    await slowType(
      alicePage,
      "#entity-body",
      "The library WiFi has been slow during peak hours. Let's discuss solutions.",
      25
    );
    await pause(500);
    await alicePage.click("#create-entity");
    await showOverlay(alicePage, "👤 ALICE — Entity created! Waiting for it to appear…", "#16a34a");
    const entityId = await waitForEntityByTitle("Campus WiFi Improvements", 40_000);
    await pause(1500);

    // Scroll to see the new entity
    await alicePage.evaluate(() =>
      window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" })
    );
    await pause(1500);

    await rec.stop();

    /* ============================================================== */
    /*  SCENE 3 – Bob sees Alice's entity (Bob's page)                */
    /* ============================================================== */
    console.log("  Scene 3: Bob views Alice's entity");
    sp = segPath();
    rec = await bobPage.screencast({ path: sp });
    segments.push(sp);

    await showSceneTitle(
      bobPage,
      "Bob's Perspective",
      `${bobName} sees Alice's entity appear in real time`,
      2500
    );

    await showOverlay(bobPage, `👤 BOB — Logged in as ${bobName}`, "#dc2626");
    await pause(1000);

    await showOverlay(bobPage, "👤 BOB — Checking entities (Alice's post should be here)", "#dc2626");
    await clickButtonByText(bobPage, "📡 Entities");
    await pause(1500);
    await bobPage.evaluate(() =>
      window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" })
    );
    await pause(1000);
    await bobPage.waitForFunction(
      (title) => document.body.textContent?.includes(title),
      { timeout: 15_000 },
      "Campus WiFi Improvements"
    );
    await showOverlay(bobPage, "👤 BOB — Alice's entity is visible! ✓", "#16a34a");
    await pause(2000);

    /* ============================================================== */
    /*  SCENE 4 – Bob follows the entity                              */
    /* ============================================================== */
    console.log("  Scene 4: Bob follows the entity");
    await showOverlay(bobPage, "👤 BOB — Following Alice's entity for notifications", "#dc2626");
    await fetchJson(
      `/api/entities/${entityId}/follow`,
      { method: "POST" },
      bobCreds.token
    );
    await showOverlay(bobPage, "👤 BOB — Now following 'Campus WiFi Improvements' ✓", "#16a34a");
    await pause(2000);

    await rec.stop();

    /* ============================================================== */
    /*  SCENE 5 – Alice adds a comment (Alice's page)                 */
    /* ============================================================== */
    console.log("  Scene 5: Alice comments");
    sp = segPath();
    rec = await alicePage.screencast({ path: sp });
    segments.push(sp);

    await showSceneTitle(
      alicePage,
      "Back to Alice",
      "Alice adds a comment — Bob will be notified",
      2500
    );

    await showOverlay(alicePage, "👤 ALICE — Adding a comment on the entity", "#2563eb");
    await fetchJson(
      "/api/entities",
      {
        method: "POST",
        body: JSON.stringify({
          type: "comment",
          title: "",
          body: "I noticed the issue is worst in the 2nd floor reading room. Maybe we need a new router there?",
          parentEntityId: entityId,
          references: [entityId],
        }),
      },
      aliceCreds.token
    );
    await showOverlay(alicePage, "👤 ALICE — Comment posted! Bob should get a notification", "#16a34a");
    await pause(1500);

    await clickButtonByText(alicePage, "📰 Activity");
    await alicePage.waitForFunction(() =>
      document.body.textContent?.includes("Activity Feed"),
      { timeout: 15_000 }
    );
    await pause(2000);

    await rec.stop();

    /* ============================================================== */
    /*  SCENE 6 – Bob checks notifications (Bob's page)               */
    /* ============================================================== */
    console.log("  Scene 6: Bob checks notifications");
    sp = segPath();
    rec = await bobPage.screencast({ path: sp });
    segments.push(sp);

    await showSceneTitle(
      bobPage,
      "Bob's Perspective",
      "Bob checks notifications — should see Alice's comment alert",
      2500
    );

    await showOverlay(bobPage, "👤 BOB — Checking notifications", "#dc2626");
    await clickButtonByText(bobPage, "🔔 Notifications");
    await bobPage.waitForFunction(() =>
      document.body.textContent?.includes("Notifications"),
      { timeout: 15_000 }
    );
    await pause(2500);
    await bobPage.evaluate(() =>
      window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" })
    );
    await pause(1500);
    await showOverlay(bobPage, "👤 BOB — Notification received from Alice's comment! ✓", "#16a34a");
    await pause(2000);

    /* ============================================================== */
    /*  SCENE 7 – Bob replies                                         */
    /* ============================================================== */
    console.log("  Scene 7: Bob replies");
    await showOverlay(bobPage, "👤 BOB — Replying to the discussion", "#dc2626");

    await fetchJson(
      "/api/entities",
      {
        method: "POST",
        body: JSON.stringify({
          type: "comment",
          title: "",
          body: "Agreed! The 3rd floor lab also needs better coverage. I'll check with IT.",
          parentEntityId: entityId,
          references: [entityId],
        }),
      },
      bobCreds.token
    );
    await showOverlay(bobPage, "👤 BOB — Reply posted! ✓", "#16a34a");
    await pause(1500);

    await clickButtonByText(bobPage, "📰 Activity");
    await bobPage.waitForFunction(() =>
      document.body.textContent?.includes("Activity Feed"),
      { timeout: 15_000 }
    );
    await showOverlay(bobPage, "👤 BOB — Activity feed shows the full conversation", "#dc2626");
    await pause(2500);
    await bobPage.evaluate(() =>
      window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" })
    );
    await pause(1500);

    await rec.stop();

    /* ============================================================== */
    /*  SCENE 8 – Alice edits entity (Alice's page)                   */
    /* ============================================================== */
    console.log("  Scene 8: Alice edits entity");
    sp = segPath();
    rec = await alicePage.screencast({ path: sp });
    segments.push(sp);

    await showSceneTitle(
      alicePage,
      "Back to Alice",
      "Alice updates the entity based on Bob's feedback",
      2500
    );

    await showOverlay(alicePage, "👤 ALICE — Updating entity with Bob's info", "#2563eb");
    await fetchJson(
      `/api/entities/${entityId}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          body: "Library WiFi is slow at peak hours. UPDATE: 2nd floor reading room and 3rd floor lab affected. IT contacted.",
        }),
      },
      aliceCreds.token
    );
    await showOverlay(alicePage, "👤 ALICE — Entity updated! Followers notified ✓", "#16a34a");
    await pause(1500);

    await clickButtonByText(alicePage, "📰 Activity");
    await alicePage.waitForFunction(() =>
      document.body.textContent?.includes("Activity Feed"),
      { timeout: 15_000 }
    );
    await showOverlay(alicePage, "👤 ALICE — Complete collaboration history", "#2563eb");
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
    /*  SCENE 9 – Outro                                               */
    /* ============================================================== */
    await showSceneTitle(
      alicePage,
      "Demo Complete",
      "Multi-user real-time: entity creation, following, commenting, notifications",
      3000
    );

    await rec.stop();

    /* ---- Concatenate segments and convert ---- */
    await browser.close();
    console.log(`▶ Concatenating ${segments.length} segments …`);
    await concatSegmentsToMp4(segments, mp4Path);

    console.log("\n🎬 Multi-user real-time demo complete!");
  } finally {
    composeDown();
  }
};

run().catch((err) => {
  console.error("❌ Demo failed:", err);
  try { composeDown(); } catch {}
  process.exit(1);
});
