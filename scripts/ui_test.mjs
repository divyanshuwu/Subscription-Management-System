import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, stat, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
const root = path.resolve("dist");
const mime = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".png": "image/png",
  ".zip": "application/zip",
};
const server = createServer(async (req, res) => {
  try {
    let file = path.join(
      root,
      decodeURIComponent(new URL(req.url, "http://local").pathname),
    );
    if (!file.startsWith(root)) throw new Error("Invalid path");
    if ((await stat(file).catch(() => null))?.isDirectory())
      file = path.join(file, "index.html");
    if (!(await stat(file).catch(() => null)))
      file = path.join(root, "index.html");
    const data = await readFile(file);
    res.writeHead(200, {
      "Content-Type": mime[path.extname(file)] || "application/octet-stream",
    });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end();
  }
});
await new Promise((resolve) => server.listen(4188, "127.0.0.1", resolve));
const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox"],
});
const errors = [],
  checks = [];
const page = await browser.newPage({
  viewport: { width: 1440, height: 1060 },
  deviceScaleFactor: 1,
});
page.on("pageerror", (e) => errors.push(e.message));
async function check(name, fn) {
  await fn();
  checks.push(name);
  console.log("PASS", name);
}
try {
  await page.goto("http://127.0.0.1:4188");
  await page.getByRole("heading", { name: "Business, at a glance." }).waitFor();
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
  await mkdir("/tmp/brightloop-tests", { recursive: true });
  await check("Desktop dashboard renders and fits viewport", async () => {
    assert.ok(await page.getByText("1,284", { exact: true }).count());
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
      true,
    );
    await page.screenshot({
      path: "/tmp/brightloop-tests/desktop.png",
      fullPage: true,
    });
  });
  await check("Create subscription with customer, plan and terms", async () => {
    await page
      .getByRole("button", { name: "New subscription", exact: true })
      .click();
    await page.locator('select[name="customer_id"]').selectOption("customer-0");
    await page.locator('select[name="plan_id"]').selectOption("plan-1");
    await page
      .getByRole("button", { name: "Create subscription", exact: true })
      .click();
    await page.getByText("SUB-2026-1421", { exact: true }).waitFor();
  });
  await check("Confirm, activate, pause and resume subscription", async () => {
    await page.getByText("SUB-2026-1421", { exact: true }).click();
    await page
      .getByRole("button", { name: "Confirm subscription", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Activate subscription", exact: true })
      .click();
    await page.getByRole("button", { name: "Pause", exact: true }).click();
    await page.getByRole("button", { name: "Resume", exact: true }).click();
    await page.getByRole("button", { name: "Close details" }).click();
  });
  await check(
    "Billing creates invoices and repeat runs skip duplicate periods",
    async () => {
      await page.locator(".nav-item").filter({ hasText: "Invoices" }).click();
      await page
        .getByRole("button", { name: "Run billing", exact: true })
        .click();
      await page
        .getByRole("heading", { name: "Billing, taken care of." })
        .waitFor();
      let saved = JSON.parse(
        await page.evaluate(() => localStorage.getItem("brightloop-data-v2")),
      );
      const count = saved.invoices.length;
      assert.ok(count > 40);
      await page.getByRole("button", { name: "Close dialog" }).click();
      await page
        .getByRole("button", { name: "Run billing", exact: true })
        .click();
      await page
        .getByRole("heading", { name: "Billing, taken care of." })
        .waitFor();
      saved = JSON.parse(
        await page.evaluate(() => localStorage.getItem("brightloop-data-v2")),
      );
      assert.equal(saved.invoices.length, count);
      await page.getByRole("button", { name: "Close dialog" }).click();
    },
  );
  await check("Invoice PDF downloads locally", async () => {
    const downloadPromise = page.waitForEvent("download");
    await page.locator('button[aria-label^="Download INV-"]').first().click();
    const download = await downloadPromise;
    assert.ok(download.suggestedFilename().endsWith(".pdf"));
  });
  await check("Global search opens and finds subscriptions", async () => {
    await page.getByRole("button", { name: "Search anything..." }).click();
    await page.locator(".command-search input").fill("Acme");
    assert.ok((await page.locator(".search-results button").count()) > 0);
    await page.keyboard.press("Escape");
  });
  await check("Every workspace navigation page renders", async () => {
    for (const name of [
      "Customers",
      "Products & plans",
      "Quotations",
      "Payments",
      "Taxes & discounts",
      "Reports",
      "Team & access",
      "Audit log",
      "Settings",
    ]) {
      await page.locator(".nav-item").filter({ hasText: name }).click();
      await page.getByRole("heading", { name, exact: true }).waitFor();
    }
  });
  await check(
    "Customer preview hides staff navigation and scopes rows",
    async () => {
      await page.getByRole("button", { name: "Open account menu" }).click();
      await page
        .getByRole("button", { name: "Customer portal", exact: true })
        .click();
      await page
        .getByRole("heading", { name: "Your subscriptions, simplified." })
        .waitFor();
      assert.equal(
        await page
          .locator(".nav-item")
          .filter({ hasText: "Team & access" })
          .count(),
        0,
      );
      assert.equal(
        await page
          .locator(".nav-item")
          .filter({ hasText: "Customers" })
          .count(),
        0,
      );
      const names = await page
        .locator(".compact-table .customer-cell strong")
        .allTextContents();
      assert.ok(names.every((x) => x === "Acme Inc."));
    },
  );
  await check("Mobile navigation, layout and dashboard fit 390px", async () => {
    await page.getByRole("button", { name: "Open account menu" }).click();
    await page
      .getByRole("button", { name: "Administrator", exact: true })
      .click();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(300);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
    console.log(
      "MOBILE OVERFLOW",
      await page.evaluate(() => ({
        width: innerWidth,
        scroll: document.documentElement.scrollWidth,
        nodes: [...document.querySelectorAll("main *")]
          .filter((e) => e.getBoundingClientRect().right > innerWidth + 1)
          .map((e) => ({
            tag: e.tagName,
            cls: e.className,
            width: e.getBoundingClientRect().width,
            right: e.getBoundingClientRect().right,
          }))
          .slice(0, 15),
      })),
    );
    await page.screenshot({
      path: "/tmp/brightloop-tests/mobile.png",
      fullPage: true,
    });
    await page.getByRole("button", { name: "Open navigation" }).click();
    await page
      .locator(".nav-item")
      .filter({ hasText: "Subscriptions" })
      .click();
    await page
      .getByRole("heading", { name: "Subscriptions", exact: true })
      .waitFor();
  });
  assert.deepEqual(errors, []);
  checks.push("No browser runtime errors");
  console.log("PASS No browser runtime errors");
  await writeFile(
    "scripts/ui-results.json",
    JSON.stringify({ passed: checks.length, checks, errors }, null, 2),
  );
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
