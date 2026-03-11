/**
 * Shared helpers for demo video test scripts.
 *
 * Provides Docker Compose lifecycle, auth utilities, Puppeteer helpers,
 * and on-screen overlay labelling for multi-user demos.
 */

import { spawnSync, execSync } from "node:child_process";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import puppeteer from "puppeteer";
import sodium from "libsodium-wrappers-sumo";

export const root =
  "/home/runner/work/hcmiu-map-collaborative/hcmiu-map-collaborative";
export const backendUrl = "http://localhost:3000";
export const frontendUrl = backendUrl;
export const artifactDir = path.join(root, "artifacts");

/* ------------------------------------------------------------------ */
/*  Docker helpers                                                     */
/* ------------------------------------------------------------------ */

export const runCommand = (args) => {
  const result = spawnSync("docker", args, {
    cwd: root,
    stdio: "inherit",
    env: process.env,
  });
  if (result.status !== 0) {
    throw new Error(`docker ${args.join(" ")} failed with status ${result.status}`);
  }
};

export const composeUp = () => {
  console.log("▶ Starting Docker Compose stack …");
  runCommand(["compose", "up", "-d", "--build"]);
};

export const composeDown = () => {
  console.log("▶ Tearing down Docker Compose stack …");
  runCommand(["compose", "down", "-v"]);
};

export const waitFor = async (url, timeoutMs = 180_000) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {}
    await delay(1000);
  }
  throw new Error(`Timed out waiting for ${url}`);
};

export const waitForStack = async () => {
  console.log("▶ Waiting for backend health …");
  await waitFor(`${backendUrl}/api/health`);
  await waitFor(frontendUrl);
  console.log("✔ Stack is healthy");
};

/* ------------------------------------------------------------------ */
/*  API helpers                                                        */
/* ------------------------------------------------------------------ */

