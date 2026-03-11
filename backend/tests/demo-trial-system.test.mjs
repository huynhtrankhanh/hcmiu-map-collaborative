/**
 * Demo Video – Court Trial System
 *
 * Demonstrates the full trial/dispute-resolution workflow:
 *   • Plaintiff files a trial against Defendant
 *   • Plaintiff proposes judges → Defendant accepts
 *   • Judge casts a vote → Trial resolves
 *   • Perspective changes marked with clear on-screen labels
 *
 * Uses SEPARATE browser pages per user (no login/logout switching).
 * Segments are recorded from each page and concatenated.
 *
 * Usage:
 *   node backend/tests/demo-trial-system.test.mjs
 *
 * Outputs:
 *   artifacts/demo-trial-system.mp4
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
  concatSegmentsToMp4, loginViaUI, navigateToCollaborative,
} from "./demo-helpers.mjs";

const mp4Path = path.join(artifactDir, "demo-trial-system.mp4");

const run = async () => {
  composeUp();

  try {
    await waitForStack();

    /* ---- Create users ---- */
    const ts = Date.now();
    const plaintiffName  = `plaintiff_${ts}`;
    const defendantName  = `defendant_${ts}`;
    const judgeName       = `judge_${ts}`;
    const pw              = "DemoPass#42";

    const plaintiffCreds  = await signup(plaintiffName, pw);
    const defendantCreds  = await signup(defendantName, pw);
    const judgeCreds      = await signup(judgeName, pw);

    /* ---- Launch browser with THREE pages ---- */
    await mkdir(artifactDir, { recursive: true });
    const browser = await launchBrowser();

    const plaintiffPage = await browser.newPage();
    const defendantPage = await browser.newPage();
    const judgePage      = await browser.newPage();

    plaintiffPage.on("dialog", async (d) => d.accept());
    defendantPage.on("dialog", async (d) => d.accept());
    judgePage.on("dialog", async (d) => d.accept());

    /* ---- Setup: navigate all pages & log in once ---- */
    console.log("▶ Setting up Plaintiff's page …");
    await plaintiffPage.goto(frontendUrl, { waitUntil: "networkidle2" });
    await navigateToCollaborative(plaintiffPage);
    await loginViaUI(plaintiffPage, plaintiffName, pw);

    console.log("▶ Setting up Defendant's page …");
    await defendantPage.goto(frontendUrl, { waitUntil: "networkidle2" });
    await navigateToCollaborative(defendantPage);
    await loginViaUI(defendantPage, defendantName, pw);

    console.log("▶ Setting up Judge's page …");
    await judgePage.goto(frontendUrl, { waitUntil: "networkidle2" });
    await navigateToCollaborative(judgePage);
    await loginViaUI(judgePage, judgeName, pw);

    console.log("✔ All three users logged in — starting demo");

    /* Segment tracking */
    const segments = [];
    let segIdx = 0;
    const segPath = () =>
      path.join(artifactDir, `tr-seg-${String(segIdx++).padStart(2, "0")}.webm`);

    /* ============================================================== */
    /*  SCENE 1 – Introduction (Plaintiff's page)                     */
    /* ============================================================== */
    let sp = segPath();
    let rec = await plaintiffPage.screencast({ path: sp });
    segments.push(sp);

    console.log("  Scene 1: Intro");
    await showSceneTitle(
      plaintiffPage,
      "⚖️ Court Trial System Demo",
      "Dispute resolution: Plaintiff → Defendant → Judge",
      3000
    );

    /* ============================================================== */
    /*  SCENE 2 – Plaintiff views Trials & files a case               */
    /* ============================================================== */
    console.log("  Scene 2: Plaintiff views Trials");
    await showOverlay(plaintiffPage, `⚖️ PLAINTIFF — ${plaintiffName}`, "#2563eb");
    await pause(1000);

    await showOverlay(plaintiffPage, "⚖️ PLAINTIFF — Opening Court of Justice", "#2563eb");
    await clickButtonByText(plaintiffPage, "⚖️ Trials");
    await plaintiffPage.waitForFunction(() =>
      document.body.textContent?.includes("Court of Justice"),
      { timeout: 15_000 }
    );
    await pause(2000);

    /* ============================================================== */
    /*  SCENE 3 – Plaintiff creates a trial                           */
    /* ============================================================== */
    console.log("  Scene 3: Plaintiff files trial");
    await showOverlay(plaintiffPage, "⚖️ PLAINTIFF — Filing a dispute against Defendant", "#2563eb");
    await pause(800);

    const trial = await fetchJson(
      "/api/trials",
      {
        method: "POST",
        body: JSON.stringify({
          title: "Study Room Noise Violation",
          description:
            `${defendantName} has been consistently loud in the designated quiet study area, disrupting other students.`,
          defendantUsername: defendantName,
        }),
      },
      plaintiffCreds.token
    );

    await showOverlay(plaintiffPage, "⚖️ PLAINTIFF — Trial filed! ✓", "#16a34a");
    await pause(1000);

    await clickButtonByText(plaintiffPage, "⚖️ Trials");
    await plaintiffPage.waitForFunction(
      (t) => document.body.textContent?.includes(t),
      { timeout: 15_000 },
      "Study Room Noise Violation"
    );
    await showOverlay(plaintiffPage, "⚖️ PLAINTIFF — Trial visible in Court of Justice", "#2563eb");
    await pause(2500);
    await plaintiffPage.evaluate(() =>
      window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" })
    );
    await pause(1500);

    /* ============================================================== */
    /*  SCENE 4 – Plaintiff proposes a judge                          */
    /* ============================================================== */
    console.log("  Scene 4: Plaintiff proposes judge");
    await showOverlay(plaintiffPage, `⚖️ PLAINTIFF — Proposing ${judgeName} as judge`, "#2563eb");
    await pause(800);

    await fetchJson(
      `/api/trials/${trial.trial.id}/propose-judges`,
      {
        method: "POST",
        body: JSON.stringify({ judges: [judgeName] }),
      },
      plaintiffCreds.token
    );
    await showOverlay(plaintiffPage, "⚖️ PLAINTIFF — Judge proposed! Waiting for defendant…", "#eab308");
    await pause(2500);

    await rec.stop();

    /* ============================================================== */
    /*  SCENE 5 – Defendant accepts judges (Defendant's page)         */
    /* ============================================================== */
    console.log("  Scene 5: Defendant accepts judges");
    sp = segPath();
    rec = await defendantPage.screencast({ path: sp });
    segments.push(sp);

    await showSceneTitle(
      defendantPage,
      "Defendant's Perspective",
      `${defendantName} reviews and accepts the proposed judge`,
      2500
    );

    await showOverlay(defendantPage, `⚖️ DEFENDANT — ${defendantName}`, "#dc2626");
    await pause(800);

    await showOverlay(defendantPage, "⚖️ DEFENDANT — Opening Court of Justice", "#dc2626");
    await clickButtonByText(defendantPage, "⚖️ Trials");
    await defendantPage.waitForFunction(
      (t) => document.body.textContent?.includes(t),
      { timeout: 15_000 },
      "Study Room Noise Violation"
    );
    await pause(2000);
    await defendantPage.evaluate(() =>
      window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" })
    );
    await pause(1500);

    // Accept judges
    await showOverlay(defendantPage, `⚖️ DEFENDANT — Accepting proposed judge: ${judgeName}`, "#dc2626");
    await fetchJson(
      `/api/trials/${trial.trial.id}/accept-judges`,
      { method: "POST" },
      defendantCreds.token
    );
    await showOverlay(defendantPage, "⚖️ DEFENDANT — Judges accepted! Trial is now ACTIVE ✓", "#16a34a");
    await pause(2000);

    await clickButtonByText(defendantPage, "⚖️ Trials");
    await pause(2000);
    await defendantPage.evaluate(() =>
      window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" })
    );
    await pause(1500);

    await rec.stop();

    /* ============================================================== */
    /*  SCENE 6 – Judge votes (Judge's page)                          */
    /* ============================================================== */
    console.log("  Scene 6: Judge votes");
    sp = segPath();
    rec = await judgePage.screencast({ path: sp });
    segments.push(sp);

    await showSceneTitle(
      judgePage,
      "Judge's Perspective",
      `${judgeName} reviews the case and casts a vote`,
      2500
    );

    await showOverlay(judgePage, `⚖️ JUDGE — ${judgeName}`, "#7c3aed");
    await pause(800);

    await showOverlay(judgePage, "⚖️ JUDGE — Reviewing the case", "#7c3aed");
    await clickButtonByText(judgePage, "⚖️ Trials");
    await judgePage.waitForFunction(
      (t) => document.body.textContent?.includes(t),
      { timeout: 15_000 },
      "Study Room Noise Violation"
    );
    await pause(2000);
    await judgePage.evaluate(() =>
      window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" })
    );
    await pause(1500);

    // Cast vote
    await showOverlay(judgePage, "⚖️ JUDGE — Casting vote: Plaintiff wins", "#7c3aed");
    await fetchJson(
      `/api/trials/${trial.trial.id}/vote`,
      {
        method: "POST",
        body: JSON.stringify({ vote: "plaintiff" }),
      },
      judgeCreds.token
    );
    await showOverlay(judgePage, "⚖️ JUDGE — Vote cast! Trial RESOLVED ✓", "#16a34a");
    await pause(2000);

    await clickButtonByText(judgePage, "⚖️ Trials");
    await pause(2000);
    await judgePage.evaluate(() =>
      window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" })
    );
    await pause(2000);

    await rec.stop();

    /* ============================================================== */
    /*  SCENE 7 – Plaintiff sees the resolved trial                   */
    /* ============================================================== */
    console.log("  Scene 7: Plaintiff sees result");
    sp = segPath();
    rec = await plaintiffPage.screencast({ path: sp });
    segments.push(sp);

    await showSceneTitle(
      plaintiffPage,
      "Back to Plaintiff",
      "Plaintiff views the resolved trial — they won!",
      2500
    );

    await showOverlay(plaintiffPage, "⚖️ PLAINTIFF — Viewing resolved trial", "#2563eb");
    await clickButtonByText(plaintiffPage, "⚖️ Trials");
    await plaintiffPage.waitForFunction(
      (t) => document.body.textContent?.includes(t),
      { timeout: 15_000 },
      "Study Room Noise Violation"
    );
    await pause(2000);
    await plaintiffPage.evaluate(() =>
      window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" })
    );
    await pause(2000);
    await showOverlay(plaintiffPage, "⚖️ PLAINTIFF — Trial resolved in plaintiff's favor! ✓", "#16a34a");
    await pause(2500);

    /* ============================================================== */
    /*  SCENE 8 – Outro                                               */
    /* ============================================================== */
    await showSceneTitle(
      plaintiffPage,
      "Demo Complete",
      "Full trial lifecycle: Filing → Judge Negotiation → Voting → Resolution",
      3000
    );

    await rec.stop();

    /* ---- Concatenate segments and convert ---- */
    await browser.close();
    console.log(`▶ Concatenating ${segments.length} segments …`);
    await concatSegmentsToMp4(segments, mp4Path);

    console.log("\n🎬 Trial system demo complete!");
  } finally {
    composeDown();
  }
};

run().catch((err) => {
  console.error("❌ Demo failed:", err);
  try { composeDown(); } catch {}
  process.exit(1);
});
