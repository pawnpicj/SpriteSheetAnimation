import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const root = new URL("../", import.meta.url),
  qa = new URL("qa/", root);
await mkdir(qa, { recursive: true });
const path = (name) => fileURLToPath(new URL(name, qa));
const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({
  viewport: { width: 1440, height: 1000 },
  acceptDownloads: true,
});
const errors = [],
  checks = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
const snap = () =>
  page.locator(".preview-stage>canvas").evaluate((c) => c.toDataURL());
const download = async (button, name) => {
  const ready = page.waitForEvent("download");
  await button.click();
  await (await ready).saveAs(path(name));
  return path(name);
};
try {
  await page.goto("http://127.0.0.1:5186");
  await page.waitForFunction(
    () => document.querySelectorAll(".frame-tile").length === 8,
  );
  await page.getByRole("tab", { name: "Walk", exact: true }).click();
  assert.equal(
    await page.getByLabel("Source row", { exact: true }).inputValue(),
    "1",
  );
  assert.equal(
    await page
      .getByRole("spinbutton", { name: "FPS", exact: true })
      .inputValue(),
    "8",
  );
  await page
    .getByRole("button", { name: "Select frame 1", exact: true })
    .click();
  const walkA = await snap();
  await page
    .getByRole("button", { name: "Select frame 5", exact: true })
    .click();
  assert.notEqual(walkA, await snap());
  await page.screenshot({ path: path("walk-v2.png"), fullPage: true });
  checks.push(
    "Walk uses its dedicated articulated row at 8 FPS; phase 1 and phase 5 differ.",
  );
  await page.getByRole("tab", { name: "Attack", exact: true }).click();
  assert.equal(
    await page.getByLabel("Source row", { exact: true }).inputValue(),
    "2",
  );
  assert.equal(
    await page.getByLabel("Loop Playback", { exact: true }).isChecked(),
    false,
  );
  await page
    .getByRole("button", { name: "Select frame 5", exact: true })
    .click();
  const charge = await snap();
  await page.getByLabel("Attack type", { exact: true }).selectOption("tusk");
  await page
    .getByRole("button", { name: "Select frame 5", exact: true })
    .click();
  const tusk = await snap();
  assert.notEqual(charge, tusk);
  assert.equal(
    await page.getByLabel("Source row", { exact: true }).inputValue(),
    "3",
  );
  await page
    .getByRole("spinbutton", { name: "Hit frame", exact: true })
    .fill("6");
  await page.waitForFunction(
    () =>
      document
        .querySelector(".frame-tile.hit-frame")
        ?.getAttribute("aria-label") === "Select frame 6",
  );
  await page
    .getByRole("button", { name: "Select frame 5", exact: true })
    .click();
  await page.screenshot({ path: path("tusk-attack-v2.png"), fullPage: true });
  checks.push(
    "Charge and tusk strike use distinct image rows; attack is non-looping; editable hit marker works.",
  );
  const jsonFile = await download(
    page.getByRole("button", { name: "Export JSON", exact: true }),
    "tusk-atlas.json",
  );
  const atlas = JSON.parse(await readFile(jsonFile, "utf8"));
  assert.equal(atlas.meta.loop, false);
  assert.equal(atlas.meta.attack.name, "งัดเขี้ยว · Tusk strike");
  assert.equal(atlas.meta.attack.sourceRow, 3);
  assert.equal(atlas.meta.attack.events[0].frame, 5);
  assert.equal(atlas.frames.attack_003.duration, 70);
  assert.equal(atlas.meta.attack.events[0].timeMs, 510);
  checks.push(
    "Atlas exports the correct attack, source row, varied frame durations and hit time.",
  );
  const saved = await download(
    page.getByRole("button", { name: "Save project", exact: true }),
    "monster-project.sprite.json",
  );
  await page.reload();
  await page.waitForFunction(
    () => document.querySelectorAll(".frame-tile").length === 8,
  );
  await page.locator('input[type=file][accept=".json"]').setInputFiles(saved);
  await page.waitForFunction(
    () =>
      document.querySelector('select[aria-label="Attack type"]')?.value ===
      "tusk",
  );
  assert.equal(
    await page.getByLabel("Source row", { exact: true }).inputValue(),
    "3",
  );
  assert.equal(
    await page
      .getByRole("spinbutton", { name: "Hit frame", exact: true })
      .inputValue(),
    "6",
  );
  await page
    .getByRole("button", { name: "Restart animation", exact: true })
    .click();
  await page.waitForFunction(
    () => document.querySelector(".play-state")?.textContent === "PAUSED",
  );
  assert.equal(
    await page
      .getByRole("button", { name: "Select frame 8", exact: true })
      .getAttribute("aria-pressed"),
    "true",
  );
  checks.push(
    "Saved project retains selected attack and hit timing; one-shot animation completes and stops.",
  );
  await page.getByRole("tab", { name: "Walk", exact: true }).click();
  assert.equal(
    await page.getByLabel("Source row", { exact: true }).inputValue(),
    "1",
  );
  await page.getByLabel("Source row", { exact: true }).selectOption("0");
  await page.getByRole("tab", { name: "Attack", exact: true }).click();
  assert.equal(
    await page.getByLabel("Source row", { exact: true }).inputValue(),
    "3",
  );
  await page.getByRole("tab", { name: "Walk", exact: true }).click();
  assert.equal(
    await page.getByLabel("Source row", { exact: true }).inputValue(),
    "0",
  );
  checks.push("Changing Walk row does not overwrite the monster attack row.");
  await page
    .getByRole("button", { name: "Select original Pig.png", exact: true })
    .click();
  await page.waitForFunction(() =>
    document.querySelector(".mode-label")?.textContent.includes("Idle study"),
  );
  assert.equal(
    await page.getByRole("tab", { name: "Walk", exact: true }).isDisabled(),
    true,
  );
  assert.equal(
    await page.getByRole("tab", { name: "Attack", exact: true }).isDisabled(),
    true,
  );
  checks.push(
    "Raw single images cannot masquerade as articulated walk or attack animations.",
  );
  await page
    .getByRole("button", { name: "Upload Character", exact: false })
    .click();
  await page
    .getByRole("button", { name: "Sprite sheet", exact: false })
    .click();
  await page.getByRole("spinbutton", { name: "Sheet columns" }).fill("8");
  await page.getByRole("spinbutton", { name: "Sheet rows" }).fill("4");
  await page
    .locator('input[type=file][accept="image/png,image/jpeg,image/webp"]')
    .setInputFiles(
      fileURLToPath(new URL("public/assets/boar-articulated-v2.png", root)),
    );
  await page.getByRole("tab", { name: "Attack", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Attack name", exact: true })
    .fill("Wolf bite");
  await page.getByLabel("Source row", { exact: true }).selectOption("1");
  const custom = JSON.parse(
    await readFile(
      await download(
        page.getByRole("button", { name: "Export JSON", exact: true }),
        "custom-attack.json",
      ),
      "utf8",
    ),
  );
  assert.equal(custom.meta.attack.name, "Wolf bite");
  assert.equal(custom.meta.attack.sourceRow, 1);
  checks.push(
    "Imported monsters support their own attack label and independently mapped pose row.",
  );
  await page.getByRole("button", { name: "Load sample", exact: false }).click();
  await page.getByRole("tab", { name: "Attack", exact: true }).click();
  await page.getByLabel("Attack type", { exact: true }).selectOption("tusk");
  await page
    .getByRole("button", { name: "Select frame 5", exact: true })
    .click();
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await page.screenshot({ path: path("attack-mobile-v2.png"), fullPage: true });
  assert.deepEqual(errors, []);
  await writeFile(
    path("monster-motion-results.json"),
    JSON.stringify({ passed: true, checks, errors }, null, 2),
  );
  console.log(JSON.stringify({ passed: true, checks }, null, 2));
} catch (e) {
  await page.screenshot({ path: path("monster-failure.png"), fullPage: true });
  throw e;
} finally {
  await browser.close();
}
