export const ACTIONS = ["Idle", "Walk", "Attack", "Run", "Jump"];
export function clipRow(asset, action, attackId = "charge", fallback = 0) {
  if (action === "Attack" && asset.attacks?.length) {
    return (asset.attacks.find((a) => a.id === attackId) || asset.attacks[0])
      .row;
  }
  if (Number.isInteger(asset.rowMap?.[action])) return asset.rowMap[action];
  return asset.sample
    ? { Idle: 0, Walk: 1, Run: 2, Jump: 3, Attack: 4 }[action] || 0
    : fallback;
}
export function availableActions(asset) {
  if (asset.mode === "character") return ["Idle"];
  return asset.rowMap
    ? ACTIONS.filter(
        (a) =>
          Number.isInteger(asset.rowMap[a]) ||
          (a === "Attack" && asset.attacks?.length),
      )
    : ACTIONS;
}
export function clipDuration(asset, action, index, count, fps, attackId) {
  const attack =
    asset.attacks?.find((a) => a.id === attackId) || asset.attacks?.[0];
  const durations = action === "Attack" ? attack?.durations : null;
  const ms = durations?.[Math.floor((index / count) * durations.length)];
  return Number.isFinite(ms) && ms >= 16 && ms <= 2000
    ? (ms * 10) / fps
    : 1000 / fps;
}
export function motion(action, index, count) {
  const t = index / count,
    wave = Math.sin(t * Math.PI * 2);
  if (action === "Walk")
    return {
      x: wave * 2,
      y: -Math.abs(wave) * 4,
      sx: 1 + wave * 0.012,
      sy: 1 - Math.abs(wave) * 0.018,
      angle: wave * 0.023,
    };
  if (action === "Run")
    return {
      x: wave * 4,
      y: -Math.abs(wave) * 8,
      sx: 1 + wave * 0.025,
      sy: 1 - Math.abs(wave) * 0.025,
      angle: wave * 0.045,
    };
  if (action === "Attack") {
    const s = Math.sin(Math.PI * t) ** 4;
    return {
      x: s * 12,
      y: s * 3,
      sx: 1 + s * 0.09,
      sy: 1 - s * 0.06,
      angle: s * 0.08,
    };
  }
  if (action === "Jump")
    return { x: 0, y: -Math.sin(Math.PI * t) * 24, sx: 1, sy: 1, angle: 0 };
  return {
    x: 0,
    y: -wave * 1.1,
    sx: 1 + wave * 0.008,
    sy: 1 + wave * 0.018,
    angle: 0,
  };
}
export function makeFrames(image, asset, action, settings, row = 0) {
  const size = settings.size,
    count = settings.count;
  const sourceRow = clipRow(asset, action, settings.attackId, row);
  return Array.from({ length: count }, (_, i) => {
    const c = document.createElement("canvas");
    c.width = c.height = size;
    const g = c.getContext("2d");
    g.imageSmoothingEnabled = !settings.pixelated;
    g.translate(size / 2, size / 2);
    if (settings.flip) g.scale(-1, 1);
    if (asset.mode === "sheet") {
      const w = image.naturalWidth / asset.columns,
        h = image.naturalHeight / asset.rows,
        s = Math.min(size / w, size / h);
      g.drawImage(
        image,
        Math.floor((i / count) * asset.columns) * w,
        Math.min(sourceRow, asset.rows - 1) * h,
        w,
        h,
        (-w * s) / 2,
        (-h * s) / 2,
        w * s,
        h * s,
      );
    } else {
      const m = motion(action, i, count),
        w = image.naturalWidth,
        h = image.naturalHeight,
        s = Math.min((size * 0.86) / w, (size * 0.86) / h);
      g.translate((m.x * size) / 192, size * 0.38 + (m.y * size) / 192);
      g.rotate(m.angle);
      g.scale(m.sx, m.sy);
      g.drawImage(image, (-w * s) / 2, -h * s, w * s, h * s);
    }
    return c;
  });
}
export function safeName(name) {
  return (
    String(name)
      .normalize("NFKC")
      .replace(/[^\p{L}\p{M}\p{N}_-]+/gu, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 60) || "sprite"
  );
}
export function makeAtlas(
  name,
  count,
  size,
  fps,
  loop,
  action,
  attack,
  options = {},
) {
  const frames = {},
    keys = [];
  for (let i = 0; i < count; i++) {
    const key = action.toLowerCase() + "_" + String(i).padStart(3, "0");
    keys.push(key);
    frames[key] = {
      frame: { x: i * size, y: 0, w: size, h: size },
      rotated: false,
      trimmed: false,
      spriteSourceSize: { x: 0, y: 0, w: size, h: size },
      sourceSize: { w: size, h: size },
      pivot: options.pivot || { x: 0.5, y: 0.8 },
      duration: attack?.durations?.[i] ?? 1000 / fps,
    };
  }
  return {
    frames,
    animations: { [action.toLowerCase()]: keys },
    meta: {
      app: "Sprite Sheet Animation",
      version: "1.0",
      image: name + ".png",
      format: "RGBA8888",
      size: { w: size * count, h: size },
      scale: "1",
      framerate: fps,
      loop,
      ...(attack
        ? {
            attack: {
              ...attack,
              events: [
                {
                  frame: attack.hitFrame,
                  type: "hit",
                  timeMs: keys
                    .slice(0, attack.hitFrame)
                    .reduce((sum, key) => sum + frames[key].duration, 0),
                },
              ],
            },
          }
        : {}),
    },
  };
}
export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("เปิดภาพไม่สำเร็จ"));
    img.src = url;
  });
}
export function download(blob, name) {
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}
