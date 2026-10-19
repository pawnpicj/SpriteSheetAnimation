import test from "node:test";
import assert from "node:assert/strict";
import { detectSpriteCells } from "../src/generated-frames.js";
test("long attack silhouettes crossing the nominal grid remain whole", () => {
  const width = 160,
    height = 240,
    rgba = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < 24; i++) {
    const row = Math.floor(i / 4),
      col = i % 4;
    const left = i === 19 ? 118 : col * 40 + 12,
      right = i === 19 ? 153 : col * 40 + 27;
    for (let y = row * 40 + 12; y < row * 40 + 28; y++)
      for (let x = left; x <= right; x++) rgba[(y * width + x) * 4 + 3] = 255;
  }
  const result = detectSpriteCells(rgba, width, height);
  assert.ok(result);
  assert.equal(result.cells.length, 24);
  assert.ok(result.cells[19].left < 120);
  assert.ok(result.cells[19].right >= 153);
  assert.ok(result.cells[19].width > 35);
  assert.ok(result.cells[18].right < result.cells[19].left);
});
test("unrecognized silhouette counts request grid validation rather than inventing missing sprites", () => {
  const rgba = new Uint8ClampedArray(160 * 240 * 4);
  assert.equal(detectSpriteCells(rgba, 160, 240), null);
});
