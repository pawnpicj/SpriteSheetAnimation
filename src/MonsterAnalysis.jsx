import React, { useEffect, useMemo, useRef, useState } from "react";
import { Info, Sparkle, CheckCircle } from "@phosphor-icons/react";
import { BODY_PLANS, validateAnalysis } from "./analysis-schema.js";
import { makeFrames } from "./sprite-engine.js";
import "./monster-analysis.css";
const labels = {
  amorphous: "ตัวนิ่ม / Slime",
  serpentine: "ลำตัวยาว / งู",
  biped: "สองขา",
  quadruped: "สี่ขา",
  winged: "มีปีก",
  other: "อื่น ๆ",
};
export function MonsterAnalysis({
  asset,
  image,
  settings,
  onSave,
  onGenerate,
}) {
  const [connection, setConnection] = useState(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [notes, setNotes] = useState(""),
    [result, setResult] = useState(() => {
      try {
        return asset.analysis
          ? {
              analysis: validateAnalysis(asset.analysis.profile),
              model: asset.analysis.model,
              reasoning: asset.analysis.reasoning,
            }
          : null;
      } catch {
        return null;
      }
    });
  const controller = useRef(null);
  const prepared = useMemo(() => {
    if (!image) return null;
    const source =
      asset.mode === "sheet"
        ? makeFrames(image, asset, "Idle", { ...settings, count: 1 }, 0)[0]
        : image;
    const width = source.naturalWidth || source.width,
      height = source.naturalHeight || source.height;
    const scale = Math.min(1, 1024 / Math.max(width, height));
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(width * scale));
    c.height = Math.max(1, Math.round(height * scale));
    const g = c.getContext("2d", { willReadFrequently: true });
    g.drawImage(source, 0, 0, c.width, c.height);
    const pixels = g.getImageData(0, 0, c.width, c.height).data;
    let left = c.width,
      top = c.height,
      right = -1,
      bottom = -1,
      transparent = 0;
    for (let y = 0; y < c.height; y++)
      for (let x = 0; x < c.width; x++) {
        const a = pixels[(y * c.width + x) * 4 + 3];
        if (a < 255) transparent++;
        if (a > 20) {
          left = Math.min(left, x);
          right = Math.max(right, x);
          top = Math.min(top, y);
          bottom = Math.max(bottom, y);
        }
      }
    const preview = c.toDataURL("image/png");
    g.globalCompositeOperation = "destination-over";
    g.fillStyle = "#e0e2e3";
    g.fillRect(0, 0, c.width, c.height);
    return {
      image: c.toDataURL("image/png"),
      preview,
      width: image.naturalWidth,
      height: image.naturalHeight,
      alpha: transparent > 0,
      bounds:
        right < 0 ? "Empty" : `${right - left + 1} × ${bottom - top + 1} px`,
      analyzed: `${c.width} × ${c.height}`,
    };
  }, [image, asset.url]);
  useEffect(() => {
    const c = new AbortController();
    fetch("/api/ai/status", { signal: c.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setConnection)
      .catch((e) => {
        if (e.name !== "AbortError") setError("ติดต่อเซิร์ฟเวอร์ AI ไม่สำเร็จ");
      });
    return () => {
      c.abort();
      controller.current?.abort();
    };
  }, []);
  async function analyze() {
    if (!prepared || busy) return;
    setBusy(true);
    setError("");
    controller.current = new AbortController();
    try {
      const response = await fetch("/api/ai/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.current.signal,
        body: JSON.stringify({ image: prepared.image, notes }),
      });
      const data = await response.json();
      if (!response.ok) throw Error(data.error || "วิเคราะห์ไม่สำเร็จ");
      validateAnalysis(data.analysis);
      setResult(data);
    } catch (e) {
      if (e.name !== "AbortError")
        setError(e.message || "เชื่อมต่อ AI ไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }
  const edit = (key, value) =>
    setResult((r) => ({ ...r, analysis: { ...r.analysis, [key]: value } }));
  const editAttack = (i, key, value) =>
    setResult((r) => ({
      ...r,
      analysis: {
        ...r.analysis,
        attacks: r.analysis.attacks.map((a, n) =>
          n === i ? { ...a, [key]: value } : a,
        ),
      },
    }));
  const profile = result?.analysis;
  return (
    <div className="monster-analysis">
      <div className="analysis-source">
        <div className="checker">
          <img src={prepared?.preview} alt="Character submitted for analysis" />
        </div>
        <div>
          <strong>{asset.name}</strong>
          <p>
            {prepared?.width} × {prepared?.height} px ·{" "}
            {prepared?.alpha ? "มีความโปร่งใส" : "พื้นหลังทึบ"}
          </p>
          <p>
            ขอบเขตตัวละคร: {prepared?.bounds}
            {asset.mode === "sheet" ? " · วิเคราะห์เฟรม Idle แรก" : ""}
          </p>
        </div>
      </div>
      <div className="analysis-provider">
        <CheckCircle size={16} />
        <span>
          {connection?.configured
            ? `${connection.appName} · ${connection.model} · ${connection.reasoning}`
            : connection
              ? "ยังไม่ได้ตั้งค่าคีย์บนเซิร์ฟเวอร์"
              : "กำลังตรวจการเชื่อมต่อ…"}
        </span>
      </div>
      <label className="analysis-label">
        รายละเอียดเพิ่มเติม (ไม่บังคับ)
        <textarea
          aria-label="Monster analysis notes"
          maxLength={1500}
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="เช่น Slime สายไฟ หรือ Orc ถือกระบอง โจมตีช้าแต่หนัก"
        />
      </label>
      <p className="analysis-disclosure">
        <Info size={15} />
        กดวิเคราะห์เพื่อส่งภาพนี้ไป OpenRouter มีค่าใช้จ่ายตามบัญชีของคุณ
        ผลลัพธ์เป็นข้อเสนอ ยังไม่สร้างเฟรมใหม่
      </p>
      <button
        className="primary dialog-wide"
        disabled={!connection?.configured || !prepared || busy}
        onClick={analyze}
      >
        <Sparkle size={18} />
        {busy
          ? "กำลังวิเคราะห์ภาพ…"
          : result
            ? "Analyze again"
            : "Analyze image"}
      </button>
      {busy && (
        <p className="analysis-pending" role="status">
          กำลังตรวจรูปร่าง อาวุธ และออกแบบท่าทาง… ปิดหน้าต่างเพื่อยกเลิกได้
        </p>
      )}
      {error && (
        <p className="analysis-error" role="alert">
          {error}
        </p>
      )}
      {profile && (
        <div className="analysis-results">
          <div className="analysis-result-heading">
            <h3>โปรไฟล์ที่ AI เสนอ</h3>
            <span>
              ความมั่นใจ:{" "}
              {
                { low: "ต่ำ", medium: "ปานกลาง", high: "สูง" }[
                  profile.confidence
                ]
              }
            </span>
          </div>
          <label className="analysis-label">
            ชื่อมอนสเตอร์
            <input
              aria-label="Monster profile name"
              value={profile.name}
              maxLength={100}
              onChange={(e) => edit("name", e.target.value)}
            />
          </label>
          <label className="analysis-label">
            โครงสร้างร่างกาย
            <select
              aria-label="Monster body plan"
              value={profile.bodyPlan}
              onChange={(e) => edit("bodyPlan", e.target.value)}
            >
              {BODY_PLANS.map((p) => (
                <option key={p} value={p}>
                  {labels[p]}
                </option>
              ))}
            </select>
          </label>
          <p className="analysis-description">{profile.description}</p>
          <div className="anatomy-facts">
            <span>
              ขาที่มองเห็น:{" "}
              {profile.anatomy.visibleLegs < 0
                ? "ไม่แน่ใจ"
                : profile.anatomy.visibleLegs}
            </span>
            <span>
              แขนที่มองเห็น:{" "}
              {profile.anatomy.visibleArms < 0
                ? "ไม่แน่ใจ"
                : profile.anatomy.visibleArms}
            </span>
            <span>ทิศ: {profile.anatomy.facing}</span>
            <span>อาวุธ: {profile.anatomy.weapons.join(", ") || "ไม่พบ"}</span>
          </div>
          <h4>สิ่งที่เห็นในภาพ</h4>
          <ul>
            {profile.anatomy.observations.map((v, i) => (
              <li key={i}>{v}</li>
            ))}
          </ul>
          <p className="analysis-description">
            ส่วนที่ขยับ: {profile.anatomy.movingParts.join(", ")}
          </p>
          <button
            className="generation-launch"
            disabled={busy}
            onClick={() =>
              onGenerate({
                profile,
                model: result.model,
                reasoning: result.reasoning,
                savedAt: new Date().toISOString(),
              })
            }
          >
            <Sparkle size={18} />
            Generate animation frames
          </button>
          <h4>ท่าเดิน</h4>
          <label className="analysis-label">
            ชื่อท่าเดิน
            <input
              aria-label="Suggested walk name"
              value={profile.walk.name}
              onChange={(e) =>
                edit("walk", { ...profile.walk, name: e.target.value })
              }
            />
          </label>
          <label className="analysis-label">
            คำอธิบาย
            <textarea
              aria-label="Suggested walk description"
              rows={3}
              value={profile.walk.description}
              onChange={(e) =>
                edit("walk", { ...profile.walk, description: e.target.value })
              }
            />
          </label>
          <details>
            <summary>ลำดับท่าเดิน 8 เฟรม</summary>
            <ol>
              {profile.walk.keyPoses.map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </ol>
          </details>
          <h4>ท่าโจมตีที่เหมาะกับตัวนี้</h4>
          {profile.attacks.map((a, i) => (
            <section className="analysis-attack" key={i}>
              <label className="analysis-label">
                ท่า {i + 1}
                <input
                  aria-label={`Suggested attack ${i + 1} name`}
                  value={a.name}
                  maxLength={100}
                  onChange={(e) => editAttack(i, "name", e.target.value)}
                />
              </label>
              <label className="analysis-label">
                การโจมตี
                <textarea
                  aria-label={`Suggested attack ${i + 1} description`}
                  rows={2}
                  value={a.description}
                  onChange={(e) => editAttack(i, "description", e.target.value)}
                />
              </label>
              <p>
                <b>เตรียม:</b> {a.anticipation}
              </p>
              <p>
                <b>กระทบ:</b> {a.impact}
              </p>
              <p>
                <b>คืนท่า:</b> {a.recovery}
              </p>
              <label className="setting-row">
                <span>เฟรมกระทบ (1–8)</span>
                <input
                  aria-label={`Suggested attack ${i + 1} hit frame`}
                  type="number"
                  min={1}
                  max={8}
                  value={a.hitFrame}
                  onChange={(e) =>
                    editAttack(
                      i,
                      "hitFrame",
                      Math.max(1, Math.min(8, Number(e.target.value) || 1)),
                    )
                  }
                />
              </label>
            </section>
          ))}
          <h4>ส่วนที่ยังไม่แน่ใจ</h4>
          <ul className="analysis-uncertain">
            {profile.uncertainties.map((v, i) => (
              <li key={i}>{v}</li>
            ))}
          </ul>
          <details>
            <summary>คำสั่งสำหรับสร้างแอนิเมชันต่อ</summary>
            <textarea
              aria-label="Animation generation prompt"
              rows={6}
              value={profile.generationPrompt}
              onChange={(e) => edit("generationPrompt", e.target.value)}
            />
          </details>
          <button
            className="primary dialog-wide"
            disabled={busy}
            onClick={() =>
              onSave({
                profile,
                model: result.model,
                reasoning: result.reasoning,
                savedAt: new Date().toISOString(),
              })
            }
          >
            Save motion profile
          </button>
          <p className="analysis-description">
            บันทึกข้อเสนอเข้ากับตัวละครและไฟล์โปรเจกต์
            โดยไม่เปลี่ยนแถวภาพหรืออ้างว่ามีเฟรมใหม่แล้ว
          </p>
        </div>
      )}
    </div>
  );
}
