import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Sparkle,
  Info,
  DownloadSimple,
  CheckCircle,
} from "@phosphor-icons/react";
import { makeFrames, download } from "./sprite-engine.js";
import { normalizeGeneratedSheet, generatedAsset } from "./generated-frames.js";
import "./frame-generation.css";

function AnimatedClip({ frames, name }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!frames?.length) return;
    let index = 0;
    const c = ref.current;
    c.width = c.height = frames[0].width;
    const draw = () => {
      const g = c.getContext("2d");
      g.clearRect(0, 0, c.width, c.height);
      g.drawImage(frames[index], 0, 0);
      index = (index + 1) % frames.length;
    };
    draw();
    const timer = setInterval(draw, 125);
    return () => clearInterval(timer);
  }, [frames]);
  return (
    <div className="generated-clip">
      <div className="checker">
        <canvas ref={ref} aria-label={name + " generated preview"} />
      </div>
      <strong>{name}</strong>
      <span>8 pose frames</span>
    </div>
  );
}
function fingerprint(value) {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++)
    h = Math.imul(h ^ value.charCodeAt(i), 16777619);
  return String(h);
}
export function FrameGeneration({ asset, image, settings, onUse }) {
  const profile = asset.analysis?.profile;
  const [config, setConfig] = useState(null),
    [attackIndex, setAttackIndex] = useState(0),
    [quality, setQuality] = useState("medium"),
    [job, setJob] = useState(null),
    [candidate, setCandidate] = useState(null),
    [error, setError] = useState(""),
    [processing, setProcessing] = useState(false),
    [starting, setStarting] = useState(false);
  const normalized = useRef(null);
  const reference = useMemo(() => {
    if (asset.generation?.reference) return asset.generation.reference;
    if (!image) return null;
    const src =
      asset.mode === "sheet"
        ? makeFrames(image, asset, "Idle", { ...settings, count: 1 }, 0)[0]
        : image;
    const width = src.naturalWidth || src.width,
      height = src.naturalHeight || src.height,
      s = Math.min(1, 1024 / Math.max(width, height));
    const c = document.createElement("canvas");
    c.width = Math.round(width * s);
    c.height = Math.round(height * s);
    c.getContext("2d").drawImage(src, 0, 0, c.width, c.height);
    return c.toDataURL("image/png");
  }, [image, asset.url]);
  const sourceKey = reference ? fingerprint(reference) : null;
  useEffect(() => {
    const c = new AbortController();
    fetch("/api/ai/status", { signal: c.signal })
      .then((r) => r.json())
      .then(setConfig)
      .catch((e) => {
        if (e.name !== "AbortError") setError("ตรวจการเชื่อมต่อไม่ได้");
      });
    try {
      const active = JSON.parse(
        sessionStorage.getItem("sprite-generation") || "null",
      );
      if (active?.sourceKey === sourceKey) {
        setAttackIndex(active.attackIndex);
        setQuality(active.quality);
        setJob({ id: active.id, state: "running" });
      }
    } catch {}
    return () => c.abort();
  }, [sourceKey]);
  useEffect(() => {
    if (!job?.id || job.state !== "running") return;
    let cancelled = false,
      timer;
    const controller = new AbortController();
    async function poll() {
      try {
        const r = await fetch("/api/ai/generation/" + job.id, {
          signal: controller.signal,
        });
        const data = await r.json();
        if (!r.ok) throw Error(data.error);
        if (cancelled) return;
        if (data.state === "running") timer = setTimeout(poll, 1500);
        else setJob(data);
      } catch (e) {
        if (!cancelled && e.name !== "AbortError") {
          setError(e.message || "ติดตามงานไม่สำเร็จ");
          setJob((j) => ({ ...j, state: "failed" }));
        }
      }
    }
    poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
      controller.abort();
    };
  }, [job?.id, job?.state]);
  useEffect(() => {
    if (job?.state !== "succeeded" || normalized.current === job.id) return;
    normalized.current = job.id;
    setProcessing(true);
    let active = true;
    normalizeGeneratedSheet(job.image)
      .then((result) => {
        if (active) setCandidate(result);
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setProcessing(false);
      });
    return () => {
      active = false;
    };
  }, [job]);
  async function start() {
    if (!profile || !reference || starting) return;
    setStarting(true);
    setError("");
    setCandidate(null);
    normalized.current = null;
    try {
      const r = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: reference,
          profile,
          attackIndex,
          quality,
        }),
      });
      const data = await r.json();
      if (!r.ok) throw Error(data.error);
      try {
        sessionStorage.setItem(
          "sprite-generation",
          JSON.stringify({ id: data.id, sourceKey, attackIndex, quality }),
        );
      } catch {}
      setJob(data);
    } catch (e) {
      setError(e.message || "เริ่มสร้างไม่สำเร็จ");
    } finally {
      setStarting(false);
    }
  }
  async function cancel() {
    try {
      const r = await fetch("/api/ai/generation/" + job.id, {
        method: "DELETE",
      });
      if (r.ok) {
        setJob(await r.json());
        sessionStorage.removeItem("sprite-generation");
      }
    } catch {
      setError("ยกเลิกงานไม่สำเร็จ");
    }
  }
  const running = starting || job?.state === "running" || processing;
  const displayProfile = job?.profile || profile;
  return (
    <div className="frame-generation">
      <div className="generation-reference">
        <div className="checker">
          <img src={reference} alt="Animation reference" />
        </div>
        <div>
          <h3>{displayProfile?.name || asset.name}</h3>
          <p>{config?.imageModel || "กำลังตรวจโมเดล…"}</p>
          <p>Idle + Walk + Attack · 24 เฟรม</p>
        </div>
      </div>
      <label className="analysis-label">
        ท่าโจมตีที่จะสร้าง
        <select
          aria-label="Generation attack"
          disabled={running || !!candidate}
          value={attackIndex}
          onChange={(e) => setAttackIndex(Number(e.target.value))}
        >
          {displayProfile?.attacks.map((a, i) => (
            <option key={i} value={i}>
              {a.name}
            </option>
          ))}
        </select>
      </label>
      <label className="analysis-label">
        คุณภาพ
        <select
          aria-label="Generation quality"
          value={quality}
          disabled={running || !!candidate}
          onChange={(e) => setQuality(e.target.value)}
        >
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
      </label>
      <p className="analysis-disclosure">
        <Info size={16} />
        ส่งภาพอ้างอิงและโปรไฟล์ไป OpenRouter สร้างภาพจริง 1 ภาพต่อครั้ง
        มีค่าใช้จ่าย ไม่สร้างซ้ำอัตโนมัติ ผลจาก AI อาจต้องปรับแก้
      </p>
      <div className="generation-steps">
        <span className={job ? "done" : ""}>1. สร้างภาพ 4 × 6</span>
        <span className={processing || candidate ? "done" : ""}>
          2. ตัด 24 เฟรม
        </span>
        <span className={candidate ? "done" : ""}>3. จัดแนวและตรวจ</span>
      </div>
      {!running && !candidate && (
        <button
          className="primary dialog-wide"
          disabled={!config?.configured || !profile || !reference}
          onClick={start}
        >
          <Sparkle size={19} />
          {job ? "Generate new frames" : "Generate frames"}
        </button>
      )}
      {job?.state === "running" && (
        <div className="generation-progress" role="status">
          <strong>กำลังสร้างภาพแอนิเมชัน…</strong>
          <p>
            อาจใช้เวลาหลายนาที ปิดหน้าต่างนี้แล้วงานยังทำต่อ เปิด Generate
            Frames กลับมาเพื่อติดตามได้ภายใน 30 นาที ตราบที่เซิร์ฟเวอร์ยังทำงาน
          </p>
          <button onClick={cancel}>Cancel generation</button>
        </div>
      )}
      {processing && (
        <p className="analysis-pending" role="status">
          กำลังแบ่งเฟรม ตรวจ alpha และจัดแนวตัวละคร…
        </p>
      )}
      {(error || job?.error) && (
        <p className="analysis-error" role="alert">
          {error || job.error}
        </p>
      )}
      {job?.state === "failed" && !job.error && (
        <button
          className="dialog-wide"
          onClick={() => {
            setError("");
            setJob((j) => ({ ...j, state: "running" }));
          }}
        >
          Retry job status · ไม่สร้างภาพซ้ำ
        </button>
      )}
      {job?.state === "cancelled" && (
        <p className="analysis-description">ยกเลิกงานแล้ว</p>
      )}
      {candidate && (
        <>
          <div className="generation-success">
            <CheckCircle size={17} />
            ได้ภาพใหม่ 24 เฟรม · พื้นหลังโปร่งใส
          </div>
          {Number.isFinite(job.usage?.cost) && (
            <p className="analysis-description">
              ค่าใช้จ่ายที่ API รายงาน: ${job.usage.cost.toFixed(4)} USD
            </p>
          )}
          <div className="generated-previews">
            {["Idle", "Walk", "Attack"].map((name, i) => (
              <AnimatedClip
                key={name}
                name={name}
                frames={candidate.frames[i]}
              />
            ))}
          </div>
          <p className="analysis-description">
            ตรวจจำนวนเฟรมและจัดแนวแล้ว
            โปรดดูความต่อเนื่องและเอกลักษณ์ตัวละครก่อนใช้งานจริง
          </p>
          {candidate.warnings.length > 0 && (
            <ul className="analysis-uncertain">
              {candidate.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          )}
          <button
            className="primary dialog-wide"
            onClick={() => {
              sessionStorage.removeItem("sprite-generation");
              onUse(
                generatedAsset(
                  candidate,
                  job,
                  job.profile || profile,
                  job.attackIndex ?? attackIndex,
                  reference,
                  asset.generation?.sourceName || asset.name,
                  asset.analysis,
                ),
              );
            }}
          >
            Use frames in editor
          </button>
          <button
            className="dialog-wide"
            onClick={() => {
              setCandidate(null);
              setError("");
              setJob(null);
            }}
          >
            Create another version
          </button>
        </>
      )}
      {job?.image && (
        <button
          className="dialog-wide"
          onClick={async () => {
            const blob = await (await fetch(job.image)).blob();
            download(blob, "generated-source-4x6.png");
          }}
        >
          <DownloadSimple size={17} />
          Download original generated sheet
        </button>
      )}
    </div>
  );
}
