// Explicit live integration verification. Sends three user-provided example images.
// Do not include this script in automatic test commands: it consumes API credits.
import { chromium } from "@playwright/test";
import { writeFile, mkdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
const qa = new URL("../qa/", import.meta.url);
await mkdir(qa, { recursive: true });
const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({
  viewport: { width: 1440, height: 1000 },
  acceptDownloads: true,
});
const results = [],
  errors = [];
page.on("pageerror", (e) => errors.push(e.message));
try {
  await page.goto("http://127.0.0.1:5186/");
  for (const [file, bodyPlan] of [
    ["Slime.png", "amorphous"],
    ["Snack.png", "serpentine"],
    ["Orc.png", "biped"],
  ]) {
    await page
      .getByRole("button", { name: "Upload Character", exact: false })
      .click();
    await page
      .getByRole("button", { name: "Single character", exact: false })
      .click();
    await page
      .locator('input[type=file][accept="image/png,image/jpeg,image/webp"]')
      .setInputFiles("C:/Users/pornpichit.ch/Pictures/" + file);
    await page
      .getByRole("button", { name: "Analyze Monster", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Analyze image", exact: true })
      .waitFor({ state: "visible" });
    const request = page.waitForRequest((r) =>
      r.url().endsWith("/api/ai/analyze"),
    );
    const response = page.waitForResponse(
      (r) => r.url().endsWith("/api/ai/analyze"),
      { timeout: 100000 },
    );
    await page
      .getByRole("button", { name: "Analyze image", exact: true })
      .click();
    const req = await request;
    assert.ok(!req.headers().authorization);
    assert.ok(!req.postData().includes("sk-or-"));
    const res = await response;
    const data = await res.json();
    if (!res.ok()) throw Error(file + ": " + data.error);
    assert.equal(data.analysis.bodyPlan, bodyPlan);
    await page.getByLabel("Monster body plan", { exact: true }).waitFor();
    assert.equal(
      await page.getByLabel("Monster body plan", { exact: true }).inputValue(),
      bodyPlan,
    );
    await writeFile(
      new URL(
        "live-analysis-" + file.replace(".png", "").toLowerCase() + ".json",
        qa,
      ),
      JSON.stringify(data, null, 2),
    );
    await page.screenshot({
      path: fileURLToPath(
        new URL(
          "analysis-" + file.replace(".png", "").toLowerCase() + ".png",
          qa,
        ),
      ),
      fullPage: true,
    });
    await page
      .getByRole("textbox", { name: "Monster profile name", exact: true })
      .fill(data.analysis.name + " · reviewed");
    await page
      .getByRole("button", { name: "Save motion profile", exact: true })
      .click();
    await page
      .getByRole("button", { name: "View AI profile", exact: true })
      .waitFor();
    const ready = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "Save project", exact: true })
      .click();
    const download = await ready;
    const path = fileURLToPath(
      new URL("analysis-project-" + file + ".json", qa),
    );
    await download.saveAs(path);
    const text = await readFile(path, "utf8");
    assert.ok(!text.includes("sk-or-"));
    const project = JSON.parse(text);
    assert.equal(project.asset.analysis.profile.bodyPlan, bodyPlan);
    assert.ok(project.asset.analysis.profile.name.endsWith("reviewed"));
    results.push({
      file,
      bodyPlan: data.analysis.bodyPlan,
      model: data.model,
      walk: data.analysis.walk.name,
      attacks: data.analysis.attacks.map((a) => a.name),
      usage: data.usage,
    });
  }
  assert.deepEqual(errors, []);
  await writeFile(
    new URL("live-analysis-results.json", qa),
    JSON.stringify({ passed: true, results, errors }, null, 2),
  );
  console.log(JSON.stringify({ passed: true, results }, null, 2));
} catch (e) {
  await page.screenshot({
    path: fileURLToPath(new URL("analysis-failure.png", qa)),
    fullPage: true,
  });
  throw e;
} finally {
  await browser.close();
}
