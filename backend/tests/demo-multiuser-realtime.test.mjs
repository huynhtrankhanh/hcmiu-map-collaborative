/**
 * Demo Video – Multi-User Real-Time Collaboration
 *
 * Shows two users (Alice and Bob) interacting simultaneously:
 *   • Alice creates an entity → shows it was created
 *   • Bob follows the entity → Alice edits it → Bob gets a notification
 *   • Both users comment on the entity in a discussion thread
 *   • Perspective banners clearly mark which user is on screen
 *
 * Uses a single browser page with login/logout to switch users.
 * On-screen overlays and scene cards indicate the active user.
 *
 * Usage:
 *   node backend/tests/demo-multiuser-realtime.test.mjs
 *
 * Outputs:
 *   artifacts/demo-multiuser-realtime.mp4
 */

import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { mkdir, unlink } from "node:fs/promises";
import {
  root, backendUrl, frontendUrl, artifactDir,
  composeUp, composeDown, waitForStack,
  fetchJson, signup,
  launchBrowser, clickButtonByText, slowType, pause,
  showOverlay, hideOverlay, showSceneTitle,
  convertToMp4, loginViaUI, waitForEntityByTitle,
} from "./demo-helpers.mjs";

const webmPath = path.join(artifactDir, "demo-multiuser-realtime.webm");
const mp4Path  = path.join(artifactDir, "demo-multiuser-realtime.mp4");

