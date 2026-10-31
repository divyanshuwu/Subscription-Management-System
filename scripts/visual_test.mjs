// Optional baseline comparison; requires a built baseline checkout, not a moving screenshot.
import { existsSync } from "node:fs";
import { chromium } from "@playwright/test";
import express from "express";
import { writeFile, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import path from "node:path";
const baseline = process.env.BASELINE_DIR || "artifacts/baseline-source";
const servers = [];
const current =
  process.env.VISUAL_CURRENT_DIR ||
  (existsSync("artifacts/demo-web/index.html") ? "artifacts/demo-web" : "dist");
for (const dir of [path.join(baseline, "dist"), current]) {
  const app = express();
  app.use(express.static(path.resolve(dir)));
  servers.push(
    await new Promise((resolve) => {
      const s = app.listen(0, "127.0.0.1", () => resolve(s));
    }),
  );
}
const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox"],
});
const results = {
  baseline_commit: "f228f3b7a3029d9563e9be8c4dcdf63a6fe39eb7",
  styles: [],
  viewports: [],
};
try {
  for (const file of [
    "frontend/src/styles.css",
    "frontend/src/components/ServerRecords.css",
  ]) {
    const digest = (data) => createHash("sha256").update(data).digest("hex");
    const original = digest(await readFile(path.join(baseline, file))),
      current = digest(await readFile(file));
    assert.equal(current, original, `${file} changed`);
    results.styles.push({ file, sha256: current, unchanged: true });
  }
  for (const viewport of [
    { width: 1440, height: 1060 },
    { width: 390, height: 844 },
  ]) {
    const metrics = [];
    for (let i = 0; i < 2; i++) {
      const page = await browser.newPage({ viewport });
      // Legacy baseline contains recording/CDN hooks. Block them for the visual comparison.
      await page.route("**/*", (route) =>
        new URL(route.request().url()).hostname === "127.0.0.1"
          ? route.continue()
          : route.abort(),
      );
      await page.goto(`http://127.0.0.1:${servers[i].address().port}`);
      await page
        .getByRole("heading", { name: "Business, at a glance." })
        .waitFor();
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(450);
      const m = await page.evaluate(() =>
        Object.fromEntries(
          [
            ".sidebar",
            ".topbar",
            ".main-content",
            ".stats-grid",
            ".charts-grid",
            ".revenue-card",
            ".stat-card",
            ".renewals-card",
          ].map((selector) => {
            const e = document.querySelector(selector),
              r = e?.getBoundingClientRect(),
              style = e ? getComputedStyle(e) : null;
            return [
              selector,
              r
                ? {
                    x: Math.round(r.x),
                    y: Math.round(r.y),
                    width: Math.round(r.width),
                    height: Math.round(r.height),
                    font: style.fontFamily,
                    color: style.color,
                    background: style.backgroundColor,
                  }
                : null,
            ];
          }),
        ),
      );
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        true,
      );
      metrics.push(m);
      await page.screenshot({
        path: `docs/evidence/${i ? "final" : "baseline"}-${viewport.width}.png`,
        fullPage: true,
      });
      await page.close();
    }
    assert.deepEqual(
      metrics[1],
      metrics[0],
      `Layout/style changed at ${viewport.width}px`,
    );
    results.viewports.push({
      viewport,
      layout_and_style_equal: true,
      measured: metrics[1],
    });
  }
} finally {
  await writeFile(
    "docs/evidence/iteration-3-visual.json",
    JSON.stringify(results, null, 2),
  );
  await browser.close();
  for (const s of servers) await new Promise((r) => s.close(r));
}
console.log(
  "PASS: original CSS hashes and 8 dashboard regions match at 1440px and 390px; no horizontal overflow. Functional text/content may differ.",
);
