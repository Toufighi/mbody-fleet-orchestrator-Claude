# Standalone Interactive Demo (single-file artifact)

`fleet-orchestrator-app.jsx` is a **self-contained React single-file version** of this
system, built for quick interactive preview (e.g. dropping into an environment that
renders a single React component with no build step, like a Claude.ai artifact).

**This is a separate, simplified reimplementation — not the same code as `../src/`.**
It re-derives the core logic (dual-constraint scheduling, FloorBot bucket uncertainty,
disruption-aware re-planning, HAL command/telemetry demos, LLM explain/assistant calls)
in one file with inline mock data, rather than importing the real modules under `../src/`.

Why two versions exist:
- `../src/` is the actual project: separated HAL adapters, scheduler, dispatcher,
  ML predictor, test suite, Express server — this is what the README, architecture
  diagram, and evaluation criteria are written against.
- `demo/fleet-orchestrator-app.jsx` is a portable single-file demo of the same ideas,
  useful for a quick walkthrough without `npm install` / a dev server.

If you change core logic (the scheduler's binding-constraint math, the FloorBot
uncertainty model, disruption timings), update both — they are **not** kept in sync
automatically.

To run the real project instead, see the root `README.md`.
