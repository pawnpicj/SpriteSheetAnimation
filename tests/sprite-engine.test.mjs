import test from "node:test";
import assert from "node:assert/strict";
import {
  makeAtlas,
  safeName,
  motion,
  ACTIONS,
  clipRow,
  availableActions,
  clipDuration,
} from "../src/sprite-engine.js";

test("monster-specific attack rows are independent of walking and survive selection", () => {
  const asset = {
    mode: "sheet",
    rows: 4,
    rowMap: { Idle: 0, Walk: 1, Attack: 2 },
    attacks: [
      { id: "charge", row: 2 },
      { id: "tusk", row: 3 },
    ],
  };
  assert.equal(clipRow(asset, "Walk", "tusk"), 1);
  assert.equal(clipRow(asset, "Attack", "charge"), 2);
  assert.equal(clipRow(asset, "Attack", "tusk"), 3);
  assert.deepEqual(availableActions(asset), ["Idle", "Walk", "Attack"]);
  assert.deepEqual(availableActions({ mode: "character" }), ["Idle"]);
});
test("attack hit event follows variable frame durations instead of constant FPS", () => {
  const durations = [140, 120, 90, 60, 110, 90, 110, 160];
  const asset = { attacks: [{ id: "charge", durations }] };
  assert.equal(clipDuration(asset, "Attack", 3, 8, 10, "charge"), 60);
  assert.equal(clipDuration(asset, "Walk", 3, 8, 8, "charge"), 125);
  const a = makeAtlas("charge", 8, 192, 10, false, "Attack", {
    name: "พุ่งชน",
    hitFrame: 4,
    durations,
  });
  assert.equal(a.frames.attack_003.duration, 60);
  assert.equal(a.meta.attack.events[0].timeMs, 410);
  assert.equal(a.meta.attack.events[0].frame, 4);
});
test("atlas covers every exported cell without overlap and references the PNG filename", () => {
  for (const count of [1, 8, 32])
    for (const size of [128, 192, 256, 512]) {
      const atlas = makeAtlas(
        "forest_boar_idle",
        count,
        size,
        12,
        true,
        "Idle",
      );
      assert.equal(atlas.meta.image, "forest_boar_idle.png");
      assert.equal(atlas.meta.size.w, count * size);
      const keys = atlas.animations.idle;
      assert.equal(new Set(keys).size, count);
      keys.forEach((key, i) => {
        const f = atlas.frames[key];
        assert.equal(f.frame.x, i * size);
        assert.equal(f.frame.y, 0);
        assert.equal(f.frame.w, size);
        assert.equal(f.frame.h, size);
        assert.ok(f.frame.x + f.frame.w <= atlas.meta.size.w);
        assert.equal(f.duration, 1000 / 12);
        assert.equal(f.sourceSize.w, size);
      });
    }
});
test("export preserves playback metadata and non-looping actions", () => {
  const a = makeAtlas("hit", 7, 256, 10, false, "Attack");
  assert.equal(a.meta.loop, false);
  assert.equal(a.meta.framerate, 10);
  assert.equal(a.frames.attack_000.duration, 100);
  assert.equal(a.animations.attack.length, 7);
});
test("download names are safe and preserve Thai project names", () => {
  assert.equal(safeName("../Forest Boar: v2"), "Forest_Boar_v2");
  assert.equal(safeName("หมูป่า"), "หมูป่า");
  assert.equal(safeName("///"), "sprite");
  assert.ok(safeName("a".repeat(100)).length <= 60);
});
test("motion transforms remain finite and positive at every supported frame count", () => {
  for (const a of ACTIONS)
    for (let count = 1; count <= 32; count++)
      for (let i = 0; i < count; i++) {
        const m = motion(a, i, count);
        assert.ok(Object.values(m).every(Number.isFinite));
        assert.ok(m.sx > 0 && m.sy > 0);
      }
});
