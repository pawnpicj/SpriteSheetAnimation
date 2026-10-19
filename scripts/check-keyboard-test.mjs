import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const qa = new URL("../qa/", import.meta.url);
await mkdir(qa, { recursive: true });
const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [],
  checks = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
const actor = () =>
  page.locator('canvas[aria-label="Keyboard walk and attack test"]');
const coord = async (axis) =>
  Number(await actor().getAttribute("data-" + axis));
async function hold(code, ms = 300) {
  await page.keyboard.down(code);
  await page.waitForTimeout(ms);
  await page.keyboard.up(code);
}
try {
  await page.goto("http://127.0.0.1:5186/");
  await page.getByRole("button", { name: "Test Play", exact: true }).click();
  await actor().waitFor();
  await page.waitForFunction(
    () =>
      document.querySelector(".test-arena canvas")?.dataset.action === "Idle",
  );
  assert.equal(
    await actor().evaluate((el) => el === document.activeElement),
    true,
  );
  let x = await coord("x");
  await page.keyboard.down("d");
  await page.waitForFunction(
    () =>
      document.querySelector(".test-arena canvas")?.dataset.action === "Walk",
  );
  await page.waitForTimeout(300);
  await page.keyboard.up("d");
  assert.ok((await coord("x")) > x + 25);
  assert.equal(await actor().getAttribute("data-facing"), "1");
  await page.waitForFunction(
    () =>
      document.querySelector(".test-arena canvas")?.dataset.action === "Idle",
  );
  x = await coord("x");
  await hold("a");
  assert.ok((await coord("x")) < x - 25);
  assert.equal(await actor().getAttribute("data-facing"), "-1");
  let y = await coord("y");
  await hold("w", 180);
  assert.ok((await coord("y")) < y - 10);
  y = await coord("y");
  await hold("s", 180);
  assert.ok((await coord("y")) > y + 10);
  checks.push(
    "W/A/S/D move the actor; A/D switch facing; releasing movement returns to Idle.",
  );
  await page.keyboard.down("d");
  await page.waitForTimeout(120);
  await page.keyboard.down("Space");
  await page.waitForFunction(
    () =>
      document.querySelector(".test-arena canvas")?.dataset.action === "Attack",
  );
  const locked = await coord("x");
  await page.waitForTimeout(200);
  assert.ok(Math.abs((await coord("x")) - locked) <= 2);
  await page.keyboard.up("d");
  await page.waitForFunction(
    () =>
      document.querySelector(".test-status strong")?.textContent === "IMPACT",
  );
  await page.screenshot({
    path: fileURLToPath(new URL("keyboard-attack.png", qa)),
    fullPage: true,
  });
  await page.waitForFunction(
    () =>
      document.querySelector(".test-arena canvas")?.dataset.action === "Idle",
  );
  await page.waitForTimeout(200);
  assert.equal(await actor().getAttribute("data-action"), "Idle");
  await page.keyboard.up("Space");
  checks.push(
    "Space starts a one-shot attack, locks movement during it, marks impact and does not repeat while held.",
  );
  await actor().focus();
  await page.keyboard.down("d");
  await page.waitForTimeout(120);
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await page.waitForFunction(
    () =>
      document.querySelector(".test-arena canvas")?.dataset.action === "Idle",
  );
  const stopped = await coord("x");
  await page.waitForTimeout(180);
  assert.ok(Math.abs((await coord("x")) - stopped) <= 2);
  await page.keyboard.up("d");
  await page.getByRole("textbox", { name: "Project name" }).focus();
  const before = await coord("x");
  await page.keyboard.type("wasd ");
  await page.waitForTimeout(100);
  assert.equal(await actor().getAttribute("data-action"), "Idle");
  assert.equal(await coord("x"), before);
  checks.push(
    "Window blur clears held keys; typing in project inputs does not move or attack.",
  );
  await actor().focus();
  await hold("a", 2500);
  const left = await coord("x");
  assert.ok(left >= 0);
  await hold("a", 250);
  assert.ok(Math.abs((await coord("x")) - left) <= 2);
  checks.push("Movement clamps at the stage edge.");
  await page.keyboard.press("Escape");
  assert.equal(await actor().count(), 0);
  await page.getByRole("tab", { name: "Attack", exact: true }).click();
  await page.getByLabel("Attack type", { exact: true }).selectOption("tusk");
  await page.getByRole("button", { name: "Test Play", exact: true }).click();
  await actor().waitFor();
  await page.keyboard.press("Space");
  await page.waitForFunction(
    () =>
      document.querySelector(".test-arena canvas")?.dataset.action === "Attack",
  );
  await page.waitForFunction(
    () => document.querySelector(".test-arena canvas")?.dataset.frame === "4",
  );
  await page.screenshot({
    path: fileURLToPath(new URL("keyboard-tusk.png", qa)),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Exit Test", exact: true }).click();
  assert.equal(await actor().count(), 0);
  await page.locator(".preview-stage>canvas").focus();
  await page.keyboard.press("Space");
  assert.equal(
    await page
      .getByRole("button", { name: "Pause animation", exact: true })
      .count(),
    1,
  );
  checks.push(
    "Escape/Exit Test restore editor controls; Test Play uses the selected tusk attack.",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Test Play", exact: true }).click();
  await actor().waitFor();
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await page.screenshot({
    path: fileURLToPath(new URL("keyboard-mobile.png", qa)),
    fullPage: true,
  });
  assert.deepEqual(errors, []);
  await writeFile(
    new URL("keyboard-results.json", qa),
    JSON.stringify({ passed: true, checks, errors }, null, 2),
  );
  console.log(JSON.stringify({ passed: true, checks }, null, 2));
} catch (e) {
  await page.screenshot({
    path: fileURLToPath(new URL("keyboard-failure.png", qa)),
    fullPage: true,
  });
  throw e;
} finally {
  await browser.close();
}
