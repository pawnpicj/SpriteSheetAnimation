import React, { useEffect, useMemo, useRef, useState } from "react";
import { availableActions, makeFrames, clipDuration } from "./sprite-engine.js";
import "./test-arena.css";

export function TestArena({ image, asset, settings, sourceRow, onExit }) {
  const canvasRef = useRef(null);
  const [status, setStatus] = useState({ action: "Idle", impact: false });
  const clips = useMemo(() => {
    if (!image) return {};
    return Object.fromEntries(
      availableActions(asset).map((action) => [
        action,
        makeFrames(image, asset, action, settings, sourceRow),
      ]),
    );
  }, [
    image,
    asset,
    settings.count,
    settings.size,
    settings.flip,
    settings.pixelated,
    settings.attackId,
    sourceRow,
  ]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !clips.Idle) return;
    const ctx = canvas.getContext("2d");
    const keys = new Set();
    const actor = {
      x: 0.5,
      y: 0.78,
      facing: 1,
      action: "Idle",
      frame: 0,
      elapsed: 0,
    };
    let raf,
      last = 0,
      width = 1,
      height = 1,
      previousStatus = "";
    const attack =
      asset.attacks?.find((a) => a.id === settings.attackId) ||
      asset.attacks?.[0];
    const attackFps = attack?.fps || 10;
    const hitFrame = Math.min(
      (clips.Attack?.length || 1) - 1,
      attack?.hitFrame ?? settings.hitFrame,
    );
    const resize = () => {
      const rect = canvas.parentElement.getBoundingClientRect();
      width = Math.max(1, Math.round(rect.width));
      height = Math.max(1, Math.round(rect.height));
      const density = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * density);
      canvas.height = Math.round(height * density);
      ctx.setTransform(density, 0, 0, density, 0, 0);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(canvas.parentElement);
    resize();
    const changeAction = (action) => {
      if (actor.action === action) return;
      actor.action = action;
      actor.frame = 0;
      actor.elapsed = 0;
    };
    const editable = (target) =>
      target instanceof Element &&
      target.closest(
        "input,select,textarea,button,[contenteditable=true],[role=dialog]",
      );
    const down = (e) => {
      if (editable(e.target) || e.ctrlKey || e.altKey || e.metaKey) return;
      if (["KeyW", "KeyA", "KeyS", "KeyD"].includes(e.code)) {
        e.preventDefault();
        keys.add(e.code);
      }
      if (e.code === "Space") {
        e.preventDefault();
        if (
          !e.repeat &&
          !keys.has("Space") &&
          actor.action !== "Attack" &&
          clips.Attack
        )
          changeAction("Attack");
        keys.add("Space");
      }
      if (e.code === "Escape") {
        e.preventDefault();
        onExit();
      }
    };
    const up = (e) => keys.delete(e.code);
    const resetKeys = () => {
      keys.clear();
      last = 0;
      if (actor.action !== "Attack") changeAction("Idle");
    };
    const focus = () => canvas.focus({ preventScroll: true });
    canvas.addEventListener("pointerdown", focus);
    canvas.addEventListener("blur", resetKeys);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", resetKeys);
    document.addEventListener("visibilitychange", resetKeys);
    const tick = (time) => {
      const dt = last ? Math.min(40, time - last) : 0;
      last = time;
      const dx = Number(keys.has("KeyD")) - Number(keys.has("KeyA"));
      const dy = Number(keys.has("KeyS")) - Number(keys.has("KeyW"));
      const length = Math.hypot(dx, dy);
      if (actor.action !== "Attack") {
        changeAction(length && clips.Walk ? "Walk" : "Idle");
        if (length && clips.Walk) {
          actor.x += ((dx / length) * 170 * dt) / 1000 / width;
          actor.y += ((dy / length) * 170 * dt) / 1000 / height;
          if (dx) actor.facing = dx < 0 ? -1 : 1;
        }
      }
      const size = Math.min(170, height * 0.52, width * 0.54);
      const pivot = asset.pivot || { x: 0.5, y: 0.8 };
      const left = size / 2 + 8,
        right = Math.max(left, width - size / 2 - 8);
      const top = Math.min(height - 42, size * pivot.y + 36),
        bottom = Math.max(top, height - 42 - size * (1 - pivot.y));
      actor.x = Math.max(left, Math.min(right, actor.x * width)) / width;
      actor.y = Math.max(top, Math.min(bottom, actor.y * height)) / height;
      actor.elapsed += dt;
      let list = clips[actor.action] || clips.Idle;
      let fps = actor.action === "Attack" ? attackFps : 8;
      while (
        actor.elapsed >=
        clipDuration(
          asset,
          actor.action,
          actor.frame,
          list.length,
          fps,
          settings.attackId,
        )
      ) {
        actor.elapsed -= clipDuration(
          asset,
          actor.action,
          actor.frame,
          list.length,
          fps,
          settings.attackId,
        );
        if (actor.frame + 1 < list.length) actor.frame++;
        else if (actor.action === "Attack") {
          changeAction(length && clips.Walk ? "Walk" : "Idle");
          list = clips[actor.action] || clips.Idle;
          fps = 8;
          break;
        } else actor.frame = 0;
      }
      ctx.clearRect(0, 0, width, height);
      ctx.imageSmoothingEnabled = !settings.pixelated;
      ctx.save();
      ctx.translate(actor.x * width, actor.y * height);
      ctx.scale(actor.facing, 1);
      ctx.drawImage(
        list[actor.frame],
        -size * pivot.x,
        -size * pivot.y,
        size,
        size,
      );
      ctx.restore();
      canvas.dataset.x = String(Math.round(actor.x * width));
      canvas.dataset.y = String(Math.round(actor.y * height));
      canvas.dataset.facing = String(actor.facing);
      canvas.dataset.action = actor.action;
      canvas.dataset.frame = String(actor.frame);
      const impact = actor.action === "Attack" && actor.frame === hitFrame;
      const key = actor.action + impact;
      if (key !== previousStatus) {
        previousStatus = key;
        setStatus({ action: actor.action, impact });
      }
      raf = requestAnimationFrame(tick);
    };
    focus();
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      keys.clear();
      canvas.removeEventListener("pointerdown", focus);
      canvas.removeEventListener("blur", resetKeys);
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", resetKeys);
      document.removeEventListener("visibilitychange", resetKeys);
    };
  }, [
    clips,
    asset,
    settings.attackId,
    settings.hitFrame,
    settings.pixelated,
    onExit,
  ]);

  return (
    <div className="test-arena">
      <canvas
        ref={canvasRef}
        tabIndex={0}
        aria-label="Keyboard walk and attack test"
      />
      <div className="test-status" role="status">
        <span>{status.action}</span>
        {status.impact && <strong>IMPACT</strong>}
      </div>
      <div className="test-key-guide">
        <span>
          <kbd>W</kbd>
          <kbd>A</kbd>
          <kbd>S</kbd>
          <kbd>D</kbd> Walk
        </span>
        <span>
          <kbd>Space</kbd> Attack
        </span>
        <span>
          <kbd>Esc</kbd> Exit
        </span>
      </div>
    </div>
  );
}
