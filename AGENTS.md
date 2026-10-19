# Prototype Instructions

## User decisions

- App name: Sprite Sheet Animation.
- Personal-use app. No accounts, subscriptions, or public deployment.
- Recreate option A of the selected design: charcoal studio, lime accents, asset rail, three columns, checkerboard preview, bottom timeline.
- Use the supplied Pig.png as the initial character. Clearly distinguish procedural motion from AI generation.
- Walk needs articulated leg and body poses, not whole-image translation/scaling. Attacks differ by monster; retain per-action source rows, attack names, hit timing and non-looping attacks. Boar examples: charge and tusk strike.
- Test Play: WASD walks in four directions, A/D face left/right, Space triggers the selected monster attack once per press. Keep editor keyboard shortcuts outside test mode.
- Generate animation frames from the reviewed analysis profile via the existing authorized OpenRouter server connection. Keep the original reference, generated version and metadata; preview actual new pose frames before applying. Never silently substitute translated/scaled copies for generated art.

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

Build app UI in `src/`. Keep `.openai/hosting.json`, `worker/index.js`, `scripts/prepare-sites-build.mjs`, and `tests/sites-worker.test.mjs` intact so the same local prototype can be handed to Sites. Before a Sites handoff, run `npm run build` and `npm run test:sites`; the build must leave `dist/client/index.html`, `dist/server/index.js`, and `dist/.openai/hosting.json`.
