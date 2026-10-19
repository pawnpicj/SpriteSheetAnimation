// Manual integration check. Exactly one paid generation; never run in automatic tests.
import { chromium } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
const qa = new URL("../qa/", import.meta.url),
  path = (name) => fileURLToPath(new URL(name, qa));
const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({
  viewport: { width: 1440, height: 1000 },
  acceptDownloads: true,
});
const errors = [];
let jobId = null;
page.on("pageerror", (e) => errors.push(e.message));
async function saveDownload(button, name) {
  const d = page.waitForEvent("download");
  await button.click();
  await (await d).saveAs(path(name));
  return path(name);
}
try {
  await page.goto("http://127.0.0.1:5186/");
  await page
    .locator('input[type=file][accept=".json"]')
    .setInputFiles(path("analysis-project-Slime.png.json"));
  const resumeId = process.argv[2];
  let job;
  if (resumeId) {
    const project = JSON.parse(
      await readFile(path("analysis-project-Slime.png.json"), "utf8"),
    );
    await page.evaluate(
      async ({ reference, id }) => {
        const im = new Image();
        im.src = reference;
        await im.decode();
        const c = document.createElement("canvas");
        c.width = im.naturalWidth;
        c.height = im.naturalHeight;
        c.getContext("2d").drawImage(im, 0, 0);
        const value = c.toDataURL("image/png");
        let h = 2166136261;
        for (let i = 0; i < value.length; i++)
          h = Math.imul(h ^ value.charCodeAt(i), 16777619);
        sessionStorage.setItem(
          "sprite-generation",
          JSON.stringify({
            id,
            sourceKey: String(h),
            attackIndex: 0,
            quality: "medium",
          }),
        );
      },
      { reference: project.asset.url, id: resumeId },
    );
  }
  await page
    .getByRole("button", { name: "Generate Frames", exact: true })
    .click();
  if (resumeId) {
    job = { id: resumeId };
  } else {
    await page
      .getByRole("button", { name: "Generate frames", exact: true })
      .waitFor();
    const started = page.waitForResponse(
      (r) =>
        r.url().endsWith("/api/ai/generate") && r.request().method() === "POST",
    );
    await page
      .getByRole("button", { name: "Generate frames", exact: true })
      .click();
    const response = await started;
    job = await response.json();
    if (!response.ok()) throw Error(job.error);
  }
  jobId = job.id;
  await writeFile(
    path("live-generation-job.json"),
    JSON.stringify(job, null, 2),
  );
  console.log(
    (resumeId ? "Resuming existing generation: " : "Generation job started: ") +
      job.id,
  );
  await Promise.race([
    page
      .getByRole("button", { name: "Use frames in editor", exact: true })
      .waitFor({ timeout: 270000 }),
    page
      .getByRole("alert")
      .waitFor({ timeout: 270000 })
      .then(async () => {
        throw Error(await page.getByRole("alert").textContent());
      }),
  ]);
  await page.screenshot({
    path: path("generated-preview.png"),
    fullPage: true,
  });
  const result = await (
    await fetch("http://127.0.0.1:5186/api/ai/generation/" + job.id)
  ).json();
  await writeFile(
    path("live-generated-source.png"),
    Buffer.from(result.image.split(",")[1], "base64"),
  );
  await writeFile(
    path("live-generation-metadata.json"),
    JSON.stringify({ ...result, image: undefined }, null, 2),
  );
  await page
    .getByRole("button", { name: "Use frames in editor", exact: true })
    .click();
  await page.waitForFunction(
    () => document.querySelectorAll(".frame-tile").length === 8,
  );
  await page.getByRole("tab", { name: "Walk", exact: true }).click();
  await page
    .getByRole("button", { name: "Select frame 3", exact: true })
    .click();
  await page.screenshot({ path: path("generated-walk.png"), fullPage: true });
  await page.getByRole("tab", { name: "Attack", exact: true }).click();
  assert.equal(
    await page.getByLabel("Loop Playback", { exact: true }).isChecked(),
    false,
  );
  await page
    .getByRole("button", { name: "Select frame 5", exact: true })
    .click();
  await page.screenshot({ path: path("generated-attack.png"), fullPage: true });
  const project = JSON.parse(
    await readFile(
      await saveDownload(
        page.getByRole("button", { name: "Save project", exact: true }),
        "generated-slime.sprite.json",
      ),
      "utf8",
    ),
  );
  assert.equal(project.asset.rows, 3);
  assert.equal(project.asset.columns, 8);
  assert.equal(project.asset.generation.id, job.id);
  assert.equal(project.asset.analysis.profile.bodyPlan, "amorphous");
  assert.ok(!JSON.stringify(project).includes("sk-or-"));
  await writeFile(
    path("live-generated-aligned.png"),
    Buffer.from(project.asset.url.split(",")[1], "base64"),
  );
  const atlas = JSON.parse(
    await readFile(
      await saveDownload(
        page.getByRole("button", { name: "Export JSON", exact: true }),
        "generated-attack-atlas.json",
      ),
      "utf8",
    ),
  );
  assert.equal(atlas.meta.attack.name, project.asset.attacks[0].name);
  assert.equal(atlas.meta.attack.sourceRow, 2);
  await page.getByRole("button", { name: "Test Play", exact: true }).click();
  await page.locator(".test-arena canvas").focus();
  await page.keyboard.down("d");
  await page.waitForFunction(
    () =>
      document.querySelector(".test-arena canvas")?.dataset.action === "Walk",
  );
  await page.keyboard.up("d");
  await page.keyboard.press("Space");
  await page.waitForFunction(
    () =>
      document.querySelector(".test-arena canvas")?.dataset.action === "Attack",
  );
  await page.screenshot({
    path: path("generated-test-play.png"),
    fullPage: true,
  });
  await page.keyboard.press("Escape");
  await page.reload();
  await page
    .locator('input[type=file][accept=".json"]')
    .setInputFiles(path("generated-slime.sprite.json"));
  await page.waitForFunction(
    () =>
      document.querySelector('select[aria-label="Attack type"]')?.value ===
      "generated",
  );
  assert.equal(
    await page.getByLabel("Source row", { exact: true }).inputValue(),
    "2",
  );
  assert.deepEqual(errors, []);
  await writeFile(
    path("live-generation-results.json"),
    JSON.stringify(
      {
        passed: true,
        jobId: job.id,
        model: result.model,
        quality: result.quality,
        usage: result.usage,
        checks: [
          "One live image job produces actual transparent pose sheet",
          "Automatic 4x6 slicing and 8x3 alignment",
          "Idle, Walk and selected Attack previews",
          "Generated frames work with WASD and Space Test Play",
          "Project round trip keeps generated image, profile, source and provenance",
          "Attack export metadata matches selected pose row",
          "No browser errors or credentials in project",
        ],
      },
      null,
      2,
    ),
  );
  console.log("Live generation flow passed.");
} catch (e) {
  await page.screenshot({
    path: path("generation-failure.png"),
    fullPage: true,
  });
  if (jobId) {
    const data = await (
      await fetch("http://127.0.0.1:5186/api/ai/generation/" + jobId)
    ).json();
    if (data.image)
      await writeFile(
        path("live-generated-source.png"),
        Buffer.from(data.image.split(",")[1], "base64"),
      );
    await writeFile(
      path("live-generation-metadata.json"),
      JSON.stringify({ ...data, image: undefined }, null, 2),
    );
  }
  throw e;
} finally {
  await browser.close();
}
