import { loadImage } from "./sprite-engine.js";

// Read connected silhouettes globally so a long pose is not cut at a grid line.
export function detectSpriteCells(rgba, width, height) {
  const labels = new Uint32Array(width * height),
    queue = new Uint32Array(width * height),
    parts = [];
  let id = 0;
  for (let start = 0; start < labels.length; start++) {
    if (labels[start] || rgba[start * 4 + 3] <= 24) continue;
    id++;
    let head = 0,
      tail = 1,
      left = width,
      top = height,
      right = -1,
      bottom = -1;
    queue[0] = start;
    labels[start] = id;
    while (head < tail) {
      const p = queue[head++],
        x = p % width,
        y = Math.floor(p / width);
      left = Math.min(left, x);
      right = Math.max(right, x);
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
      const add = (n) => {
        if (!labels[n] && rgba[n * 4 + 3] > 24) {
          labels[n] = id;
          queue[tail++] = n;
        }
      };
      if (x > 0) add(p - 1);
      if (x + 1 < width) add(p + 1);
      if (y > 0) add(p - width);
      if (y + 1 < height) add(p + width);
    }
    if (tail >= 12) parts.push({ id, left, top, right, bottom, area: tail });
  }
  parts.sort((a, b) => b.area - a.area);
  if (parts.length < 24) return null;
  const major = parts.slice(0, 24),
    minor = parts.slice(24),
    smallest = major[23].area;
  if (
    smallest < Math.max(50, ((width * height) / 24) * 0.005) ||
    (minor[0] && minor[0].area > smallest * 0.25)
  )
    return null;
  const ordered = major.sort((a, b) => a.top + a.bottom - (b.top + b.bottom));
  const cells = [];
  for (let row = 0; row < 6; row++) {
    const group = ordered
      .slice(row * 4, row * 4 + 4)
      .sort((a, b) => a.left - b.left);
    for (let col = 0; col < 4; col++) {
      const p = group[col],
        cx = (p.left + p.right) / 2,
        cy = (p.top + p.bottom) / 2;
      if (
        Math.abs(cx - ((col + 0.5) * width) / 4) > (width / 4) * 0.65 ||
        Math.abs(cy - ((row + 0.5) * height) / 6) > (height / 6) * 0.65
      )
        return null;
      cells.push({ ...p, ids: new Set([p.id]), row });
    }
  }
  for (const p of minor) {
    let best = null,
      distance = Infinity;
    const px = (p.left + p.right) / 2,
      py = (p.top + p.bottom) / 2;
    for (const c of cells) {
      const d =
        ((px - (c.left + c.right) / 2) / (width / 4)) ** 2 +
        ((py - (c.top + c.bottom) / 2) / (height / 6)) ** 2;
      if (d < distance) {
        best = c;
        distance = d;
      }
    }
    if (best && distance < 0.5) {
      best.ids.add(p.id);
      best.left = Math.min(best.left, p.left);
      best.right = Math.max(best.right, p.right);
      best.top = Math.min(best.top, p.top);
      best.bottom = Math.max(best.bottom, p.bottom);
    }
  }
  for (const c of cells) {
    c.left = Math.max(0, c.left - 2);
    c.top = Math.max(0, c.top - 2);
    c.right = Math.min(width - 1, c.right + 2);
    c.bottom = Math.min(height - 1, c.bottom + 2);
    c.width = c.right - c.left + 1;
    c.height = c.bottom - c.top + 1;
    c.localBottom = c.bottom - (c.row * height) / 6;
    c.cellHeight = height / 6;
  }
  return { cells, labels };
}

