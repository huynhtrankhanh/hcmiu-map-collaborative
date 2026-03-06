/**
 * Demo Video – Court Trial System
 *
 * Demonstrates the full trial/dispute-resolution workflow:
 *   • Plaintiff files a trial against Defendant
 *   • Plaintiff proposes judges → Defendant accepts
 *   • Judge casts a vote → Trial resolves
 *   • Perspective changes marked with clear on-screen labels
 *
 * Uses a single browser page, re-logging as each user.
 *
 * Usage:
 *   node backend/tests/demo-trial-system.test.mjs
 *
 * Outputs:
 *   artifacts/demo-trial-system.mp4
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
  convertToMp4, loginViaUI,
} from "./demo-helpers.mjs";

const webmPath = path.join(artifactDir, "demo-trial-system.webm");
const mp4Path  = path.join(artifactDir, "demo-trial-system.mp4");

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

    /* ---- Browser ---- */
    await mkdir(artifactDir, { recursive: true });
    const browser = await launchBrowser();
    const page = await browser.newPage();
    page.on("dialog", async (d) => d.accept());

    console.log("▶ Starting screencast …");
    const recorder = await page.screencast({ path: webmPath });

    /* ============================================================== */
    /*  SCENE 1 – Introduction                                        */
    /* ============================================================== */
    console.log("  Scene 1: Intro");
    await page.goto(frontendUrl, { waitUntil: "networkidle2" });
    await showSceneTitle(
      page,
      "⚖️ Court Trial System Demo",
      "Dispute resolution: Plaintiff → Defendant → Judge",
      3000
    );

    /* ============================================================== */
    /*  SCENE 2 – Plaintiff logs in                                   */
    /* ============================================================== */
    console.log("  Scene 2: Plaintiff logs in");
    await showOverlay(page, `⚖️ PLAINTIFF (${plaintiffName}) — Logging In`, "#2563eb");
    await clickButtonByText(page, "HCMIU Collaborative");
    await page.waitForFunction(() =>
      document.body.textContent?.includes("Entities")
    );
    await loginViaUI(page, plaintiffName, pw);
    await showOverlay(page, `⚖️ PLAINTIFF — Logged in ✓`, "#16a34a");
    await pause(1500);

    /* ============================================================== */
    /*  SCENE 3 – Plaintiff views the Trials page                     */
    /* ============================================================== */
    console.log("  Scene 3: Plaintiff views Trials");
    await showOverlay(page, "⚖️ PLAINTIFF — Opening Court of Justice", "#2563eb");
    await clickButtonByText(page, "⚖️ Trials");
    await page.waitForFunction(() =>
      document.body.textContent?.includes("Court of Justice")
    );
    await pause(2000);

    /* ============================================================== */
    /*  SCENE 4 – Plaintiff creates a trial                           */
    /* ============================================================== */
    console.log("  Scene 4: Plaintiff files trial");
    await showOverlay(page, "⚖️ PLAINTIFF — Filing a dispute against Defendant", "#2563eb");
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

    await showOverlay(page, "⚖️ PLAINTIFF — Trial filed! ✓", "#16a34a");
    await pause(1000);

    // Refresh to see the trial
    await clickButtonByText(page, "⚖️ Trials");
    await page.waitForFunction(
      (t) => document.body.textContent?.includes(t),
      { timeout: 15_000 },
      "Study Room Noise Violation"
    );
    await showOverlay(page, "⚖️ PLAINTIFF — Trial visible in Court of Justice", "#2563eb");
    await pause(2500);
    await page.evaluate(() =>
      window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" })
    );
    await pause(1500);

    /* ============================================================== */
    /*  SCENE 5 – Plaintiff proposes a judge                          */
    /* ============================================================== */
    console.log("  Scene 5: Plaintiff proposes judge");
    await showOverlay(page, `⚖️ PLAINTIFF — Proposing ${judgeName} as judge`, "#2563eb");
    await pause(800);

    await fetchJson(
      `/api/trials/${trial.trial.id}/propose-judges`,
      {
        method: "POST",
        body: JSON.stringify({ judges: [judgeName] }),
      },
      plaintiffCreds.token
    );
    await showOverlay(page, "⚖️ PLAINTIFF — Judge proposed! Waiting for defendant…", "#eab308");
    await pause(2500);

    /* ============================================================== */
    /*  SCENE 6 – Switch to Defendant                                 */
    /* ============================================================== */
    console.log("  Scene 6: Defendant accepts judges");
    await showSceneTitle(
      page,
      "Switching to Defendant's Perspective",
      `${defendantName} reviews and accepts the proposed judge`,
      2500
    );

    await page.goto(frontendUrl, { waitUntil: "networkidle2" });
    await showOverlay(page, `⚖️ DEFENDANT (${defendantName})`, "#dc2626");
    await clickButtonByText(page, "HCMIU Collaborative");
    await page.waitForFunction(() =>
      document.body.textContent?.includes("Entities")
    );
    await loginViaUI(page, defendantName, pw);
    await pause(500);

    await showOverlay(page, "⚖️ DEFENDANT — Opening Court of Justice", "#dc2626");
    await clickButtonByText(page, "⚖️ Trials");
    await page.waitForFunction(
      (t) => document.body.textContent?.includes(t),
      { timeout: 15_000 },
      "Study Room Noise Violation"
    );
    await pause(2000);
    await page.evaluate(() =>
      window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" })
    );
    await pause(1500);

    // Accept judges
    await showOverlay(page, `⚖️ DEFENDANT — Accepting proposed judge: ${judgeName}`, "#dc2626");
    await fetchJson(
      `/api/trials/${trial.trial.id}/accept-judges`,
      { method: "POST" },
      defendantCreds.token
    );
    await showOverlay(page, "⚖️ DEFENDANT — Judges accepted! Trial is now ACTIVE ✓", "#16a34a");
    await pause(2000);

    // Refresh
    await clickButtonByText(page, "⚖️ Trials");
    await pause(2000);
    await page.evaluate(() =>
      window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" })
    );
    await pause(1500);

    /* ============================================================== */
    /*  SCENE 7 – Switch to Judge                                     */
    /* ============================================================== */
    console.log("  Scene 7: Judge votes");
    await showSceneTitle(
      page,
      "Switching to Judge's Perspective",
      `${judgeName} reviews the case and casts a vote`,
      2500
    );

    await page.goto(frontendUrl, { waitUntil: "networkidle2" });
    await showOverlay(page, `⚖️ JUDGE (${judgeName})`, "#7c3aed");
    await clickButtonByText(page, "HCMIU Collaborative");
    await page.waitForFunction(() =>
      document.body.textContent?.includes("Entities")
    );
    await loginViaUI(page, judgeName, pw);
    await pause(500);

    await showOverlay(page, "⚖️ JUDGE — Reviewing the case", "#7c3aed");
    await clickButtonByText(page, "⚖️ Trials");
    await page.waitForFunction(
      (t) => document.body.textContent?.includes(t),
      { timeout: 15_000 },
      "Study Room Noise Violation"
    );
    await pause(2000);
    await page.evaluate(() =>
      window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" })
    );
    await pause(1500);

    // Cast vote
    await showOverlay(page, "⚖️ JUDGE — Casting vote: Plaintiff wins", "#7c3aed");
    await fetchJson(
      `/api/trials/${trial.trial.id}/vote`,
      {
        method: "POST",
        body: JSON.stringify({ vote: "plaintiff" }),
      },
      judgeCreds.token
    );
    await showOverlay(page, "⚖️ JUDGE — Vote cast! Trial RESOLVED ✓", "#16a34a");
    await pause(2000);

    // Refresh to see resolved status
    await clickButtonByText(page, "⚖️ Trials");
    await pause(2000);
    await page.evaluate(() =>
      window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" })
    );
    await pause(2000);

    /* ============================================================== */
    /*  SCENE 8 – Plaintiff sees the resolved trial                   */
    /* ============================================================== */
    console.log("  Scene 8: Plaintiff sees result");
    await showSceneTitle(
      page,
      "Back to Plaintiff's Perspective",
      "Plaintiff views the resolved trial — they won!",
      2500
    );

    await page.goto(frontendUrl, { waitUntil: "networkidle2" });
    await showOverlay(page, `⚖️ PLAINTIFF (${plaintiffName})`, "#2563eb");
    await clickButtonByText(page, "HCMIU Collaborative");
    await page.waitForFunction(() =>
      document.body.textContent?.includes("Entities")
    );
    await loginViaUI(page, plaintiffName, pw);
    await pause(500);

    await showOverlay(page, "⚖️ PLAINTIFF — Viewing resolved trial", "#2563eb");
    await clickButtonByText(page, "⚖️ Trials");
    await page.waitForFunction(
      (t) => document.body.textContent?.includes(t),
      { timeout: 15_000 },
      "Study Room Noise Violation"
    );
    await pause(2000);
    await page.evaluate(() =>
      window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" })
    );
    await pause(2000);
    await showOverlay(page, "⚖️ PLAINTIFF — Trial resolved in plaintiff's favor! ✓", "#16a34a");
    await pause(2500);

    /* ============================================================== */
    /*  SCENE 9 – Outro                                               */
    /* ============================================================== */
    await showSceneTitle(
      page,
      "Demo Complete",
      "Full trial lifecycle: Filing → Judge Negotiation → Voting → Resolution",
      3000
    );

    /* ---- Stop and convert ---- */
    console.log("▶ Stopping screencast …");
    await recorder.stop();
    await browser.close();
    console.log(`✔ WebM saved → ${webmPath}`);

    convertToMp4(webmPath, mp4Path);
    try { await unlink(webmPath); } catch {}

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
