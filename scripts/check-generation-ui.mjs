// Replays a saved provider result; no paid image/analysis requests.
import { chromium } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
const qa = new URL("../qa/", import.meta.url),
  path = (name) => fileURLToPath(new URL(name, qa));
const cached = {
  ...JSON.parse(await readFile(path("live-generation-metadata.json"), "utf8")),
  image:
    "data:image/png;base64," +
    (await readFile(path("live-generated-source.png"))).toString("base64"),
  state: "succeeded",
};
const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
let posts = 0,
  reads = 0;
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
try {
  await page.route("**/api/ai/generate", (route) => {
    posts++;
    return route.fulfill({
      status: 202,
      contentType: "application/json",
      body: JSON.stringify({
        id: cached.id,
        state: "running",
        model: cached.model,
        quality: cached.quality,
      }),
    });
  });
  await page.route("**/api/ai/generation/*", (route) => {
    reads++;
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(
        reads === 1 ? { id: cached.id, state: "running" } : cached,
      ),
    });
  });
  await page.goto("http://127.0.0.1:5186/");
  await page
    .getByRole("button", { name: "Select frame 1", exact: true })
    .click();
  await page.screenshot({
    path: path("generation-workspace.png"),
    fullPage: true,
  });
  await page
    .locator('input[type=file][accept=".json"]')
    .setInputFiles(path("analysis-project-Slime.png.json"));
  await page
    .getByRole("button", { name: "Generate Frames", exact: true })
    .click();
  const firstPoll = page.waitForResponse((r) =>
    r.url().includes("/api/ai/generation/"),
  );
  await page
    .getByRole("button", { name: "Generate frames", exact: true })
    .click();
  await firstPoll;
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  await page
    .getByRole("button", { name: "Generate Frames", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Use frames in editor", exact: true })
    .waitFor({ timeout: 30000 });
  assert.equal(posts, 1);
  const validation = await page.evaluate(async (url) => {
    const { normalizeGeneratedSheet } =
      await import("/src/generated-frames.js");
    const c = await normalizeGeneratedSheet(url);
    return {
      segmentation: c.segmentation,
      warnings: c.warnings,
      count: c.frames.flat().length,
    };
  }, cached.image);
  assert.equal(validation.segmentation, "connected-silhouettes");
  assert.equal(validation.count, 24);
  assert.deepEqual(validation.warnings, []);
  await page.screenshot({
    path: path("generated-preview.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  assert.ok(
    await page
      .getByRole("dialog")
      .evaluate((el) => el.scrollWidth <= el.clientWidth),
  );
  await page
    .getByRole("dialog")
    .evaluate((el) => (el.scrollTop = el.scrollHeight));
  await page.screenshot({
    path: path("generation-mobile.png"),
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Use frames in editor", exact: true })
    .click();
  await page.getByRole("tab", { name: "Attack", exact: true }).click();
  assert.equal(
    await page.getByLabel("Source row", { exact: true }).inputValue(),
    "2",
  );
  assert.deepEqual(errors, []);
  await writeFile(
    path("generation-ui-results.json"),
    JSON.stringify(
      {
        passed: true,
        posts,
        checks: [
          "Generate action starts one job",
          "Closing/reopening resumes status without a second generation",
          "Connected silhouettes retain all 24 poses without grid cut warnings",
          "Mobile generation dialog scrolls without horizontal overflow",
          "Applying frames selects the correct Attack row",
          "No JavaScript errors",
        ],
        validation,
      },
      null,
      2,
    ),
  );
  console.log("Generation UI replay passed; no paid requests.");
} finally {
  await browser.close();
}
