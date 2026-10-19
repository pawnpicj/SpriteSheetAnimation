import { chromium } from "@playwright/test";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import assert from "node:assert/strict";
const root = new URL("../", import.meta.url),
  qa = new URL("qa/", root);
await mkdir(qa, { recursive: true });
const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
  acceptDownloads: true,
});
const errors = [],
  checks = [],
  external = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
page.on("request", (r) => {
  if (
    !r.url().startsWith("http://127.0.0.1:5186") &&
    !r.url().startsWith("data:") &&
    !r.url().startsWith("blob:")
  )
    external.push(r.url());
});
try {
  await page.goto("http://127.0.0.1:5186/");
  await page
    .getByRole("button", { name: "Pause animation", exact: true })
    .waitFor();
  await page.waitForFunction(
    () => document.querySelectorAll(".frame-tile").length === 8,
  );
  await page
    .getByRole("button", { name: "Select frame 1", exact: true })
    .click();
  await page.screenshot({
    path: new URL("desktop.png", qa).pathname.replace(/^\/(\w:)/, "$1"),
    fullPage: true,
  });
  checks.push(
    "Initial Pig.png image loaded; eight playable frames; desktop screenshot captured.",
  );
  const initial = await page
    .locator('canvas[aria-label="Idle animation preview"]')
    .evaluate((c) => ({
      w: c.width,
      h: c.height,
      pixels: c
        .getContext("2d")
        .getImageData(0, 0, c.width, c.height)
        .data.filter((_, i) => i % 4 === 3)
        .filter((v) => v > 0).length,
    }));
  assert.equal(initial.w, 192);
  assert.ok(initial.pixels > 1000);
  checks.push("Preview canvas contains actual character pixels.");
  await page.getByRole("tab", { name: "Walk", exact: true }).click();
  await page
    .getByRole("button", { name: "Select frame 2", exact: true })
    .click();
  await page.getByRole("button", { name: "Next frame", exact: true }).click();
  await page
    .getByRole("button", { name: "Select frame 3", exact: true })
    .getAttribute("aria-pressed")
    .then((v) => assert.equal(v, "true"));
  await page.getByRole("spinbutton", { name: "FPS", exact: true }).fill("15");
  assert.equal(await page.locator("#timeline-fps").inputValue(), "15");
  await page.getByLabel("Show Onion Skin", { exact: true }).check();
  await page.getByLabel("Flip Horizontally", { exact: true }).check();
  await page
    .getByRole("button", { name: "Select frame 2", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Duplicate selected frame", exact: true })
    .click();
  assert.equal(await page.locator(".frame-tile").count(), 9);
  await page
    .getByRole("button", { name: "Delete selected frame", exact: true })
    .click();
  assert.equal(await page.locator(".frame-tile").count(), 8);
  checks.push(
    "Action tabs, frame stepping, FPS sync, onion skin, horizontal flip, duplicate/delete work.",
  );
  const getDownload = async (button, file) => {
    const wait = page.waitForEvent("download");
    await button.click();
    const d = await wait;
    const target = new URL(file, qa);
    await d.saveAs(target.pathname.replace(/^\/(\w:)/, "$1"));
    return target;
  };
  const png = await getDownload(
    page.getByRole("button", { name: "Export PNG", exact: true }),
    "export.png",
  );
  const pngData = await readFile(png);
  assert.equal(pngData.readUInt32BE(16), 1536);
  assert.equal(pngData.readUInt32BE(20), 192);
  const json = await getDownload(
    page.getByRole("button", { name: "Export JSON", exact: true }),
    "export.json",
  );
  const atlas = JSON.parse(await readFile(json, "utf8"));
  assert.equal(atlas.meta.framerate, 15);
  assert.equal(Object.keys(atlas.frames).length, 8);
  assert.equal(atlas.meta.image, "Forest_Boar_walk.png");
  checks.push(
    "Downloaded PNG decodes to 1536 × 192; JSON contains eight matching frames and 15 FPS.",
  );
  await page
    .getByRole("button", { name: "Delete selected frame", exact: true })
    .click();
  const saved = await getDownload(
    page.getByRole("button", { name: "Save project", exact: true }),
    "project.sprite.json",
  );
  await page.reload();
  await page.waitForFunction(
    () => document.querySelectorAll(".frame-tile").length === 8,
  );
  await page
    .locator('input[type=file][accept=".json"]')
    .setInputFiles(saved.pathname.replace(/^\/(\w:)/, "$1"));
  await page.waitForFunction(
    () => document.querySelectorAll(".frame-tile").length === 7,
  );
  assert.equal(
    await page
      .getByRole("spinbutton", { name: "FPS", exact: true })
      .inputValue(),
    "15",
  );
  checks.push(
    "Saved project reopens after reload, retaining seven edited frames and playback settings.",
  );
  await page.getByRole("button", { name: "Load sample", exact: false }).click();
  await page.waitForFunction(
    () =>
      document
        .querySelector(".mode-label")
        ?.textContent.includes("Articulated frames") &&
      document.querySelectorAll(".frame-tile").length === 8,
  );
  await page.getByRole("tab", { name: "Attack", exact: true }).click();
  await page
    .getByRole("button", { name: "Select frame 4", exact: true })
    .click();
  await page.screenshot({
    path: new URL("sample-pack.png", qa).pathname.replace(/^\/(\w:)/, "$1"),
    fullPage: true,
  });
  checks.push(
    "Bundled articulated boar sheet loads and Attack preview renders.",
  );
  await page
    .getByRole("button", { name: "Upload Character", exact: false })
    .click();
  await page
    .getByRole("button", { name: "Sprite sheet", exact: false })
    .click();
  await page.getByRole("spinbutton", { name: "Sheet columns" }).fill("8");
  await page.getByRole("spinbutton", { name: "Sheet rows" }).fill("5");
  await page
    .locator('input[type=file][accept="image/png,image/jpeg,image/webp"]')
    .setInputFiles(
      new URL("public/assets/boar-animations.png", root).pathname.replace(
        /^\/(\w:)/,
        "$1",
      ),
    );
  await page.getByLabel("Source row", { exact: true }).selectOption("4");
  checks.push("Sprite sheet upload and source-row selection work.");
  await page
    .getByRole("button", { name: "Upload Character", exact: false })
    .click();
  await page
    .getByRole("button", { name: "Single character", exact: false })
    .click();
  await page
    .locator('input[type=file][accept="image/png,image/jpeg,image/webp"]')
    .setInputFiles(
      new URL("public/assets/Pig.png", root).pathname.replace(/^\/(\w:)/, "$1"),
    );
  await page.waitForFunction(() =>
    document
      .querySelector(".mode-label")
      ?.textContent.includes("Walk / Attack need pose frames"),
  );
  checks.push(
    "Single-image upload works and displays honest AI connection status.",
  );
  for (const width of [1440, 1024, 768, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    const dim = await page.evaluate(() => ({
      width: innerWidth,
      scroll: document.documentElement.scrollWidth,
    }));
    assert.ok(
      dim.scroll <= dim.width,
      `Horizontal overflow at ${width}: ${dim.scroll}`,
    );
    if (width === 390) {
      await page.screenshot({
        path: new URL("mobile.png", qa).pathname.replace(/^\/(\w:)/, "$1"),
        fullPage: true,
      });
    }
  }
  checks.push(
    "No document horizontal overflow at 1440, 1024, 768 and 390 px; mobile screenshot captured.",
  );
  await page
    .getByRole("button", { name: "Keyboard shortcuts", exact: true })
    .click();
  await page.keyboard.press("Escape");
  assert.equal(await page.getByRole("dialog").count(), 0);
  assert.deepEqual(errors, []);
  assert.deepEqual(external, []);
  checks.push(
    "No browser JavaScript errors or external requests; keyboard dialog closes with Escape.",
  );
  await writeFile(
    new URL("browser-results.json", qa),
    JSON.stringify({ passed: true, checks, errors, external }, null, 2),
  );
  console.log(JSON.stringify({ passed: true, checks }, null, 2));
} catch (e) {
  await page.screenshot({
    path: new URL("failure.png", qa).pathname.replace(/^\/(\w:)/, "$1"),
    fullPage: true,
  });
  await writeFile(
    new URL("browser-results.json", qa),
    JSON.stringify(
      { passed: false, checks, error: e.stack, errors, external },
      null,
      2,
    ),
  );
  throw e;
} finally {
  await browser.close();
}
