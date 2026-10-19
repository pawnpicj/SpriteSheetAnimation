import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createOpenRouterMiddleware } from "../server/openrouter.mjs";
const profile = {
  name: "Test slime",
  description: "A soft body",
  bodyPlan: "amorphous",
  confidence: "high",
  anatomy: {
    visibleLegs: 0,
    visibleArms: 0,
    facing: "front",
    weapons: [],
    movingParts: ["body"],
    observations: ["No visible legs"],
  },
  walk: {
    name: "Bounce",
    description: "Squash and stretch",
    keyPoses: Array.from({ length: 8 }, (_, i) => "Pose " + i),
  },
  attacks: [
    {
      name: "Slam",
      description: "Jump",
      anticipation: "Crouch",
      impact: "Land",
      recovery: "Settle",
      hitFrame: 5,
    },
  ],
  uncertainties: ["Hidden back"],
  generationPrompt: "Preserve the slime identity",
};
async function withServer(env, fetchImpl, run) {
  const middleware = createOpenRouterMiddleware(env, { fetchImpl });
  const server = createServer((req, res) =>
    middleware(req, res, () => {
      res.writeHead(404);
      res.end();
    }),
  );
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const url = "http://127.0.0.1:" + server.address().port;
  try {
    await run(url);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}
const request = {
  image: "data:image/png;base64,iVBORw0KGgo=",
  notes: "reference only",
};
const env = {
  OPENROUTER_API_KEY: "test-server-secret",
  OPENROUTER_MODEL: "openai/gpt-6.1-sol",
  OPENROUTER_REASONING: "medium",
  OPENROUTER_APP_NAME: "MyAppForAI",
};
test("status never exposes the key; image request uses server-side credentials and requested model", async () => {
  await withServer(
    env,
    async (url, options) => {
      assert.equal(options.headers.Authorization, "Bearer test-server-secret");
      assert.equal(options.headers["X-Title"], "MyAppForAI");
      const body = JSON.parse(options.body);
      assert.equal(body.model, env.OPENROUTER_MODEL);
      assert.equal(body.reasoning.effort, "medium");
      assert.equal(body.messages[1].content[1].image_url.url, request.image);
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: JSON.stringify(profile) } }],
          model: env.OPENROUTER_MODEL,
          usage: { prompt_tokens: 10, completion_tokens: 20 },
        }),
      );
    },
    async (url) => {
      const status = await (await fetch(url + "/api/ai/status")).text();
      assert.ok(!status.includes(env.OPENROUTER_API_KEY));
      assert.equal(JSON.parse(status).configured, true);
      const response = await fetch(url + "/api/ai/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });
      assert.equal(response.status, 200);
      assert.deepEqual((await response.json()).analysis, profile);
    },
  );
});
test("cross-site requests, malformed input and missing keys do not reach the provider", async () => {
  const never = () => {
    throw Error("Provider must not be called");
  };
  await withServer(env, never, async (url) => {
    const blocked = await fetch(url + "/api/ai/analyze", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "https://untrusted.example",
      },
      body: JSON.stringify(request),
    });
    assert.equal(blocked.status, 403);
    const invalid = await fetch(url + "/api/ai/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: "https://example.com/image.png" }),
    });
    assert.equal(invalid.status, 400);
  });
  await withServer({}, never, async (url) => {
    const result = await fetch(url + "/api/ai/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });
    assert.equal(result.status, 503);
  });
});
test("provider errors and invalid structured responses are sanitized", async () => {
  await withServer(
    env,
    async () =>
      new Response(
        JSON.stringify({ error: { message: env.OPENROUTER_API_KEY } }),
        { status: 401 },
      ),
    async (url) => {
      const r = await fetch(url + "/api/ai/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });
      assert.equal(r.status, 502);
      assert.ok(!(await r.text()).includes(env.OPENROUTER_API_KEY));
    },
  );
  await withServer(
    env,
    async () =>
      new Response(
        JSON.stringify({
          choices: [{ message: { content: '{"madeUp":true}' } }],
        }),
      ),
    async (url) => {
      const r = await fetch(url + "/api/ai/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });
      assert.equal(r.status, 502);
    },
  );
});
