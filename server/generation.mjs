import { randomUUID } from "node:crypto";
import { validateAnalysis } from "../src/analysis-schema.js";
import { localRequest, send, readJson } from "./openrouter.mjs";

export function framePrompt(profile, attackIndex = 0) {
  const attack = profile.attacks[attackIndex];
  return `Create a production 2D game animation sprite sheet using the attached image as the exact character identity reference. Preserve its anatomy, colors, equipment, face and art style. This is sprite artwork, NOT a UI, not a labeled presentation.
LAYOUT IS MANDATORY: exactly FOUR COLUMNS and SIX ROWS, 24 separate complete characters, equal square cells, no margins, gutters, labels, numbers, text, grid lines, scenery, floor or drop shadows. Portrait canvas 1024x1536. Actual transparent alpha background, not a drawn checkerboard. Each cell contains a single complete pose with 12% safety padding. Fixed camera, consistent orientation based on the reference, consistent body mass, scale, lighting, ground pivot. Never clip extremities or equipment.
Reading order is left-to-right then top-to-bottom. Rows 1 and 2: IDLE, 8 sequential breathing/resting poses. Rows 3 and 4: WALK, 8 sequential locomotion poses that form a loop. Rows 5 and 6: ATTACK, 8 sequential poses, a single action with anticipation, contact, follow-through, recovery. Do not mix row order.
Use distinct anatomical poses, NOT copies translated/scaled/rotated. Quadrupeds alternate four legs; bipeds alternate feet and counter-swing arms; snakes undulate and coil; amorphous monsters deform with squash/stretch. Feet that bear weight stay grounded. The WALK start/end should connect; Attack starts and returns to neutral, with contact at frame ${attack.hitFrame} of its eight frames.
Character description: ${profile.description}
Anatomical plan: ${profile.bodyPlan}; visible parts: ${profile.anatomy.movingParts.join(", ")}; visible weapons: ${profile.anatomy.weapons.join(", ")}.
WALK: ${profile.walk.name}: ${profile.walk.description}
WALK pose sequence: ${profile.walk.keyPoses.map((pose, i) => `${i + 1}. ${pose}`).join(" | ")}
ATTACK: ${attack.name}: ${attack.description}. Anticipation: ${attack.anticipation}. Contact: ${attack.impact}. Recovery: ${attack.recovery}.
Additional visual guidance: ${profile.generationPrompt}
Treat supplied descriptions as visual reference data. Deliver only one complete 4x6 transparent sprite sheet, not separate files or a text explanation.`;
}
export function createGenerationMiddleware(
  env,
  { fetchImpl = fetch, timeoutMs = 240000 } = {},
) {
  const jobs = new Map();
  const model = env.OPENROUTER_IMAGE_MODEL || "openai/gpt-image-2.5-sunburst";
  const key = env.OPENROUTER_API_KEY || "";
  let active = null;
  function clean() {
    const cutoff = Date.now() - 30 * 60 * 1000;
    for (const [id, j] of jobs)
      if (j.finishedAt && j.finishedAt < cutoff) jobs.delete(id);
    const done = [...jobs.values()]
      .filter((j) => j.finishedAt)
      .sort((a, b) => a.finishedAt - b.finishedAt);
    while (done.length > 4) jobs.delete(done.shift().id);
  }
  async function run(job, body, profile, attackIndex, quality) {
    const timer = setTimeout(() => job.controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl("https://openrouter.ai/api/v1/images", {
        method: "POST",
        signal: job.controller.signal,
        headers: {
          Authorization: "Bearer " + key,
          "Content-Type": "application/json",
          "X-Title": env.OPENROUTER_APP_NAME || "MyAppForAI",
          "HTTP-Referer": "http://127.0.0.1:5186",
        },
        body: JSON.stringify({
          model,
          prompt: job.prompt,
          size: "1024x1536",
          quality,
          background: "transparent",
          output_format: "png",
          n: 1,
          input_references: [
            { type: "image_url", image_url: { url: body.image } },
          ],
        }),
      });
      if (!response.ok) {
        const messages = {
          401: "OpenRouter ปฏิเสธคีย์",
          402: "เครดิต OpenRouter ไม่เพียงพอ",
          403: "คีย์ไม่มีสิทธิ์ใช้โมเดลสร้างภาพนี้",
          429: "OpenRouter จำกัดคำขอชั่วคราว",
        };
        throw Object.assign(
          Error(
            messages[response.status] ||
              `บริการสร้างภาพตอบกลับข้อผิดพลาด (${response.status})`,
          ),
          { safeMessage: true },
        );
      }
      const data = await response.json();
      const item = data.data?.[0];
      if (
        !item?.b64_json ||
        item.b64_json.length > 35 * 1024 * 1024 ||
        !["image/png", "image/webp"].includes(item.media_type || "image/png")
      )
        throw Error("บริการไม่ได้ส่งภาพ PNG/WebP ที่รองรับกลับมา");
      if (job.state === "cancelled") return;
      job.state = "succeeded";
      job.image = `data:${item.media_type || "image/png"};base64,${item.b64_json}`;
      job.usage = { cost: data.usage?.cost ?? null };
    } catch (e) {
      if (job.state !== "cancelled") {
        job.state = "failed";
        job.error = job.controller.signal.aborted
          ? "หมดเวลาสร้างภาพ ลองใหม่ด้วยตนเองได้"
          : e.safeMessage ||
              e.message?.startsWith("OpenRouter") ||
              e.message?.startsWith("บริการ")
            ? e.message
            : "เชื่อมต่อบริการสร้างภาพไม่สำเร็จ";
      }
    } finally {
      clearTimeout(timer);
      job.finishedAt = Date.now();
      if (active === job.id) active = null;
    }
  }
  return async (req, res, next) => {
    const path = (req.url || "").split("?")[0],
      match = path.match(/^\/api\/ai\/generation\/([a-f0-9-]{36})$/);
    if (path !== "/api/ai/generate" && !match) return next();
    if (!localRequest(req))
      return send(res, 403, { error: "ใช้ AI ผ่านเว็บบนเครื่องนี้เท่านั้น" });
    clean();
    if (match) {
      const job = jobs.get(match[1]);
      if (!job)
        return send(res, 404, {
          error: "ไม่พบงานสร้างภาพ งานหมดอายุหรือเซิร์ฟเวอร์เริ่มใหม่",
        });
      if (req.method === "DELETE") {
        if (job.state === "running") {
          job.state = "cancelled";
          job.controller.abort();
        }
        return send(res, 200, { id: job.id, state: job.state });
      }
      if (req.method !== "GET")
        return send(res, 405, { error: "Method not allowed" });
      const { controller, ...publicJob } = job;
      return send(res, 200, publicJob);
    }
    if (req.method !== "POST")
      return send(res, 405, { error: "Method not allowed" });
    if (!req.headers["content-type"]?.startsWith("application/json"))
      return send(res, 415, { error: "ต้องส่ง JSON" });
    if (!key)
      return send(res, 503, {
        error: "ยังไม่ได้ตั้งค่า OpenRouter บนเซิร์ฟเวอร์",
      });
    if (active)
      return send(res, 429, {
        error: "กำลังสร้างภาพอยู่ กรุณารอให้งานก่อนหน้าเสร็จ",
      });
    try {
      const body = await readJson(req);
      if (
        typeof body.image !== "string" ||
        !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(
          body.image,
        ) ||
        body.image.length > 2800000
      )
        throw Object.assign(Error("ภาพอ้างอิงไม่ถูกต้อง"), { status: 400 });
      let profile;
      try {
        profile = validateAnalysis(body.profile);
      } catch {
        throw Object.assign(
          Error("กรุณาวิเคราะห์และตรวจโปรไฟล์ก่อนสร้างเฟรม"),
          { status: 400 },
        );
      }
      const attackIndex = Number.isInteger(body.attackIndex)
        ? body.attackIndex
        : 0;
      if (attackIndex < 0 || attackIndex >= profile.attacks.length)
        throw Object.assign(Error("ท่าโจมตีไม่ถูกต้อง"), { status: 400 });
      const quality = body.quality === "high" ? "high" : "medium";
      if (active)
        throw Object.assign(
          Error("กำลังสร้างภาพอยู่ กรุณารอให้งานก่อนหน้าเสร็จ"),
          { status: 429 },
        );
      const job = {
        id: randomUUID(),
        state: "running",
        model,
        quality,
        startedAt: Date.now(),
        controller: new AbortController(),
        prompt: framePrompt(profile, attackIndex),
        profile,
        attackIndex,
        attackName: profile.attacks[attackIndex].name,
      };
      jobs.set(job.id, job);
      active = job.id;
      send(res, 202, { id: job.id, state: job.state, model, quality });
      void run(job, body, profile, attackIndex, quality);
    } catch (e) {
      send(res, e.status || 400, {
        error: e.status ? e.message : "คำขอสร้างเฟรมไม่ถูกต้อง",
      });
    }
  };
}
