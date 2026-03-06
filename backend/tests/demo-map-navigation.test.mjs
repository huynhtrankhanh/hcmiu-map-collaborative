/**
 * Demo Video – Map Navigation & Pathfinding
 *
 * In-depth demonstration of the campus map features:
 *   • Browsing all 7 floors with zoom controls
 *   • Quick-search to find rooms
 *   • Clicking rooms to see details
 *   • Shortest path between two rooms
 *   • Traveling Salesman solver for multi-stop routes
 *
 * Usage:
 *   node backend/tests/demo-map-navigation.test.mjs
 *
 * Outputs:
 *   artifacts/demo-map-navigation.mp4
 */

import path from "node:path";
import { mkdir, unlink } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import {
  root, backendUrl, frontendUrl, artifactDir,
  composeUp, composeDown, waitForStack,
  launchBrowser, clickButtonByText, slowType, pause,
  showOverlay, hideOverlay, showSceneTitle,
  convertToMp4,
} from "./demo-helpers.mjs";

const webmPath = path.join(artifactDir, "demo-map-navigation.webm");
const mp4Path  = path.join(artifactDir, "demo-map-navigation.mp4");

const run = async () => {
  composeUp();

  try {
    await waitForStack();

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
      "🗺️ Map Navigation & Pathfinding",
      "Interactive campus map, shortest path, and multi-stop optimizer",
      3000
    );

    /* ============================================================== */
    /*  SCENE 2 – Landing Page                                        */
    /* ============================================================== */
    console.log("  Scene 2: Landing page");
    await showOverlay(page, "🏠 Landing Page — Navigation Hub", "#2563eb");
    await pause(2000);
    await page.evaluate(() => window.scrollTo({ top: 300, behavior: "smooth" }));
    await pause(1000);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
    await pause(1000);

    /* ============================================================== */
    /*  SCENE 3 – Floor Browsing                                      */
    /* ============================================================== */
    console.log("  Scene 3: Floor browsing");
    await showOverlay(page, "🗺️ Opening Campus Map Explorer", "#2563eb");
    await clickButtonByText(page, "View Map");
    await page.waitForFunction(() =>
      document.body.textContent?.includes("Map Collaboration")
    );
    await pause(1500);

    const floorNames = ["Floor 1", "Floor 2", "Floor 3", "Floor 4", "Floor 5", "Floor 6", "Floor 7"];
    for (let i = 0; i < 7; i++) {
      await showOverlay(page, `🗺️ Browsing ${floorNames[i]}`, "#2563eb");
      await page.select("select[name='floor']", String(i));
      await pause(1200);
    }
    await page.select("select[name='floor']", "0");
    await pause(800);

    /* ============================================================== */
    /*  SCENE 4 – Zoom Controls                                       */
    /* ============================================================== */
    console.log("  Scene 4: Zoom controls");
    await showOverlay(page, "🔍 Zoom Controls — Adjusting map scale", "#7c3aed");
    await pause(800);

    await page.evaluate(() => {
      const s = document.querySelector("input[type='range']");
      if (s) { s.value = "150"; s.dispatchEvent(new Event("input", { bubbles: true })); }
    });
    await showOverlay(page, "🔍 Zoomed to 150%", "#7c3aed");
    await pause(1500);

    await page.evaluate(() => {
      const s = document.querySelector("input[type='range']");
      if (s) { s.value = "75"; s.dispatchEvent(new Event("input", { bubbles: true })); }
    });
    await showOverlay(page, "🔍 Zoomed to 75%", "#7c3aed");
    await pause(1500);

    await page.evaluate(() => {
      const s = document.querySelector("input[type='range']");
      if (s) { s.value = "100"; s.dispatchEvent(new Event("input", { bubbles: true })); }
    });
    await showOverlay(page, "🔍 Reset to 100%", "#7c3aed");
    await pause(1000);

    /* ============================================================== */
    /*  SCENE 5 – Quick Search                                        */
    /* ============================================================== */
    console.log("  Scene 5: Quick search");
    await showOverlay(page, "🔎 Quick Search — Finding rooms by name", "#2563eb");
    await pause(800);

    const hasSearch = await page.$("#map-quick-search");
    if (hasSearch) {
      await slowType(page, "#map-quick-search", "Floor 2: A2.203", 50);
      try {
        await page.waitForFunction(() =>
          Array.from(document.querySelectorAll("div")).some((el) =>
            (el.textContent || "").includes("Floor 2: A2.203")
          ),
          { timeout: 10_000 }
        );
      } catch {}
      await showOverlay(page, "🔎 Found: Floor 2: A2.203", "#16a34a");
      await pause(1000);
      await page.evaluate(() => {
        const s = Array.from(document.querySelectorAll("div")).find(
          (el) => (el.textContent || "").includes("Floor 2: A2.203")
        );
        if (s instanceof HTMLElement) s.click();
      });
      await pause(2000);

      // Clear and search another
      await page.evaluate(() => {
        const input = document.querySelector("#map-quick-search");
        if (input) input.value = "";
      });
      await slowType(page, "#map-quick-search", "Floor 1: A1.109", 50);
      await pause(800);
      await page.evaluate(() => {
        const ss = Array.from(document.querySelectorAll("div")).filter(
          (el) => (el.textContent || "").includes("Floor 1: A1.109")
        );
        const s = ss[ss.length - 1];
        if (s instanceof HTMLElement) s.click();
      });
      await showOverlay(page, "🔎 Navigated to Floor 1: A1.109", "#16a34a");
      await pause(2000);
    }

    /* ============================================================== */
    /*  SCENE 6 – Click Room for Details                              */
    /* ============================================================== */
    console.log("  Scene 6: Room click");
    await page.select("select[name='floor']", "0");
    await pause(500);
    await showOverlay(page, "🏠 Clicking room A1.109 for details", "#2563eb");

    await page.evaluate(() => {
      const room = Array.from(
        document.querySelectorAll("[data-constructname]")
      ).find((x) =>
        (x.getAttribute("data-constructname") || "").includes("A1.109")
      );
      if (room) room.click();
    });
    try {
      await page.waitForFunction(() =>
        document.body.textContent?.includes("Open in HCMIU Collaborative")
      );
    } catch {}
    await showOverlay(page, "🏠 Room A1.109 selected — Can open in Collaborative", "#16a34a");
    await pause(2500);

    /* ============================================================== */
    /*  SCENE 7 – Shortest Path                                       */
    /* ============================================================== */
    console.log("  Scene 7: Shortest path");
    await page.goto(frontendUrl, { waitUntil: "networkidle2" });
    await pause(500);
    await showOverlay(page, "📍 Shortest Path — Route between two rooms", "#2563eb");
    await clickButtonByText(page, "Find Shortest Path");
    await page.waitForFunction(() =>
      document.body.textContent?.includes("Shortest Path")
    );
    await pause(1500);

    const inputFields = await page.$$("input[type='text']");
    if (inputFields.length >= 2) {
      await showOverlay(page, "📍 From: Floor 1: A1.109", "#2563eb");
      await inputFields[0].click();
      await inputFields[0].type("Floor 1: A1.109", { delay: 40 });
      await pause(800);
      await page.evaluate(() => {
        const ss = Array.from(document.querySelectorAll("div")).filter(
          (el) => (el.textContent || "").trim() === "Floor 1: A1.109"
        );
        const s = ss[ss.length - 1];
        if (s instanceof HTMLElement) s.click();
      });
      await pause(500);

      await showOverlay(page, "📍 To: Floor 2: A2.203", "#2563eb");
      await inputFields[1].click();
      await inputFields[1].type("Floor 2: A2.203", { delay: 40 });
      await pause(800);
      await page.evaluate(() => {
        const ss = Array.from(document.querySelectorAll("div")).filter(
          (el) => (el.textContent || "").trim() === "Floor 2: A2.203"
        );
        const s = ss[ss.length - 1];
        if (s instanceof HTMLElement) s.click();
      });
      await pause(500);

      await showOverlay(page, "📍 Computing shortest path…", "#eab308");
      await clickButtonByText(page, "Find Path");
      await pause(3000);

      await showOverlay(page, "📍 Route found! ✓", "#16a34a");
      await page.evaluate(() =>
        window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" })
      );
      await pause(2000);
      await page.evaluate(() =>
        window.scrollTo({ top: 0, behavior: "smooth" })
      );
      await pause(1500);
    }

    /* ============================================================== */
    /*  SCENE 8 – Another Shortest Path (multi-floor)                 */
    /* ============================================================== */
    console.log("  Scene 8: Another shortest path");
    await page.goto(frontendUrl, { waitUntil: "networkidle2" });
    await pause(500);
    await showOverlay(page, "📍 Another route: Floor 3 → Floor 5", "#2563eb");
    await clickButtonByText(page, "Find Shortest Path");
    await page.waitForFunction(() =>
      document.body.textContent?.includes("Shortest Path")
    );
    await pause(1000);

    const inputs2 = await page.$$("input[type='text']");
    if (inputs2.length >= 2) {
      await inputs2[0].click();
      await inputs2[0].type("Floor 3: A2.301", { delay: 40 });
      await pause(600);
      await page.evaluate(() => {
        const ss = Array.from(document.querySelectorAll("div")).filter(
          (el) => (el.textContent || "").trim() === "Floor 3: A2.301"
        );
        const s = ss[ss.length - 1];
        if (s instanceof HTMLElement) s.click();
      });
      await pause(500);

      await inputs2[1].click();
      await inputs2[1].type("Floor 5: A2.501", { delay: 40 });
      await pause(600);
      await page.evaluate(() => {
        const ss = Array.from(document.querySelectorAll("div")).filter(
          (el) => (el.textContent || "").trim() === "Floor 5: A2.501"
        );
        const s = ss[ss.length - 1];
        if (s instanceof HTMLElement) s.click();
      });
      await pause(500);

      await showOverlay(page, "📍 Finding multi-floor path…", "#eab308");
      await clickButtonByText(page, "Find Path");
      await pause(3000);
      await showOverlay(page, "📍 Multi-floor route found! ✓", "#16a34a");
      await page.evaluate(() =>
        window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" })
      );
      await pause(2000);
    }

    /* ============================================================== */
    /*  SCENE 9 – Traveling Salesman (preset)                         */
    /* ============================================================== */
    console.log("  Scene 9: TSP preset");
    await page.goto(frontendUrl, { waitUntil: "networkidle2" });
    await pause(500);
    await showOverlay(page, "🧭 Traveling Salesman — Multi-Stop Optimizer", "#7c3aed");
    await clickButtonByText(page, "Solve Traveling Salesman");
    await page.waitForFunction(() =>
      document.body.textContent?.includes("Traveling Salesman")
    );
    await pause(1500);

    await showOverlay(page, "🧭 Loading classroom loop preset", "#7c3aed");
    await clickButtonByText(page, "Load classroom loop");
    await pause(2000);

    await showOverlay(page, "🧭 Computing optimal route…", "#eab308");
    await clickButtonByText(page, "Find Path");
    await pause(3000);

    await showOverlay(page, "🧭 Optimal route calculated! ✓", "#16a34a");
    await page.evaluate(() =>
      window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" })
    );
    await pause(2000);
    await page.evaluate(() =>
      window.scrollTo({ top: 0, behavior: "smooth" })
    );
    await pause(1000);

    /* ============================================================== */
    /*  SCENE 10 – TSP with custom locations                          */
    /* ============================================================== */
    console.log("  Scene 10: TSP custom");
    await page.goto(frontendUrl, { waitUntil: "networkidle2" });
    await pause(500);
    await clickButtonByText(page, "Solve Traveling Salesman");
    await page.waitForFunction(() =>
      document.body.textContent?.includes("Traveling Salesman")
    );
    await pause(1000);

    await showOverlay(page, "🧭 Adding custom locations", "#7c3aed");
    const locations = ["Floor 1: A1.109", "Floor 2: A2.203", "Floor 3: A2.301"];

    for (let i = 0; i < locations.length; i++) {
      if (i > 0) {
        await clickButtonByText(page, "Add Location");
        await pause(500);
      }
      const textInputs = await page.$$("input[type='text']");
      const lastInput = textInputs[textInputs.length - 1];
      if (lastInput) {
        await lastInput.click();
        await lastInput.type(locations[i], { delay: 35 });
        await pause(600);
        await page.evaluate((loc) => {
          const ss = Array.from(document.querySelectorAll("div")).filter(
            (el) => (el.textContent || "").trim() === loc
          );
          const s = ss[ss.length - 1];
          if (s instanceof HTMLElement) s.click();
        }, locations[i]);
        await pause(400);
      }
    }

    await showOverlay(page, "🧭 3 custom stops — Finding optimal route", "#eab308");
    await clickButtonByText(page, "Find Path");
    await pause(3000);
    await showOverlay(page, "🧭 Multi-stop route optimized! ✓", "#16a34a");
    await page.evaluate(() =>
      window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" })
    );
    await pause(2000);

    /* ============================================================== */
    /*  SCENE 11 – Outro                                              */
    /* ============================================================== */
    console.log("  Scene 11: Outro");
    await page.goto(frontendUrl, { waitUntil: "networkidle2" });
    await showSceneTitle(
      page,
      "Demo Complete",
      "Campus map, shortest path, and multi-stop optimization",
      3000
    );

    /* ---- Stop and convert ---- */
    console.log("▶ Stopping screencast …");
    await recorder.stop();
    await browser.close();
    console.log(`✔ WebM saved → ${webmPath}`);

    convertToMp4(webmPath, mp4Path);
    try { await unlink(webmPath); } catch {}

    console.log("\n🎬 Map navigation demo complete!");
  } finally {
    composeDown();
  }
};

run().catch((err) => {
  console.error("❌ Demo failed:", err);
  try { composeDown(); } catch {}
  process.exit(1);
});