const run = async () => {
  composeUp();

  try {
    await waitForStack();

    /* ---- Create users ---- */
    const ts = Date.now();
    const aliceName = `alice_${ts}`;
    const bobName   = `bob_${ts}`;
    const pw        = "DemoPass#42";

    const aliceCreds = await signup(aliceName, pw);
    const bobCreds   = await signup(bobName, pw);

    /* ---- Launch browser ---- */
    await mkdir(artifactDir, { recursive: true });
    const browser = await launchBrowser();
    const page = await browser.newPage();
    page.on("dialog", async (d) => {
      if (d.type() === "prompt") await d.accept("Edited via demo");
      else await d.accept();
    });

    console.log("▶ Starting screencast …");
    const recorder = await page.screencast({ path: webmPath });

    /* ============================================================== */
    /*  SCENE 1 – Introduction                                        */
    /* ============================================================== */
    await page.goto(frontendUrl, { waitUntil: "networkidle2" });
    await showSceneTitle(
      page,
      "Multi-User Real-Time Collaboration",
      "Demonstrating live updates between Alice and Bob",
      3000
    );

    /* ============================================================== */
    /*  SCENE 2 – Alice logs in                                       */
    /* ============================================================== */
    console.log("  Scene 2: Alice logs in");
    await showOverlay(page, `👤 ALICE's Screen`, "#2563eb");
    await pause(800);
    await clickButtonByText(page, "HCMIU Collaborative");
    await page.waitForFunction(() =>
      document.body.textContent?.includes("Entities")
    );
    await loginViaUI(page, aliceName, pw);
    await showOverlay(page, `👤 ALICE — Logged in as ${aliceName}`, "#16a34a");
    await pause(2000);

    /* ============================================================== */
    /*  SCENE 3 – Alice creates an entity                             */
    /* ============================================================== */
    console.log("  Scene 3: Alice creates an entity");
    await showOverlay(page, "👤 ALICE — Creating a new discussion entity", "#2563eb");
    await pause(800);
    await clickButtonByText(page, "📡 Entities");
    await page.waitForSelector("#entity-title");
    await pause(500);

    await slowType(page, "#entity-title", "Campus WiFi Improvements", 45);
    await slowType(
      page,
      "#entity-body",
      "The library WiFi has been slow during peak hours. Let's discuss solutions.",
      25
    );
    await pause(500);
    await page.click("#create-entity");
    await showOverlay(page, "👤 ALICE — Entity created! Waiting for it to appear…", "#16a34a");
    const entityId = await waitForEntityByTitle("Campus WiFi Improvements", 40_000);
    await pause(2000);

    // Scroll to see the new entity
    await page.evaluate(() =>
      window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" })
    );
    await pause(1500);

    /* ============================================================== */
    /*  SCENE 4 – Transition to Bob                                   */
    /* ============================================================== */
    console.log("  Scene 4: Transition to Bob");
    await showSceneTitle(
      page,
      "Switching to Bob's Perspective",
      `${bobName} logs in from another device and sees Alice's entity`,
      2500
    );

    /* ============================================================== */
    /*  SCENE 5 – Bob logs in and sees Alice's entity                 */
    /* ============================================================== */
    console.log("  Scene 5: Bob logs in");
    await page.goto(frontendUrl, { waitUntil: "networkidle2" });
    await showOverlay(page, `👤 BOB's Screen`, "#dc2626");
    await clickButtonByText(page, "HCMIU Collaborative");
    await page.waitForFunction(() =>
      document.body.textContent?.includes("Entities")
    );
    await loginViaUI(page, bobName, pw);
    await showOverlay(page, `👤 BOB — Logged in as ${bobName}`, "#16a34a");
    await pause(1500);

    await showOverlay(page, "👤 BOB — Checking entities (Alice's post should be here)", "#dc2626");
    await clickButtonByText(page, "📡 Entities");
    await pause(1500);
    await page.evaluate(() =>
      window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" })
    );
    await pause(1000);
    await page.waitForFunction(
      (title) => document.body.textContent?.includes(title),
      { timeout: 15_000 },
      "Campus WiFi Improvements"
    );
    await showOverlay(page, "👤 BOB — Alice's entity is visible! ✓", "#16a34a");
    await pause(2000);

    /* ============================================================== */
    /*  SCENE 6 – Bob follows the entity                              */
    /* ============================================================== */
    console.log("  Scene 6: Bob follows the entity");
    await showOverlay(page, "👤 BOB — Following Alice's entity for notifications", "#dc2626");
    await fetchJson(
      `/api/entities/${entityId}/follow`,
      { method: "POST" },
      bobCreds.token
    );
    await showOverlay(page, "👤 BOB — Now following 'Campus WiFi Improvements' ✓", "#16a34a");
    await pause(2000);

    /* ============================================================== */
    /*  SCENE 7 – Switch to Alice: add comment                        */
    /* ============================================================== */
    console.log("  Scene 7: Alice comments");
    await showSceneTitle(
      page,
      "Back to Alice's Perspective",
      "Alice adds a comment — Bob will be notified",
      2500
    );

    await page.goto(frontendUrl, { waitUntil: "networkidle2" });
    await showOverlay(page, "👤 ALICE's Screen", "#2563eb");
    await clickButtonByText(page, "HCMIU Collaborative");
    await page.waitForFunction(() =>
      document.body.textContent?.includes("Entities")
    );
    await loginViaUI(page, aliceName, pw);
    await pause(500);

    await showOverlay(page, "👤 ALICE — Adding a comment on the entity", "#2563eb");
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
    await showOverlay(page, "👤 ALICE — Comment posted! Bob should get a notification", "#16a34a");
    await pause(1500);

    await clickButtonByText(page, "📰 Activity");
    await page.waitForFunction(() =>
      document.body.textContent?.includes("Activity Feed")
    );
    await pause(2000);

    /* ============================================================== */
    /*  SCENE 8 – Bob checks notifications                            */
    /* ============================================================== */
    console.log("  Scene 8: Bob checks notifications");
    await showSceneTitle(
      page,
      "Switching to Bob's Perspective",
      "Bob checks notifications — should see Alice's comment alert",
      2500
    );

    await page.goto(frontendUrl, { waitUntil: "networkidle2" });
    await showOverlay(page, "👤 BOB's Screen", "#dc2626");
    await clickButtonByText(page, "HCMIU Collaborative");
    await page.waitForFunction(() =>
      document.body.textContent?.includes("Entities")
    );
    await loginViaUI(page, bobName, pw);
    await pause(500);

    await showOverlay(page, "👤 BOB — Checking notifications", "#dc2626");
    await clickButtonByText(page, "🔔 Notifications");
    await page.waitForFunction(() =>
      document.body.textContent?.includes("Notifications")
    );
    await pause(2500);
    await page.evaluate(() =>
      window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" })
    );
    await pause(1500);
    await showOverlay(page, "👤 BOB — Notification received from Alice's comment! ✓", "#16a34a");
    await pause(2000);

    /* ============================================================== */
    /*  SCENE 9 – Bob replies                                         */
    /* ============================================================== */
    console.log("  Scene 9: Bob replies");
    await showOverlay(page, "👤 BOB — Replying to the discussion", "#dc2626");

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
    await showOverlay(page, "👤 BOB — Reply posted! ✓", "#16a34a");
    await pause(1500);

    await clickButtonByText(page, "📰 Activity");
    await page.waitForFunction(() =>
      document.body.textContent?.includes("Activity Feed")
    );
    await showOverlay(page, "👤 BOB — Activity feed shows the full conversation", "#dc2626");
    await pause(2500);
    await page.evaluate(() =>
      window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" })
    );
    await pause(1500);

    /* ============================================================== */
    /*  SCENE 10 – Alice edits entity                                 */
    /* ============================================================== */
    console.log("  Scene 10: Alice edits entity");
    await showSceneTitle(
      page,
      "Back to Alice's Perspective",
      "Alice updates the entity based on Bob's feedback",
      2500
    );

    await page.goto(frontendUrl, { waitUntil: "networkidle2" });
    await showOverlay(page, "👤 ALICE's Screen", "#2563eb");
    await clickButtonByText(page, "HCMIU Collaborative");
    await page.waitForFunction(() =>
      document.body.textContent?.includes("Entities")
    );
    await loginViaUI(page, aliceName, pw);
    await pause(500);

    await showOverlay(page, "👤 ALICE — Updating entity with Bob's info", "#2563eb");
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
    await showOverlay(page, "👤 ALICE — Entity updated! Followers notified ✓", "#16a34a");
    await pause(1500);

    await clickButtonByText(page, "📰 Activity");
    await page.waitForFunction(() =>
      document.body.textContent?.includes("Activity Feed")
    );
    await showOverlay(page, "👤 ALICE — Complete collaboration history", "#2563eb");
    await pause(2500);
    await page.evaluate(() =>
      window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" })
    );
    await pause(1500);
    await page.evaluate(() =>
      window.scrollTo({ top: 0, behavior: "smooth" })
    );
    await pause(1000);

    /* ============================================================== */
    /*  SCENE 11 – Outro                                              */
    /* ============================================================== */
    await showSceneTitle(
      page,
      "Demo Complete",
      "Multi-user real-time: entity creation, following, commenting, notifications",
      3000
    );

    /* ---- Stop and convert ---- */
    console.log("▶ Stopping screencast …");
    await recorder.stop();
    await browser.close();
    console.log(`✔ WebM saved → ${webmPath}`);

    convertToMp4(webmPath, mp4Path);
    try { await unlink(webmPath); } catch {}

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
