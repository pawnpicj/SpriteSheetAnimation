import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import {
  createGenerationMiddleware,
  framePrompt,
} from "../server/generation.mjs";
const profile = {
  name: "Slime",
  description: "A yellow slime",
  bodyPlan: "amorphous",
  confidence: "high",
  anatomy: {
    visibleLegs: 0,
    visibleArms: 0,
    facing: "front",
    weapons: [],
    movingParts: ["body"],
    observations: ["No legs"],
  },
  walk: {
    name: "Bounce",
    description: "Squash and stretch",
    keyPoses: Array.from({ length: 8 }, (_, i) => "Pose " + i),
  },
  attacks: [
    {
      name: "Body slam",
      description: "Jump and land",
      anticipation: "Squash",
      impact: "Land",
      recovery: "Settle",
      hitFrame: 5,
    },
  ],
  uncertainties: ["Back"],
  generationPrompt: "Preserve the original slime",
};
const input = {
  image: "data:image/png;base64,iVBORw0KGgo=",
  profile,
  attackIndex: 0,
  quality: "medium",
};
async function server(fetchImpl, run, timeoutMs = 1000) {
  const middleware = createGenerationMiddleware(
    { OPENROUTER_API_KEY: "dummy-test-key" },
    { fetchImpl, timeoutMs },
  );
  const s = createServer((req, res) =>
    middleware(req, res, () => {
      res.writeHead(404);
      res.end();
    }),
  );
  await new Promise((r) => s.listen(0, "127.0.0.1", r));
  const url = "http://127.0.0.1:" + s.address().port;
  try {
    await run(url);
  } finally {
    await new Promise((r) => s.close(r));
  }
}
const post = (url, body = input) =>
  fetch(url + "/api/ai/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
async function finished(url, id) {
  for (let n = 0; n < 100; n++) {
    const j = await (await fetch(url + "/api/ai/generation/" + id)).json();
    if (j.state !== "running") return j;
    await new Promise((r) => setTimeout(r, 10));
  }
  throw Error("Job did not finish");
}
test("generation produces one reference-based image job and retains its exact plan", async () => {
  await server(
    async (url, options) => {
      assert.equal(url, "https://openrouter.ai/api/v1/images");
      assert.equal(options.headers.Authorization, "Bearer dummy-test-key");
      const b = JSON.parse(options.body);
      assert.equal(b.model, "openai/gpt-image-2.5-sunburst");
      assert.equal(b.n, 1);
      assert.equal(b.background, "transparent");
      assert.equal(b.input_references[0].image_url.url, input.image);
      assert.match(b.prompt, /FOUR COLUMNS and SIX ROWS/);
      assert.match(b.prompt, /Body slam/);
      return new Response(
        JSON.stringify({
          data: [{ b64_json: "iVBORw0KGgo=", media_type: "image/png" }],
          usage: { cost: 0.1 },
        }),
      );
    },
    async (url) => {
      const r = await post(url);
      assert.equal(r.status, 202);
      const { id } = await r.json();
      const j = await finished(url, id);
      assert.equal(j.state, "succeeded");
      assert.equal(j.profile.bodyPlan, "amorphous");
      assert.equal(j.attackIndex, 0);
      assert.equal(j.attackName, "Body slam");
      assert.ok(j.image.startsWith("data:image/png;base64,"));
      assert.ok(!JSON.stringify(j).includes("dummy-test-key"));
      assert.equal(j.controller, undefined);
    },
  );
});
test("jobs reject cross-site calls and malformed profiles without generating", async () => {
  await server(
    () => {
      throw Error("Must not generate");
    },
    async (url) => {
      const bad = await post(url, { ...input, profile: { name: "invalid" } });
      assert.equal(bad.status, 400);
      const cross = await fetch(url + "/api/ai/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "https://evil.example",
        },
        body: JSON.stringify(input),
      });
      assert.equal(cross.status, 403);
    },
  );
});
test("one active job prevents duplicate spend and supports cancellation", async () => {
  let calls = 0;
  await server(
    async (url, options) => {
      calls++;
      return new Promise((resolve, reject) =>
        options.signal.addEventListener(
          "abort",
          () => reject(Error("aborted")),
          { once: true },
        ),
      );
    },
    async (url) => {
      const first = await (await post(url)).json();
      const duplicate = await post(url);
      assert.equal(duplicate.status, 429);
      assert.equal(calls, 1);
      const result = await (
        await fetch(url + "/api/ai/generation/" + first.id, {
          method: "DELETE",
        })
      ).json();
      assert.equal(result.state, "cancelled");
    },
  );
});
test("upstream errors never include raw secret-bearing provider messages", async () => {
  await server(
    async () =>
      new Response(JSON.stringify({ error: { message: "dummy-test-key" } }), {
        status: 402,
      }),
    async (url) => {
      const first = await (await post(url)).json();
      const job = await finished(url, first.id);
      assert.equal(job.state, "failed");
      assert.match(job.error, /เครดิต/);
      assert.ok(!JSON.stringify(job).includes("dummy-test-key"));
    },
  );
});