export const fetchJson = async (urlPath, options = {}, token) => {
  const response = await fetch(`${backendUrl}${urlPath}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  const body = response.status === 204 ? null : await response.json();
  if (!response.ok)
    throw new Error(`${urlPath} failed: ${body?.error || response.status}`);
  return body;
};

export const pwhash = async (password, saltBase64) => {
  await sodium.ready;
  const salt = sodium.from_base64(
    saltBase64,
    sodium.base64_variants.ORIGINAL
  );
  const derived = sodium.crypto_pwhash(
    32,
    password,
    salt,
    sodium.crypto_pwhash_OPSLIMIT_INTERACTIVE,
    sodium.crypto_pwhash_MEMLIMIT_INTERACTIVE,
    sodium.crypto_pwhash_ALG_DEFAULT,
    "uint8array"
  );
  return sodium.to_base64(derived, sodium.base64_variants.ORIGINAL);
};

export const signup = async (username, password) => {
  const start = await fetchJson("/api/auth/signup/start", {
    method: "POST",
    body: JSON.stringify({ username }),
  });
  const clientHash = await pwhash(password, start.clientSalt);
  return fetchJson("/api/auth/signup/finish", {
    method: "POST",
    body: JSON.stringify({
      username,
      clientHash,
      clientSalt: start.clientSalt,
      serverSalt: start.serverSalt,
    }),
  });
};

export const login = async (username, password) => {
  const start = await fetchJson("/api/auth/login/start", {
    method: "POST",
    body: JSON.stringify({ username }),
  });
  const clientHash = await pwhash(password, start.clientSalt);
  return fetchJson("/api/auth/login/finish", {
    method: "POST",
    body: JSON.stringify({ username, clientHash }),
  });
};

export const waitForEntityByTitle = async (title, timeoutMs = 30_000) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const result = await fetchJson(
        `/api/research/fulltext?q=${encodeURIComponent(title)}`
      );
      const found = result.entities.find((x) => x.title === title);
      if (found) return found.id;
    } catch {}
    await delay(500);
  }
  throw new Error(`Timed out waiting for entity title: ${title}`);
};

/* ------------------------------------------------------------------ */
/*  Puppeteer helpers                                                  */
/* ------------------------------------------------------------------ */

export const launchBrowser = async () => {
  return puppeteer.launch({
    headless: "shell",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--window-size=1280,800",
    ],
    defaultViewport: { width: 1280, height: 800 },
  });
};

/** Click a button whose visible text includes `text`. */
export const clickButtonByText = async (page, text) => {
  await page.waitForFunction(
    (t) =>
      Array.from(document.querySelectorAll("button")).some((b) =>
        (b.textContent || "").includes(t)
      ),
    { timeout: 30_000 },
    text
  );
  await page.evaluate((t) => {
    const btn = Array.from(document.querySelectorAll("button")).find((b) =>
      (b.textContent || "").includes(t)
    );
    if (!btn) throw new Error(`button not found: ${t}`);
    btn.scrollIntoView({ behavior: "smooth", block: "center" });
    btn.click();
  }, text);
};

/** Slowly type characters so the video shows typing animation. */
export const slowType = async (page, selector, text, ms = 80) => {
  await page.waitForSelector(selector, { timeout: 15_000 });
  await page.click(selector);
  await page.type(selector, text, { delay: ms });
};

/** Pause long enough for the viewer to see what is on screen. */
export const pause = (ms = 1500) => delay(ms);

/** Clear an input field before typing. */
export const clearInput = async (page, selector) => {
  await page.waitForSelector(selector, { timeout: 15_000 });
  await page.click(selector, { clickCount: 3 });
  await page.keyboard.press("Backspace");
};

/* ------------------------------------------------------------------ */
/*  Overlay / label helpers (for multi-user perspective)               */
/* ------------------------------------------------------------------ */

/**
 * Show a large, clear overlay banner indicating whose perspective the
 * viewer is seeing and what action is happening.
 */
export const showOverlay = async (page, text, color = "#2563eb") => {
  await page.evaluate(
    (t, c) => {
      let overlay = document.getElementById("demo-overlay");
      if (!overlay) {
        overlay = document.createElement("div");
        overlay.id = "demo-overlay";
        overlay.style.cssText = `
          position: fixed; top: 0; left: 0; right: 0;
          z-index: 99999; padding: 12px 24px;
          font-family: system-ui, sans-serif;
          font-size: 20px; font-weight: bold;
          color: white; text-align: center;
          transition: opacity 0.3s ease;
          pointer-events: none;
          text-shadow: 0 1px 4px rgba(0,0,0,0.5);
        `;
        document.body.appendChild(overlay);
      }
      overlay.textContent = t;
      overlay.style.backgroundColor = c;
      overlay.style.opacity = "1";
    },
    text,
    color
  );
};

/** Hide the overlay banner. */
export const hideOverlay = async (page) => {
  await page.evaluate(() => {
    const overlay = document.getElementById("demo-overlay");
    if (overlay) overlay.style.opacity = "0";
  });
};

/**
 * Show a scene title card: centred white text on dark background
 * occupying the full viewport for a moment.
 */
export const showSceneTitle = async (page, title, subtitle = "", durationMs = 2500) => {
  await page.evaluate(
    (t, s) => {
      let card = document.getElementById("demo-scene-card");
      if (!card) {
        card = document.createElement("div");
        card.id = "demo-scene-card";
        card.style.cssText = `
          position: fixed; inset: 0; z-index: 100000;
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          background: rgba(15,23,42,0.92);
          font-family: system-ui, sans-serif;
          color: white; text-align: center;
          transition: opacity 0.4s ease;
          pointer-events: none;
        `;
        document.body.appendChild(card);
      }
      card.innerHTML = `
        <div style="font-size:36px;font-weight:bold;margin-bottom:12px;">${t}</div>
        ${s ? `<div style="font-size:20px;opacity:0.8;">${s}</div>` : ""}
      `;
      card.style.opacity = "1";
    },
    title,
    subtitle
  );
  await delay(durationMs);
  await page.evaluate(() => {
    const card = document.getElementById("demo-scene-card");
    if (card) {
      card.style.opacity = "0";
      card.style.pointerEvents = "none";
    }
  });
  await delay(400);
};

/* ------------------------------------------------------------------ */
/*  Video conversion                                                   */
/* ------------------------------------------------------------------ */

export const convertToMp4 = (webmPath, mp4Path) => {
  console.log(`▶ Converting ${path.basename(webmPath)} → ${path.basename(mp4Path)} …`);
  try {
    execSync(
      `ffmpeg -y -i ${JSON.stringify(webmPath)} -c:v libx264 -preset fast -crf 23 -pix_fmt yuv420p -movflags +faststart ${JSON.stringify(mp4Path)}`,
      { stdio: "inherit", cwd: root }
    );
  } catch (err) {
    throw new Error(
      `ffmpeg conversion failed: ${err.message}`
    );
  }
  console.log(`✔ MP4 saved → ${mp4Path}`);
};

/**
 * Concatenate multiple WebM segment files into a single MP4.
 * Used for multi-page demos that record separate segments from
 * different browser pages (one per user).
 */
export const concatSegmentsToMp4 = async (segmentPaths, mp4Path) => {
  const listPath = mp4Path.replace(/\.mp4$/, "-segments.txt");
  const listContent = segmentPaths.map((p) => `file '${p}'`).join("\n") + "\n";
  const { writeFile: wf } = await import("node:fs/promises");
  await wf(listPath, listContent);
  console.log(`▶ Concatenating ${segmentPaths.length} segments → ${path.basename(mp4Path)} …`);
  try {
    execSync(
      `ffmpeg -y -f concat -safe 0 -i ${JSON.stringify(listPath)} -c:v libx264 -preset fast -crf 23 -pix_fmt yuv420p -movflags +faststart ${JSON.stringify(mp4Path)}`,
      { stdio: "inherit", cwd: root }
    );
  } catch (err) {
    throw new Error(`ffmpeg concat failed: ${err.message}`);
  }
  // Clean up segment list and webm files
  const { unlink: ul } = await import("node:fs/promises");
  try { await ul(listPath); } catch {}
  for (const seg of segmentPaths) {
    try { await ul(seg); } catch {}
  }
  console.log(`✔ MP4 saved → ${mp4Path}`);
};

/**
 * Navigate a page to the Collaborative section from the landing page.
 */
export const navigateToCollaborative = async (page) => {
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll("button")).find((b) =>
      (b.textContent || "").includes("HCMIU Collaborative")
    );
    if (btn) btn.click();
  });
  await page.waitForFunction(
    () => document.body.textContent?.includes("Entities"),
    { timeout: 30_000 }
  );
};

/**
 * Helper to log in through the UI on a page that is already on the
 * Collaborative section.
 */
export const loginViaUI = async (page, username, password) => {
  await clickButtonByText(page, "🔐 Auth");
  await page.waitForSelector("#username", { timeout: 15_000 });
  await pause(500);
  // Clear any existing values
  await page.evaluate(() => {
    const u = document.querySelector("#username");
    const p = document.querySelector("#password");
    if (u) u.value = "";
    if (p) p.value = "";
  });
  await page.type("#username", username, { delay: 35 });
  await page.type("#password", password, { delay: 35 });
  await pause(500);
  // Use evaluate to click login (avoids overlay interference)
  await page.evaluate(() => {
    const btn = document.querySelector("#login");
    if (btn) btn.click();
  });
  await page.waitForFunction(
    () => document.body.textContent?.includes("Logged in as"),
    { timeout: 60_000 }
  );
  await pause(1000);
};
