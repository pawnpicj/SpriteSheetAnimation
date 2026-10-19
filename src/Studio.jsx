import React, { useCallback, useEffect, useRef, useState } from "react";
import { TestArena } from "./TestArena.jsx";
import { MonsterAnalysis } from "./MonsterAnalysis.jsx";
import { FrameGeneration } from "./FrameGeneration.jsx";
import {
  House,
  PersonSimpleRun,
  Export,
  GearSix,
  UploadSimple,
  Play,
  Pause,
  CaretLeft,
  CaretRight,
  ArrowCounterClockwise,
  PlusSquare,
  Trash,
  FolderOpen,
  FloppyDisk,
  FileImage,
  BracketsCurly,
  X,
  CheckCircle,
  Info,
  ArrowsOut,
  Keyboard,
  ImageSquare,
  Stack,
  ArrowSquareOut,
} from "@phosphor-icons/react";
import {
  ACTIONS,
  makeFrames,
  makeAtlas,
  download,
  loadImage,
  safeName,
  clipRow,
  availableActions,
  clipDuration,
} from "./sprite-engine.js";
import "@fontsource-variable/inter";
import "./studio.css";
import "./motion-controls.css";
const ORIGINAL = {
  name: "Pig.png",
  url: "/assets/Pig.png",
  mode: "character",
  columns: 1,
  rows: 1,
};
const BOAR = {
  name: "Forest Boar · articulated frames",
  url: "/assets/boar-articulated-v2.png",
  mode: "sheet",
  columns: 8,
  rows: 4,
  rowMap: { Idle: 0, Walk: 1, Attack: 2 },
  pivot: { x: 0.5, y: 238 / 256 },
  attacks: [
    {
      id: "charge",
      name: "พุ่งชน · Charge",
      row: 2,
      hitFrame: 4,
      fps: 10,
      durations: [140, 120, 90, 60, 110, 90, 110, 160],
    },
    {
      id: "tusk",
      name: "งัดเขี้ยว · Tusk strike",
      row: 3,
      hitFrame: 4,
      fps: 10,
      durations: [140, 100, 90, 70, 110, 110, 100, 180],
    },
  ],
};
const DEFAULTS = {
  count: 8,
  size: 192,
  fps: 12,
  loop: true,
  onion: false,
  flip: false,
  pixelated: false,
  zoom: 2,
  attackId: "charge",
  attackName: "Monster attack",
  hitFrame: 4,
};
function FrameCanvas({ frame, ...props }) {
  const ref = useRef(null);
  useEffect(() => {
    if (frame && ref.current) {
      const c = ref.current;
      c.width = frame.width;
      c.height = frame.height;
      c.getContext("2d").drawImage(frame, 0, 0);
    }
  }, [frame]);
  return <canvas ref={ref} {...props} />;
}
export function App() {
  const [asset, setAsset] = useState(BOAR),
    [image, setImage] = useState(null),
    [action, setAction] = useState("Idle"),
    [settings, setSettings] = useState(DEFAULTS),
    [frames, setFrames] = useState([]),
    [frame, setFrame] = useState(0),
    [playing, setPlaying] = useState(true),
    [testMode, setTestMode] = useState(false),
    [project, setProject] = useState("Forest Boar"),
    [modal, setModal] = useState(null),
    [toast, setToast] = useState(""),
    [busy, setBusy] = useState(false),
    [drag, setDrag] = useState(false),
    [importMode, setImportMode] = useState("character"),
    [columns, setColumns] = useState(8),
    [rows, setRows] = useState(5),
    [sourceRow, setSourceRow] = useState(0),
    [background, setBackground] = useState("checker"),
    [view, setView] = useState("Assets");
  const fileRef = useRef(null),
    projectRef = useRef(null),
    previewRef = useRef(null),
    restoreRef = useRef(null),
    requestRef = useRef(0);
  const update = (key, value) => setSettings((s) => ({ ...s, [key]: value }));
  const exitTest = useCallback(() => setTestMode(false), []);
  const current = Math.min(frame, Math.max(0, frames.length - 1));
  const sourceReference =
    asset.generation?.reference ||
    (asset.mode === "character" ? asset.url : ORIGINAL.url);
  const sourceName =
    asset.generation?.sourceName ||
    (asset.mode === "character" ? asset.name : "Pig.png");
  const activeAttack =
    asset.attacks?.find((x) => x.id === settings.attackId) ||
    asset.attacks?.[0];
  const totalDuration =
    frames.reduce(
      (sum, _, i) =>
        sum +
        clipDuration(
          asset,
          action,
          i,
          frames.length,
          settings.fps,
          settings.attackId,
        ),
      0,
    ) / 1000;
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 5000);
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(() => {
    let cancelled = false;
    setBusy(true);
    setImage(null);
    loadImage(asset.url)
      .then((img) => {
        if (!cancelled) {
          setImage(img);
          setBusy(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setBusy(false);
          setToast("เปิดภาพไม่ได้ กรุณาเลือกไฟล์ใหม่");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [asset.url]);
  useEffect(() => {
    if (!image || image.src !== new URL(asset.url, window.location.href).href)
      return;
    if (restoreRef.current) {
      setFrames(restoreRef.current);
      restoreRef.current = null;
    } else setFrames(makeFrames(image, asset, action, settings, sourceRow));
    setFrame(0);
  }, [
    image,
    asset.url,
    asset.mode,
    asset.columns,
    asset.rows,
    asset.rowMap,
    asset.attacks,
    action,
    settings.count,
    settings.size,
    settings.flip,
    settings.pixelated,
    settings.attackId,
    sourceRow,
  ]);
  useEffect(() => {
    if (!playing || frames.length < 2) return;
    const id = setTimeout(
      () =>
        setFrame((i) => {
          if (i + 1 >= frames.length) {
            if (settings.loop) return 0;
            setPlaying(false);
            return frames.length - 1;
          }
          return i + 1;
        }),
      clipDuration(
        asset,
        action,
        current,
        frames.length,
        settings.fps,
        settings.attackId,
      ),
    );
    return () => clearTimeout(id);
  }, [
    playing,
    current,
    frames.length,
    settings.fps,
    settings.loop,
    asset,
    action,
    settings.attackId,
  ]);
  useEffect(() => {
    const c = previewRef.current;
    if (!c || !frames.length) return;
    c.width = c.height = settings.size;
    const g = c.getContext("2d");
    g.clearRect(0, 0, c.width, c.height);
    if (settings.onion && current > 0) {
      g.globalAlpha = 0.22;
      g.drawImage(frames[current - 1], 0, 0);
      g.globalAlpha = 1;
    }
    g.drawImage(frames[current], 0, 0);
  }, [frames, current, settings.size, settings.onion, testMode]);
  const step = (d) => {
    setPlaying(false);
    setFrame((i) => (i + d + frames.length) % Math.max(1, frames.length));
  };
  const togglePlay = () => {
    if (!playing && current === frames.length - 1) setFrame(0);
    setPlaying((v) => !v);
  };
  const chooseAction = (a) => {
    if (!availableActions(asset).includes(a)) return;
    setAction(a);
    setFrame(0);
    setPlaying(true);
    const attack =
      asset.attacks?.find((x) => x.id === settings.attackId) ||
      asset.attacks?.[0];
    setSettings((s) => ({
      ...s,
      loop: a !== "Attack" && a !== "Jump",
      fps: a === "Walk" ? 8 : a === "Attack" ? attack?.fps || 10 : 8,
    }));
  };
  const setMappedRow = (row) => {
    setAsset((a) =>
      action === "Attack" && a.attacks?.length
        ? {
            ...a,
            attacks: a.attacks.map((x) =>
              x.id === activeAttack.id ? { ...x, row } : x,
            ),
          }
        : {
            ...a,
            rowMap: {
              ...(a.rowMap || {
                Idle: 0,
                Walk: Math.min(1, a.rows - 1),
                Attack: Math.min(2, a.rows - 1),
                Run: Math.min(3, a.rows - 1),
                Jump: Math.min(4, a.rows - 1),
              }),
              [action]: row,
            },
          },
    );
    setSourceRow(row);
  };
  useEffect(() => {
    const key = (e) => {
      if (
        testMode ||
        modal ||
        /INPUT|SELECT|TEXTAREA|BUTTON/.test(e.target.tagName) ||
        e.ctrlKey ||
        e.metaKey ||
        e.altKey
      )
        return;
      if (e.code === "Space") {
        e.preventDefault();
        togglePlay();
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        step(1);
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        step(-1);
      }
      if (["1", "2", "3"].includes(e.key))
        chooseAction(ACTIONS[Number(e.key) - 1]);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });
  useEffect(() => {
    if (!modal) return;
    const previous = document.activeElement,
      timer = setTimeout(
        () => document.querySelector(".dialog button")?.focus(),
        0,
      );
    const key = (e) => {
      if (e.key === "Escape") setModal(null);
      if (e.key === "Tab") {
        const els = [
          ...document.querySelectorAll(
            ".dialog button:not(:disabled),.dialog input,.dialog select",
          ),
        ];
        if (e.shiftKey && document.activeElement === els[0]) {
          e.preventDefault();
          els.at(-1)?.focus();
        }
        if (!e.shiftKey && document.activeElement === els.at(-1)) {
          e.preventDefault();
          els[0]?.focus();
        }
      }
    };
    window.addEventListener("keydown", key);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("keydown", key);
      previous?.focus();
    };
  }, [modal]);
  async function importFile(file) {
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setToast("รองรับไฟล์ PNG, JPG และ WebP");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setToast("กรุณาเลือกภาพขนาดไม่เกิน 20 MB");
      return;
    }
    const request = ++requestRef.current;
    setBusy(true);
    try {
      const url = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result);
        r.onerror = reject;
        r.readAsDataURL(file);
      });
      const img = await loadImage(url);
      if (request !== requestRef.current) return;
      if (img.naturalWidth > 8192 || img.naturalHeight > 8192)
        throw Error("ภาพต้องไม่เกิน 8192 × 8192 px");
      if (
        importMode === "sheet" &&
        (img.naturalWidth % columns || img.naturalHeight % rows)
      )
        throw Error("ขนาดภาพต้องหารจำนวนคอลัมน์และแถวลงตัว");
      setAsset({
        name: file.name,
        url,
        mode: importMode,
        columns: importMode === "sheet" ? columns : 1,
        rows: importMode === "sheet" ? rows : 1,
        ...(importMode === "sheet"
          ? {
              rowMap: {
                Idle: 0,
                Walk: Math.min(1, rows - 1),
                Attack: Math.min(2, rows - 1),
                Run: Math.min(3, rows - 1),
                Jump: Math.min(4, rows - 1),
              },
            }
          : {}),
      });
      setSourceRow(0);
      setAction("Idle");
      setSettings((s) => ({
        ...s,
        attackName: "Monster attack",
        attackId: "charge",
        hitFrame: 4,
        loop: true,
        fps: 8,
      }));
      setProject(file.name.replace(/\.[^.]+$/, ""));
      setModal(null);
      setPlaying(true);
      setToast(
        importMode === "sheet"
          ? "นำเข้า Sprite Sheet แล้ว เลือกแถวใน Animation Settings ได้เลย"
          : "นำเข้าภาพแล้ว · ใช้การจำลองการขยับจากภาพเดี่ยว",
      );
    } catch (e) {
      setToast(e.message || "เปิดไฟล์ไม่สำเร็จ");
    } finally {
      if (request === requestRef.current) setBusy(false);
    }
  }
  async function exportFile(type) {
    if (!frames.length) return;
    const attack =
      asset.attacks?.find((x) => x.id === settings.attackId) ||
      asset.attacks?.[0];
    const attackName = attack?.name || settings.attackName;
    const name =
      safeName(project) +
      "_" +
      (action === "Attack" ? safeName(attackName) : action.toLowerCase());
    try {
      if (type === "json")
        download(
          new Blob(
            [
              JSON.stringify(
                makeAtlas(
                  name,
                  frames.length,
                  settings.size,
                  settings.fps,
                  settings.loop,
                  action,
                  action === "Attack"
                    ? {
                        name: attackName,
                        hitFrame: Math.min(
                          frames.length - 1,
                          attack?.hitFrame ?? settings.hitFrame,
                        ),
                        sourceRow: clipRow(
                          asset,
                          action,
                          settings.attackId,
                          sourceRow,
                        ),
                        durations: frames.map((_, i) =>
                          clipDuration(
                            asset,
                            action,
                            i,
                            frames.length,
                            settings.fps,
                            settings.attackId,
                          ),
                        ),
                      }
                    : undefined,
                  { pivot: asset.pivot },
                ),
                null,
                2,
              ),
            ],
            { type: "application/json" },
          ),
          name + ".json",
        );
      else {
        let canvas = frames[current];
        if (type === "png") {
          canvas = document.createElement("canvas");
          canvas.width = settings.size * frames.length;
          canvas.height = settings.size;
          const g = canvas.getContext("2d");
          frames.forEach((f, i) => g.drawImage(f, i * settings.size, 0));
        }
        const blob = await new Promise((resolve) =>
          canvas.toBlob(resolve, "image/png"),
        );
        if (!blob) throw Error("สร้าง PNG ไม่สำเร็จ");
        download(
          blob,
          name +
            (type === "frame"
              ? "_" + String(current + 1).padStart(2, "0")
              : "") +
            ".png",
        );
      }
      setToast("ส่งไฟล์ไปยัง Downloads แล้ว");
    } catch (e) {
      setToast(e.message || "ส่งออกไม่สำเร็จ");
    }
  }
  function saveProject() {
    if (!image || !frames.length) return;
    const c = document.createElement("canvas");
    c.width = image.naturalWidth;
    c.height = image.naturalHeight;
    c.getContext("2d").drawImage(image, 0, 0);
    const data = {
      format: "sprite-sheet-animation",
      version: 1,
      project,
      asset: { ...asset, url: c.toDataURL("image/png") },
      action,
      settings,
      sourceRow,
      frames: frames.map((f) => f.toDataURL("image/png")),
    };
    download(
      new Blob([JSON.stringify(data)], { type: "application/json" }),
      safeName(project) + ".sprite.json",
    );
    setToast("บันทึกโปรเจกต์แล้ว · ใช้ Open project เพื่อเปิดต่อ");
  }
  async function openProject(file) {
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) {
      setToast("ไฟล์โปรเจกต์ต้องไม่เกิน 50 MB");
      return;
    }
    setBusy(true);
    try {
      const d = JSON.parse(await file.text()),
        isData = (s) =>
          typeof s === "string" && s.startsWith("data:image/png;base64,");
      if (
        d.format !== "sprite-sheet-animation" ||
        d.version !== 1 ||
        !["character", "sheet"].includes(d.asset?.mode) ||
        !ACTIONS.includes(d.action) ||
        !Array.isArray(d.frames) ||
        d.frames.length < 1 ||
        d.frames.length > 32 ||
        !isData(d.asset.url) ||
        !d.frames.every(isData)
      )
        throw Error("ไฟล์โปรเจกต์ไม่ถูกต้อง");
      if (
        ![128, 192, 256, 512].includes(d.settings?.size) ||
        !Number.isInteger(d.settings?.fps) ||
        d.settings.fps < 1 ||
        d.settings.fps > 30 ||
        !Number.isInteger(d.asset.columns) ||
        d.asset.columns < 1 ||
        d.asset.columns > 32 ||
        !Number.isInteger(d.asset.rows) ||
        d.asset.rows < 1 ||
        d.asset.rows > 32
      )
        throw Error("ค่าตั้งค่าในโปรเจกต์ไม่ถูกต้อง");
      if (
        d.asset.rowMap &&
        (typeof d.asset.rowMap !== "object" ||
          Object.values(d.asset.rowMap).some(
            (row) => !Number.isInteger(row) || row < 0 || row >= d.asset.rows,
          ))
      )
        throw Error("แถวแอนิเมชันในโปรเจกต์ไม่ถูกต้อง");
      if (
        d.asset.attacks &&
        (!Array.isArray(d.asset.attacks) ||
          d.asset.attacks.length > 16 ||
          d.asset.attacks.some(
            (a) =>
              typeof a.id !== "string" ||
              typeof a.name !== "string" ||
              !Number.isInteger(a.row) ||
              a.row < 0 ||
              a.row >= d.asset.rows ||
              !Number.isInteger(a.hitFrame) ||
              a.hitFrame < 0 ||
              a.hitFrame > 31 ||
              !Number.isFinite(a.fps) ||
              a.fps < 1 ||
              a.fps > 30 ||
              (a.durations &&
                (!Array.isArray(a.durations) ||
                  a.durations.length > 32 ||
                  a.durations.some(
                    (n) => !Number.isFinite(n) || n < 16 || n > 2000,
                  ))),
          ))
      )
        throw Error("ข้อมูลท่าโจมตีไม่ถูกต้อง");
      const loaded = await Promise.all(d.frames.map(loadImage));
      if (
        loaded.some(
          (i) =>
            i.naturalWidth !== d.settings.size ||
            i.naturalHeight !== d.settings.size,
        )
      )
        throw Error("ขนาดเฟรมไม่ถูกต้อง");
      restoreRef.current = loaded.map((i) => {
        const c = document.createElement("canvas");
        c.width = c.height = d.settings.size;
        c.getContext("2d").drawImage(i, 0, 0);
        return c;
      });
      setProject(String(d.project || "Untitled").slice(0, 60));
      setSettings({
        ...DEFAULTS,
        ...d.settings,
        count: Math.max(
          1,
          Math.min(32, Number(d.settings.count) || loaded.length),
        ),
        zoom: Math.max(0.5, Math.min(3, Number(d.settings.zoom) || 1.5)),
      });
      setAction(d.action);
      setSourceRow(
        Math.max(0, Math.min(d.asset.rows - 1, Number(d.sourceRow) || 0)),
      );
      setAsset({
        ...d.asset,
        name: String(d.asset.name || "Character").slice(0, 100),
        sample: !!d.asset.sample,
      });
      setPlaying(false);
      setModal(null);
      setToast("เปิดโปรเจกต์แล้ว");
    } catch (e) {
      setToast(e.message || "เปิดโปรเจกต์ไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }
  const duplicate = () => {
    if (frames.length >= 32) return;
    setPlaying(false);
    setFrames((f) => [
      ...f.slice(0, current + 1),
      f[current],
      ...f.slice(current + 1),
    ]);
    setFrame(current + 1);
  };
  const remove = () => {
    if (frames.length <= 1) return;
    setPlaying(false);
    setFrames((f) => f.filter((_, i) => i !== current));
    setFrame(Math.max(0, current - 1));
  };
  const drop = (e) => {
    e.preventDefault();
    setDrag(false);
    importFile(e.dataTransfer.files[0]);
  };
  const nav = [
    ["Assets", House],
    ["Animate", PersonSimpleRun],
    ["Export", Export],
    ["Settings", GearSix],
  ];
  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand">
          <img src="/assets/Pig.png" alt="" />
          <div>
            <h1>Sprite Sheet Animation</h1>
            <p>Your character. Every frame.</p>
          </div>
        </div>
        <div className="project-field">
          <span>PROJECT</span>
          <input
            aria-label="Project name"
            maxLength={60}
            value={project}
            onChange={(e) => setProject(e.target.value)}
          />
          <button
            className="icon-btn"
            title="Open project"
            aria-label="Open project"
            onClick={() => projectRef.current.click()}
          >
            <FolderOpen size={19} />
          </button>
        </div>
        <div className="header-actions">
          <span className="local-badge">
            <span /> PERSONAL WORKSPACE
          </span>
          <button
            className="icon-btn"
            title="Save project"
            aria-label="Save project"
            disabled={!frames.length}
            onClick={saveProject}
          >
            <FloppyDisk size={20} />
          </button>
          <button
            className="icon-btn"
            title="Keyboard shortcuts"
            aria-label="Keyboard shortcuts"
            onClick={() => setModal("shortcuts")}
          >
            <Keyboard size={20} />
          </button>
        </div>
      </header>
      <div className="app-body">
        <nav className="nav-rail" aria-label="Workspace navigation">
          {nav.map(([name, Icon]) => (
            <button
              key={name}
              className={"nav-item " + (view === name ? "active" : "")}
              onClick={() => {
                setView(name);
                if (name === "Export") setModal("export");
                if (name === "Settings") setModal("settings");
                if (name === "Animate") previewRef.current?.focus();
              }}
            >
              <Icon size={24} weight={view === name ? "fill" : "regular"} />
              <span>{name}</span>
            </button>
          ))}
          <div className="rail-bottom">
            <span className="version-dot" />
            v1.0
          </div>
        </nav>
        <main className="workspace">
          <div className="workspace-heading">
            <div>
              <span className="eyebrow">ANIMATION WORKSHOP</span>
              <h2>A little character. A lot of possibilities.</h2>
            </div>
            <span className="private-note">
              <CheckCircle size={15} /> Local workspace · AI on request
            </span>
          </div>
          <div className="editor-grid">
            <aside className="assets-panel panel">
              <div className="section-title">
                <h3>Project Assets</h3>
                <span className="count-badge">
                  {asset.url === ORIGINAL.url ? "1" : "2"}
                </span>
              </div>
              <button
                className="upload-zone"
                onClick={() => setModal("upload")}
                onDragOver={(e) => e.preventDefault()}
                onDrop={drop}
              >
                <UploadSimple size={24} />
                <strong>Upload Character</strong>
                <span>PNG, JPG or WebP</span>
              </button>
              <div className="asset-group">
                <span className="small-label">CHARACTERS</span>
                <button
                  className={
                    "asset-card " +
                    (asset.url === ORIGINAL.url ? "selected" : "")
                  }
                  aria-label={"Select original " + sourceName}
                  onClick={() => {
                    setAsset({
                      ...ORIGINAL,
                      url: sourceReference,
                      name: sourceName,
                      analysis: asset.analysis,
                    });
                    setSourceRow(0);
                    setAction("Idle");
                  }}
                >
                  <div className="asset-image checker small-checker">
                    <img src={sourceReference} alt={"Original " + sourceName} />
                  </div>
                  <div className="asset-caption">
                    <span>{sourceName}</span>
                    <span className="asset-status">SOURCE</span>
                  </div>
                </button>
                {asset.url !== ORIGINAL.url && (
                  <div className="imported-asset">
                    <FrameCanvas frame={frames[0]} />
                    <span>{asset.name}</span>
                    <CheckCircle size={15} />
                  </div>
                )}
              </div>
              <button
                className="analysis-launch"
                disabled={!image || busy}
                onClick={() => {
                  setTestMode(false);
                  setPlaying(false);
                  setModal("analysis");
                }}
              >
                <Info size={16} />
                {asset.analysis ? "View AI profile" : "Analyze Monster"}
              </button>
              <button
                className="generation-launch"
                disabled={!image || busy || !asset.analysis}
                title={
                  asset.analysis
                    ? "Generate pose frames"
                    : "Analyze Monster first"
                }
                onClick={() => {
                  setTestMode(false);
                  setPlaying(false);
                  setModal("generation");
                }}
              >
                Generate Frames
              </button>
              <div className="sample-pack">
                <div className="sample-icon">
                  <Stack size={21} />
                </div>
                <strong>Try an animation pack</strong>
                <p>Articulated walk, charge and tusk strike frames.</p>
                <button
                  onClick={() => {
                    setAsset(BOAR);
                    setAction("Idle");
                    update("count", 8);
                    setSourceRow(0);
                    setToast(
                      "โหลดเฟรมหมูป่า · เดินสลับขา / พุ่งชน / งัดเขี้ยว",
                    );
                  }}
                >
                  Load sample <ArrowSquareOut size={14} />
                </button>
              </div>
              <div className="asset-footer">
                <Info size={15} />
                <span>
                  Single image? Start with a motion preview, or import a
                  ready-made sprite sheet.
                </span>
              </div>
            </aside>
            <section
              className={
                "animation-panel panel" + (testMode ? " test-playing" : "")
              }
              aria-label="Animation editor"
            >
              <div className="animation-toolbar">
                <h3>Animation</h3>
                <div
                  className="action-tabs"
                  role="tablist"
                  aria-label="Animation type"
                >
                  {ACTIONS.slice(0, 3).map((a) => (
                    <button
                      role="tab"
                      aria-selected={action === a}
                      disabled={!availableActions(asset).includes(a)}
                      key={a}
                      className={action === a ? "selected" : ""}
                      onClick={() => chooseAction(a)}
                    >
                      {a}
                    </button>
                  ))}
                </div>
              </div>
              <div
                className={
                  "preview-stage " + background + (drag ? " drag-over" : "")
                }
                onDragOver={(e) => {
                  e.preventDefault();
                  setDrag(true);
                }}
                onDragLeave={() => setDrag(false)}
                onDrop={drop}
              >
                <div className="canvas-meta">
                  <span>
                    {settings.size} × {settings.size} PX
                  </span>
                  <span>
                    {asset.mode === "sheet"
                      ? "SPRITE SHEET"
                      : "CHARACTER PREVIEW"}
                  </span>
                </div>
                {testMode ? (
                  <TestArena
                    image={image}
                    asset={asset}
                    settings={settings}
                    sourceRow={sourceRow}
                    onExit={exitTest}
                  />
                ) : (
                  <canvas
                    ref={previewRef}
                    tabIndex={0}
                    aria-label={action + " animation preview"}
                    className={settings.pixelated ? "pixelated" : ""}
                    style={{
                      width: settings.size * settings.zoom,
                      height: settings.size * settings.zoom,
                    }}
                  />
                )}
                {busy && (
                  <div className="loading-layer" role="status">
                    Loading character…
                  </div>
                )}
                <div className="stage-bottom">
                  <span className="mode-label">
                    {asset.mode === "sheet"
                      ? action === "Attack"
                        ? (activeAttack?.name || settings.attackName) +
                          " · Pose frames"
                        : "Articulated frames · Ready to export"
                      : "Idle study · Walk / Attack need pose frames"}
                  </span>
                  <button
                    className="zoom-control"
                    aria-label="Change preview zoom"
                    onClick={() =>
                      update(
                        "zoom",
                        settings.zoom >= 2 ? 1 : settings.zoom + 0.5,
                      )
                    }
                  >
                    <ArrowsOut size={15} />
                    {Math.round(settings.zoom * 100)}%
                  </button>
                </div>
              </div>
              <div className="transport">
                <div className="transport-spacer" />
                <div className="player-buttons">
                  <button
                    className="icon-btn"
                    disabled={!frames.length}
                    onClick={() => step(-1)}
                    aria-label="Previous frame"
                  >
                    <CaretLeft size={19} />
                  </button>
                  <button
                    className="play-button"
                    disabled={!frames.length}
                    onClick={togglePlay}
                    aria-label={playing ? "Pause animation" : "Play animation"}
                  >
                    {playing ? (
                      <Pause size={23} weight="fill" />
                    ) : (
                      <Play size={23} weight="fill" />
                    )}
                  </button>
                  <button
                    className="icon-btn"
                    disabled={!frames.length}
                    onClick={() => step(1)}
                    aria-label="Next frame"
                  >
                    <CaretRight size={19} />
                  </button>
                </div>
                <div className="frame-counter">
                  <button
                    className="icon-btn"
                    aria-label="Restart animation"
                    onClick={() => {
                      setFrame(0);
                      setPlaying(true);
                    }}
                  >
                    <ArrowCounterClockwise size={16} />
                  </button>
                  <span>
                    {String(current + 1).padStart(2, "0")}{" "}
                    <b>/ {String(frames.length).padStart(2, "0")}</b>
                  </span>
                </div>
              </div>
              <div className="test-mode-toolbar">
                <span>
                  {testMode
                    ? "WASD เดิน · Space โจมตี · คลิกพื้นที่ทดสอบเพื่อรับคีย์"
                    : "Try your character with keyboard controls"}
                </span>
                <button
                  className={"test-play-button" + (testMode ? " active" : "")}
                  disabled={
                    !image ||
                    busy ||
                    !availableActions(asset).includes("Walk") ||
                    !availableActions(asset).includes("Attack")
                  }
                  aria-pressed={testMode}
                  onClick={() => {
                    setPlaying(false);
                    setTestMode((v) => !v);
                  }}
                >
                  {testMode ? "Exit Test" : "Test Play"}
                </button>
              </div>
              <div className="preview-caption">
                <span className={"play-state " + (playing ? "playing" : "")}>
                  {testMode ? "KEYBOARD TEST" : playing ? "PLAYING" : "PAUSED"}
                </span>
                <span>
                  {asset.mode === "sheet"
                    ? asset.name
                    : "ภาพเดี่ยว · จำลองการขยับ ยังไม่ใช่ท่าใหม่จาก AI"}
                </span>
              </div>
            </section>
            <aside className="settings-panel panel">
              <div className="section-title">
                <h3>Animation Settings</h3>
                <GearSix size={17} />
              </div>
              <div className="settings-fields">
                <label className="setting-row">
                  <span>Animation</span>
                  <select
                    value={action}
                    onChange={(e) => chooseAction(e.target.value)}
                  >
                    {availableActions(asset).map((a) => (
                      <option key={a}>{a}</option>
                    ))}
                  </select>
                </label>
                <label className="setting-row">
                  <span>Frame count</span>
                  <input
                    aria-label="Frame count"
                    type="number"
                    min={1}
                    max={32}
                    value={frames.length || settings.count}
                    onChange={(e) => {
                      const count = Math.max(
                        1,
                        Math.min(32, Number(e.target.value) || 1),
                      );
                      update("count", count);
                      if (image)
                        setFrames(
                          makeFrames(
                            image,
                            asset,
                            action,
                            { ...settings, count },
                            sourceRow,
                          ),
                        );
                      setFrame(0);
                    }}
                  />
                </label>
                <label className="setting-row">
                  <span>FPS</span>
                  <input
                    aria-label="FPS"
                    type="number"
                    min={1}
                    max={30}
                    value={settings.fps}
                    onChange={(e) =>
                      update(
                        "fps",
                        Math.max(1, Math.min(30, Number(e.target.value) || 1)),
                      )
                    }
                  />
                </label>
                <label className="setting-row">
                  <span>Frame size</span>
                  <select
                    value={settings.size}
                    onChange={(e) => update("size", Number(e.target.value))}
                  >
                    {[128, 192, 256, 512].map((n) => (
                      <option value={n} key={n}>
                        {n} × {n}
                      </option>
                    ))}
                  </select>
                </label>
                {asset.mode === "sheet" && (
                  <label className="setting-row">
                    <span>Source row</span>
                    <select
                      aria-label="Source row"
                      value={clipRow(
                        asset,
                        action,
                        settings.attackId,
                        sourceRow,
                      )}
                      onChange={(e) => setMappedRow(Number(e.target.value))}
                    >
                      {Array.from({ length: asset.rows }, (_, i) => (
                        <option key={i} value={i}>
                          Row {i + 1}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {action === "Attack" && asset.mode === "sheet" && (
                  <>
                    {asset.attacks?.length ? (
                      <label className="setting-row">
                        <span>Attack type</span>
                        <select
                          aria-label="Attack type"
                          value={activeAttack.id}
                          onChange={(e) => {
                            const attack = asset.attacks.find(
                              (x) => x.id === e.target.value,
                            );
                            setSettings((s) => ({
                              ...s,
                              attackId: attack.id,
                              fps: attack.fps || 10,
                              loop: false,
                            }));
                            setFrame(0);
                            setPlaying(true);
                          }}
                        >
                          {asset.attacks.map((x) => (
                            <option key={x.id} value={x.id}>
                              {x.name}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : (
                      <label className="setting-row">
                        <span>Attack name</span>
                        <input
                          aria-label="Attack name"
                          maxLength={60}
                          value={settings.attackName}
                          onChange={(e) => update("attackName", e.target.value)}
                          placeholder="Bite / Claw / Charge"
                        />
                      </label>
                    )}
                    <label className="setting-row">
                      <span>Hit frame</span>
                      <input
                        aria-label="Hit frame"
                        type="number"
                        min={1}
                        max={frames.length || 1}
                        value={Math.min(
                          frames.length || 1,
                          (activeAttack?.hitFrame ?? settings.hitFrame) + 1,
                        )}
                        onChange={(e) => {
                          const hitFrame = Math.max(
                            0,
                            Math.min(
                              frames.length - 1,
                              (Number(e.target.value) || 1) - 1,
                            ),
                          );
                          if (activeAttack)
                            setAsset((a) => ({
                              ...a,
                              attacks: a.attacks.map((x) =>
                                x.id === activeAttack.id
                                  ? { ...x, hitFrame }
                                  : x,
                              ),
                            }));
                          else update("hitFrame", hitFrame);
                        }}
                      />
                    </label>
                    <p className="motion-note">
                      แต่ละมอนสเตอร์ใช้เฟรมโจมตีของตัวเอง
                      เลือกแถวและจังหวะโดนเป้าหมายได้
                    </p>
                  </>
                )}
                {asset.mode === "character" && (
                  <p className="motion-note">
                    ภาพเดี่ยวมีเพียงท่ายืน ใช้ Analyze Monster แล้ว Generate
                    Frames เพื่อสร้าง Walk / Attack หรืออัปโหลด Sprite Sheet
                  </p>
                )}
              </div>
              <div className="checkboxes">
                <label>
                  <input
                    type="checkbox"
                    checked={settings.loop}
                    onChange={(e) => update("loop", e.target.checked)}
                  />{" "}
                  Loop Playback
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={settings.onion}
                    onChange={(e) => update("onion", e.target.checked)}
                  />{" "}
                  Show Onion Skin
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={settings.flip}
                    onChange={(e) => update("flip", e.target.checked)}
                  />{" "}
                  Flip Horizontally
                </label>
              </div>
              <div className="export-block">
                <span className="small-label">ENGINE-READY EXPORT</span>
                <div className="export-buttons">
                  <button
                    disabled={!frames.length}
                    onClick={() => exportFile("png")}
                  >
                    <FileImage size={17} /> Export PNG
                  </button>
                  <button
                    className="primary"
                    disabled={!frames.length}
                    onClick={() => exportFile("json")}
                  >
                    <BracketsCurly size={18} /> Export JSON
                  </button>
                </div>
                <p>
                  Transparent PNG + frame coordinates.
                  <br />
                  Your next game starts here.
                </p>
              </div>
              <button
                className="text-button"
                disabled={!frames.length}
                onClick={() => exportFile("frame")}
              >
                Download current frame <ArrowSquareOut size={14} />
              </button>
            </aside>
            <section
              className="timeline-panel panel"
              aria-label="Frame timeline"
            >
              <div className="timeline-heading">
                <h3>
                  Frames <span>({frames.length})</span>
                </h3>
                <span className="timeline-hint">
                  Select a frame to fine-tune your loop
                </span>
                <div className="timeline-tools">
                  <button
                    className="icon-btn"
                    disabled={!frames.length || frames.length >= 32}
                    onClick={duplicate}
                    aria-label="Duplicate selected frame"
                    title="Duplicate selected frame"
                  >
                    <PlusSquare size={19} />
                  </button>
                  <button
                    className="icon-btn"
                    disabled={frames.length <= 1}
                    onClick={remove}
                    aria-label="Delete selected frame"
                    title="Delete selected frame"
                  >
                    <Trash size={19} />
                  </button>
                </div>
              </div>
              <div className="timeline-content">
                <div className="frame-strip">
                  {frames.map((f, i) => (
                    <button
                      key={i}
                      aria-label={"Select frame " + (i + 1)}
                      aria-pressed={current === i}
                      className={
                        "frame-tile " +
                        (current === i ? "selected" : "") +
                        (action === "Attack" &&
                        i ===
                          Math.min(
                            frames.length - 1,
                            activeAttack?.hitFrame ?? settings.hitFrame,
                          )
                          ? " hit-frame"
                          : "")
                      }
                      onClick={() => {
                        setPlaying(false);
                        setFrame(i);
                      }}
                    >
                      <FrameCanvas frame={f} />
                      <span>{String(i + 1).padStart(2, "0")}</span>
                    </button>
                  ))}
                </div>
                <div className="timeline-fps">
                  <label htmlFor="timeline-fps">
                    PLAYBACK{" "}
                    <strong>
                      {settings.fps} <span>FPS</span>
                    </strong>
                  </label>
                  <input
                    id="timeline-fps"
                    type="range"
                    min={1}
                    max={30}
                    value={settings.fps}
                    onChange={(e) => update("fps", Number(e.target.value))}
                  />
                  <div>
                    <span>Slow</span>
                    <span>Fast</span>
                  </div>
                </div>
              </div>
            </section>
          </div>
          <footer className="workspace-footer">
            <span>
              <span className="status-dot" /> {frames.length} frames <i />{" "}
              {settings.fps} fps <i /> {totalDuration.toFixed(2)}s duration
            </span>
            <button onClick={() => setModal("shortcuts")}>
              <Keyboard size={14} />
              <span>Space</span> {testMode ? "Attack" : "Play / pause"}{" "}
              <span className="footer-arrows">← →</span> Step frames
            </button>
            <span>MADE FOR YOUR NEXT ADVENTURE</span>
          </footer>
        </main>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        hidden
        onChange={(e) => {
          importFile(e.target.files[0]);
          e.target.value = "";
        }}
      />
      <input
        ref={projectRef}
        type="file"
        accept=".json"
        hidden
        onChange={(e) => {
          openProject(e.target.files[0]);
          e.target.value = "";
        }}
      />
      {toast && (
        <div className="toast" role="status">
          <Info size={19} />
          <span>{toast}</span>
          <button
            className="icon-btn"
            onClick={() => setToast("")}
            aria-label="Dismiss notification"
          >
            <X size={17} />
          </button>
        </div>
      )}
      {modal && (
        <div
          className="modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setModal(null);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="dialog-title"
            className="dialog"
          >
            <div className="dialog-head">
              <h2 id="dialog-title">
                {
                  {
                    upload: "Import character",
                    export: "Export animation",
                    settings: "Workspace settings",
                    shortcuts: "Keyboard shortcuts",
                    analysis: "AI Monster Analysis",
                    generation: "Generate Animation Frames",
                  }[modal]
                }
              </h2>
              <button
                className="icon-btn"
                aria-label="Close dialog"
                onClick={() => setModal(null)}
              >
                <X size={20} />
              </button>
            </div>
            {modal === "analysis" && (
              <MonsterAnalysis
                asset={asset}
                image={image}
                settings={settings}
                onGenerate={(analysis) => {
                  setAsset((a) => ({ ...a, analysis }));
                  setModal("generation");
                }}
                onSave={(analysis) => {
                  setAsset((a) => ({ ...a, analysis }));
                  setModal(null);
                  setToast("บันทึกโปรไฟล์ AI แล้ว · ยังไม่ได้สร้างเฟรมใหม่");
                }}
              />
            )}
            {modal === "generation" && (
              <FrameGeneration
                asset={asset}
                image={image}
                settings={settings}
                onUse={(generated) => {
                  setAsset(generated);
                  setAction("Idle");
                  setSourceRow(0);
                  setFrame(0);
                  setSettings((s) => ({
                    ...s,
                    count: 8,
                    attackId: "generated",
                    fps: 8,
                    loop: true,
                  }));
                  setPlaying(true);
                  setModal(null);
                  setToast(
                    "นำเข้าเฟรม AI แล้ว · เลือก Walk / Attack หรือ Test Play ได้เลย",
                  );
                }}
              />
            )}
            {modal === "upload" && (
              <>
                <p>เลือกภาพตัวละคร หรือ Sprite Sheet ที่มีเฟรมพร้อมใช้งาน</p>
                <div className="import-options">
                  <button
                    className={importMode === "character" ? "selected" : ""}
                    onClick={() => setImportMode("character")}
                  >
                    <ImageSquare size={24} />
                    <strong>Single character</strong>
                    <span>จำลองการขยับจากภาพเดี่ยว</span>
                  </button>
                  <button
                    className={importMode === "sheet" ? "selected" : ""}
                    onClick={() => setImportMode("sheet")}
                  >
                    <Stack size={24} />
                    <strong>Sprite sheet</strong>
                    <span>ตัดและเล่นเฟรมที่มีอยู่แล้ว</span>
                  </button>
                </div>
                {importMode === "sheet" && (
                  <div className="grid-inputs">
                    <label>
                      Columns
                      <input
                        aria-label="Sheet columns"
                        type="number"
                        min={1}
                        max={32}
                        value={columns}
                        onChange={(e) =>
                          setColumns(
                            Math.max(
                              1,
                              Math.min(32, Number(e.target.value) || 1),
                            ),
                          )
                        }
                      />
                    </label>
                    <label>
                      Rows
                      <input
                        aria-label="Sheet rows"
                        type="number"
                        min={1}
                        max={32}
                        value={rows}
                        onChange={(e) =>
                          setRows(
                            Math.max(
                              1,
                              Math.min(32, Number(e.target.value) || 1),
                            ),
                          )
                        }
                      />
                    </label>
                  </div>
                )}
                <button
                  className="dialog-upload"
                  disabled={busy}
                  onClick={() => fileRef.current.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={drop}
                >
                  <UploadSimple size={28} />
                  <strong>
                    {busy ? "Loading…" : "Choose image or drop it here"}
                  </strong>
                  <span>PNG, JPG, WebP · Up to 20 MB</span>
                </button>
                <div className="dialog-note">
                  <Info size={18} />
                  <span>
                    ภาพเดี่ยวเริ่มจากท่ายืน วิเคราะห์ตัวละครแล้วเลือก Generate
                    Frames เพื่อสร้างภาพท่าใหม่ด้วย AI
                  </span>
                </div>
              </>
            )}
            {modal === "export" && (
              <>
                <p>
                  {project} / {action} · {frames.length} frames ·{" "}
                  {settings.size} × {settings.size} px · {settings.fps} FPS
                </p>
                <div className="export-preview checker">
                  <FrameCanvas frame={frames[current]} />
                </div>
                <button
                  className="primary dialog-wide"
                  disabled={!frames.length}
                  onClick={() => exportFile("png")}
                >
                  <FileImage size={20} /> Download PNG sprite sheet
                </button>
                <button
                  className="dialog-wide"
                  disabled={!frames.length}
                  onClick={() => exportFile("json")}
                >
                  <BracketsCurly size={20} /> Download JSON atlas
                </button>
                <button
                  className="dialog-wide"
                  disabled={!frames.length}
                  onClick={saveProject}
                >
                  <FloppyDisk size={20} /> Save editable project
                </button>
                <p className="fine-print">
                  เก็บ PNG และ JSON ไว้ในโฟลเดอร์เดียวกัน ชื่อภาพใน JSON
                  ตรงกับไฟล์ PNG ที่ส่งออก
                </p>
              </>
            )}
            {modal === "settings" && (
              <>
                <p>Personal workspace · ประมวลผลภายในเบราว์เซอร์</p>
                <label className="setting-row">
                  <span>Preview background</span>
                  <select
                    value={background}
                    onChange={(e) => setBackground(e.target.value)}
                  >
                    <option value="checker">Transparency checker</option>
                    <option value="dark">Dark</option>
                    <option value="light">Light</option>
                  </select>
                </label>
                <label className="check-setting">
                  <input
                    type="checkbox"
                    checked={settings.pixelated}
                    onChange={(e) => update("pixelated", e.target.checked)}
                  />{" "}
                  Crisp pixel rendering
                </label>
                <div className="dialog-note">
                  <Info size={18} />
                  <span>
                    Analyze Monster ใช้ OpenRouter เมื่อกดวิเคราะห์
                    ภาพจะถูกส่งไปยังบริการ AI · Generate Frames
                    ใช้โมเดลสร้างภาพแยกต่างหากและมีค่าใช้จ่ายเมื่อกดสร้าง
                  </span>
                </div>
                <button
                  className="dialog-wide"
                  onClick={() => {
                    setSettings(DEFAULTS);
                    setBackground("checker");
                    setToast("คืนค่าตั้งค่าเริ่มต้นแล้ว");
                  }}
                >
                  Reset settings
                </button>
                <button
                  className="dialog-wide"
                  onClick={() => projectRef.current.click()}
                >
                  <FolderOpen size={20} /> Open saved project
                </button>
              </>
            )}
            {modal === "shortcuts" && (
              <div className="shortcuts">
                {[
                  ["W / A / S / D", "Test Play: move character"],
                  ["Space", "Test Play: attack · Editor: play / pause"],
                  ["← / →", "Previous / next frame"],
                  ["1 / 2 / 3", "Idle / Walk / Attack"],
                  ["Esc", "Close dialog"],
                ].map(([key, label]) => (
                  <div key={key}>
                    <span>{label}</span>
                    <kbd>{key}</kbd>
                  </div>
                ))}
                <p>
                  คลิกเฟรมเพื่อหยุดและตรวจภาพ ใช้ปุ่มเพิ่มหรือลบเฟรมใน Timeline
                  ได้ การเปลี่ยนท่า ขนาด หรือจำนวนเฟรมจะสร้างลำดับใหม่
                </p>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
