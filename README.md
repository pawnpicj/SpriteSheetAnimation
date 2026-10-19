# Sprite Sheet Animation

Personal sprite workshop, based on selected design A. Runs locally, with OpenRouter image analysis and automatic pose-sheet generation. The bundled v2 boar was prepared during development; new monster packs can now be generated in the app from reviewed profiles.

## Run

```powershell
npm install
npm run dev -- --host 127.0.0.1 --port 5186 --strictPort
```

Open http://127.0.0.1:5186. `start-app.cmd` starts the same app and opens it in your default browser.

## Workflow

- Click **Test Play** below the preview for a keyboard movement test. Hold **W/A/S/D** to move up/left/down/right; A/D set horizontal facing. Release movement to return to Idle. Press **Space** to play the selected attack once, with movement locked until recovery. Holding Space does not repeat attacks. **Esc** or **Exit Test** returns to the editor.
- Test Play uses the selected monster/attack and pose rows, with stage boundaries and focus-loss handling. It previews source clips, rather than current timeline-only edits. It requires Walk and Attack clips; raw single images cannot enter this mode. Editor shortcuts retain Space for play/pause and arrows for frame stepping outside Test Play.

- The default boar pack has Idle, an articulated Walk, and two distinct attacks: Charge and Tusk strike. Attacks play once by default and have individual frame durations for anticipation, impact and recovery.
- Pig.png is the supplied original. Single-character mode is limited to an Idle study. Walk and Attack require pose frames, and are disabled for raw single images.
- Upload Character supports PNG, JPG, WebP (20 MB maximum). Choose Sprite sheet to slice existing frames; set the source columns and rows before uploading. Select the row to play in Animation Settings.
- Load sample opens the v2 boar pack. It retains the original monster identity in a three-quarter view. Choose Attack type for Charge or Tusk strike. Use Hit frame to choose when contact occurs.
- Imported monster sheets have independent source-row mappings per action. On Attack, enter the monster's own attack name (e.g. Bite, Claw, Charge), select its row and hit frame. The app does not invent those poses from the name.
- Choose motion, frame size/count, FPS, loop, onion skin, or horizontal flip. Click a timeline frame to pause and inspect it. Duplicate and delete frames with the timeline buttons. Changing motion or generation parameters rebuilds frames and resets manual edits.
- Export PNG downloads a transparent horizontal strip. Export JSON includes frame rectangles, frame durations and, for attacks, the attack name, row and hit event. Hit indices in JSON are zero-based; the UI displays one-based frame numbers. Keep matching PNG/JSON files together. No automatic import into a game engine has been tested.
- Save project downloads an editable `.sprite.json` with embedded source image and edited frames. Open project restores it. Refreshing without saving resets the workspace.
- Ordinary import, playback and export stay local. **Analyze image** explicitly sends a prepared reference image to OpenRouter and consumes account credits. App and font assets load locally. Export transparency preserves the input alpha; opaque backgrounds are not automatically removed.

## Known directional-animation limitation

Test Play currently moves in four directions but reuses one Walk clip, with horizontal mirroring for A/D. W does not select rear-view artwork, so upward movement can look like sliding while facing the camera. True directional movement requires separate front/back/left/right pose clips and direction-aware Idle/Attack selection; this is not implemented yet. The included Slime project demonstrates single-orientation animation, not a complete four-direction character pack.

## OpenRouter monster analysis

Click **Analyze Monster**, review the image and optional notes, then **Analyze image**. The result includes visible anatomy, a proposed body plan, eight walk key poses, monster-specific attacks, uncertainties and an animation prompt. Edit and **Save motion profile**, then save the project to retain it. This does not generate new pose images or change existing sprite rows. Existing timeline edits are preserved when saving an analysis profile.

The local Vite server implements `/api/ai/status` and `/api/ai/analyze`; the browser never receives the API key. Configuration lives in ignored `.env.local`, using the variable names in `.env.example`. Model: `openai/gpt-6.1-sol`; reasoning: `medium`; OpenRouter attribution: `MyAppForAI`. Never use a `VITE_` prefix for the key. `.env.local` is excluded from Git and blocked from HTTP file serving. No credentials are embedded in project exports or the client build.

The analysis endpoint accepts only loopback hosts and same-origin requests, limits payload size and concurrent work, times out requests, validates structured results and sanitizes provider errors. The current integration is local-server functionality; the static Worker template does not provide this endpoint. Do not deploy it as a working hosted AI service without adding an appropriate backend and secrets management.

Offline protocol tests: `node --test tests/openrouter.test.mjs`. `scripts/check-live-analysis.mjs` is a manual live integration check and consumes API credits; it is deliberately excluded from automatic tests.

## Verification

```powershell
node --test tests/sprite-engine.test.mjs
npm run build
npm run test:sites
```

See `design-qa.md` for browser verification and visual comparison. Generated pose quality needs review. Automatic removal of opaque backgrounds from arbitrary uploaded artwork remains outside this version.

## Automatic frame generation

1. Upload a monster, Analyze image, and review the proposed profile.
2. Select **Generate animation frames** in the analysis dialog, or save the profile and choose **Generate Frames** in Project Assets.
3. Choose one of the profile's attacks and Medium/High quality. Click **Generate frames** once.
4. The local server creates one paid image job using `openai/gpt-image-2.5-sunburst`, a reference-image and transparency-capable endpoint verified in OpenRouter's model catalog. The analysis model remains `openai/gpt-6.1-sol` / medium. Set `OPENROUTER_IMAGE_MODEL` on the server to change the image model only to a compatible endpoint; no model substitution is automatic.
5. A 4-column × 6-row image contains 24 original poses: eight Idle, eight Walk and eight for the selected Attack. The browser detects complete connected silhouettes where possible, preserving long poses that cross a nominal grid line, then normalizes a shared scale and ground pivot into an 8 × 3 transparent sheet. Unknown layouts use validated grid extraction. Empty/opaque outputs, many clipped cells or highly duplicated Walk/Attack clips are rejected. These checks do not prove artistic or anatomical correctness.
6. Preview the actual new frames, then **Use frames in editor**. Walk/Attack, Test Play, PNG/JSON export and saved-project reopening use those generated poses. The original reference, analysis, prompt, model and version metadata are retained inside the saved project. Download the original generated sheet if manual cleanup is needed.

Endpoints: `POST /api/ai/generate`, `GET /api/ai/generation/:id`, `DELETE /api/ai/generation/:id`. Jobs run asynchronously; closing the generation dialog does not cancel them. Reopen it for the same reference to resume from session storage. Results remain in this local server process for up to 30 minutes and at most four recent completed jobs. Restarting the server loses in-memory jobs. Save the finished project to retain its images permanently. Cancel explicitly to request upstream cancellation. A completed output can still be billed; the app does not promise that cancellation always avoids charges.

Exactly one image is requested per job, with one concurrent job allowed. There is no automatic paid retry. A failed status check offers **Retry job status** without requesting a new image. Quality and timing can vary by model; there is no frame interpolation or automatic 4/8-direction synthesis. Creating another attack/version requires another explicit job. The local API key is used only by server middleware and remains outside the browser/export.

Verification: `node --test tests/generation.test.mjs tests/generated-frames.test.mjs`. `scripts/check-live-generation.mjs` makes one paid request unless an existing job ID is supplied; it is manual-only. The real Slime result and provenance are recorded in `qa/live-generation-results.json`.

API reference: https://openrouter.ai/docs/guides/overview/multimodal/image-generation