export async function normalizeGeneratedSheet(url, size = 256) {
  const image = await loadImage(url);
  if (
    image.naturalWidth > 4096 ||
    image.naturalHeight > 6144 ||
    image.naturalWidth * image.naturalHeight > 16000000
  )
    throw Error("ภาพที่ได้ใหญ่เกินขอบเขตที่รองรับ");
  const source = document.createElement("canvas");
  source.width = image.naturalWidth;
  source.height = image.naturalHeight;
  const ctx = source.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(image, 0, 0);
  const rgba = ctx.getImageData(0, 0, source.width, source.height).data;
  let transparent = 0;
  for (let p = 3; p < rgba.length; p += 4) if (rgba[p] < 16) transparent++;
  if (transparent < source.width * source.height * 0.04)
    throw Error(
      "ภาพที่ได้ไม่มี alpha โปร่งใสเพียงพอ จึงยังไม่นำเข้าเป็นเฟรมเกม ดาวน์โหลดต้นฉบับเพื่อตรวจได้",
    );
  const detected = detectSpriteCells(rgba, source.width, source.height);
  const cells = detected?.cells || [],
    warnings = [];
  if (!detected)
    for (let i = 0; i < 24; i++) {
      const x0 = Math.round(((i % 4) * source.width) / 4),
        y0 = Math.round((Math.floor(i / 4) * source.height) / 6);
      const x1 = Math.round((((i % 4) + 1) * source.width) / 4),
        y1 = Math.round(((Math.floor(i / 4) + 1) * source.height) / 6);
      let left = x1,
        top = y1,
        right = -1,
        bottom = -1,
        area = 0;
      for (let y = y0; y < y1; y++)
        for (let x = x0; x < x1; x++)
          if (rgba[(y * source.width + x) * 4 + 3] > 24) {
            area++;
            left = Math.min(left, x);
            right = Math.max(right, x);
            top = Math.min(top, y);
            bottom = Math.max(bottom, y);
          }
      if (area < 50)
        throw Error(
          `เฟรม ${i + 1} ว่างหรือมีตัวละครเล็กเกินไป กรุณาตรวจภาพต้นฉบับ`,
        );
      if (left <= x0 || right >= x1 - 1 || top <= y0 || bottom >= y1 - 1)
        warnings.push(`เฟรม ${i + 1} ชิดขอบ อาจมีส่วนถูกตัด`);
      cells.push({
        left,
        top,
        right,
        bottom,
        width: right - left + 1,
        height: bottom - top + 1,
        localBottom: bottom - y0,
        cellHeight: y1 - y0,
      });
    }
  if (warnings.length > 4)
    throw Error(
      "หลายเฟรมติดขอบช่อง อาจจัดกริดไม่ตรง 4 × 6 กรุณาตรวจต้นฉบับก่อนสร้างใหม่",
    );
  if (detected)
    cells.forEach((c, i) => {
      if (
        c.left === 0 ||
        c.top === 0 ||
        c.right === source.width - 1 ||
        c.bottom === source.height - 1
      )
        warnings.push(`เฟรม ${i + 1} ชิดขอบภาพต้นฉบับ โปรดตรวจส่วนปลายตัวละคร`);
    });
  const baseline = Math.round(size * 0.92),
    pad = Math.round(size * 0.07);
  for (let a = 0; a < 3; a++) {
    const ground = Math.max(
      ...cells.slice(a * 8, a * 8 + 8).map((c) => c.localBottom),
    );
    cells.slice(a * 8, a * 8 + 8).forEach((c) => {
      c.lift = Math.max(
        0,
        Math.min(c.cellHeight * 0.28, ground - c.localBottom),
      );
    });
  }
  const scale = Math.min(
    (size - pad * 2) / Math.max(...cells.map((c) => c.width)),
    (baseline - pad) / Math.max(...cells.map((c) => c.height + c.lift)),
  );
  const sheet = document.createElement("canvas");
  sheet.width = size * 8;
  sheet.height = size * 3;
  const g = sheet.getContext("2d");
  const frames = [[], [], []];
  cells.forEach((c, i) => {
    const f = document.createElement("canvas");
    f.width = f.height = size;
    const w = Math.max(1, Math.round(c.width * scale)),
      h = Math.max(1, Math.round(c.height * scale));
    let crop = source;
    if (detected) {
      crop = document.createElement("canvas");
      crop.width = c.width;
      crop.height = c.height;
      const pixels = crop.getContext("2d").createImageData(c.width, c.height);
      for (let y = 0; y < c.height; y++)
        for (let x = 0; x < c.width; x++) {
          const pos = (c.top + y) * source.width + c.left + x,
            label = detected.labels[pos];
          if (label && !c.ids.has(label)) continue;
          const from = pos * 4,
            to = (y * c.width + x) * 4;
          for (let k = 0; k < 4; k++) pixels.data[to + k] = rgba[from + k];
        }
      crop.getContext("2d").putImageData(pixels, 0, 0);
    }
    f.getContext("2d").drawImage(
      crop,
      detected ? 0 : c.left,
      detected ? 0 : c.top,
      c.width,
      c.height,
      Math.round((size - w) / 2),
      baseline - h - Math.round(c.lift * scale),
      w,
      h,
    );
    frames[Math.floor(i / 8)].push(f);
    g.drawImage(f, (i % 8) * size, Math.floor(i / 8) * size);
  });
  for (const [row, name] of [
    [1, "Walk"],
    [2, "Attack"],
  ]) {
    const hashes = frames[row].map((f) => {
      const d = f.getContext("2d").getImageData(0, 0, size, size).data;
      let hash = 2166136261;
      for (let i = 0; i < d.length; i += 16)
        hash = Math.imul(hash ^ d[i] ^ d[i + 3], 16777619);
      return hash;
    });
    if (new Set(hashes).size < 3)
      throw Error(
        `${name} มีภาพซ้ำมากเกินไป จึงยังไม่ถือว่าเป็นแอนิเมชันพร้อมใช้`,
      );
  }
  return {
    url: sheet.toDataURL("image/png"),
    frames,
    warnings,
    pivot: { x: 0.5, y: baseline / size },
    sourceSize: { width: source.width, height: source.height },
    segmentation: detected ? "connected-silhouettes" : "grid",
    size,
  };
}
export function generatedAsset(
  candidate,
  job,
  profile,
  attackIndex,
  reference,
  sourceName,
  analysis,
) {
  const attack = profile.attacks[attackIndex];
  return {
    name: profile.name + " · AI frames",
    url: candidate.url,
    mode: "sheet",
    columns: 8,
    rows: 3,
    rowMap: { Idle: 0, Walk: 1, Attack: 2 },
    pivot: candidate.pivot,
    attacks: [
      {
        id: "generated",
        name: attack.name,
        row: 2,
        hitFrame: attack.hitFrame - 1,
        fps: 10,
      },
    ],
    analysis: { ...analysis, profile },
    generation: {
      id: job.id,
      model: job.model,
      quality: job.quality,
      prompt: job.prompt,
      reference,
      sourceName,
      createdAt: new Date().toISOString(),
      sourceSize: candidate.sourceSize,
      warnings: candidate.warnings,
    },
  };
}
