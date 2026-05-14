# Weld Preprocess Workbench V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a first usable web prototype for manual weld seam annotation, stage management, and laser torch pose preview against the provided manifold sample.

**Architecture:** Use a Vite React app with a focused domain layer for weld plan state, target-shape filtering, same-diameter assistance, and torch pose sampling. Use Three.js through React Three Fiber for a lightweight 3D scene, driven by sample manifold metadata rather than browser-side STEP parsing. Keep STEP preprocessing as a later backend slice, while preserving data shapes that can accept OpenCascade-derived metadata.

**Tech Stack:** React, TypeScript, Vite, Vitest, Three.js, React Three Fiber, Zustand.

---

## File Structure

- Create `package.json`: root scripts and dependencies.
- Create `index.html`, `vite.config.ts`, `tsconfig.json`, `tsconfig.node.json`: Vite TypeScript app configuration.
- Create `src/domain/types.ts`: weld plan, geometry candidate, and laser pose types.
- Create `src/domain/geometry.ts`: target-shape filtering, same-diameter selection, seam creation helpers.
- Create `src/domain/pose.ts`: reference-normal based torch pose sampling for line and circular seams.
- Create `src/domain/sampleManifold.ts`: lightweight sample geometry metadata matching the provided manifold.
- Create `src/state/workbenchStore.ts`: app state, stages, current tool, selected candidates, and pose settings.
- Create `src/components/Workbench.tsx`: top-level operational layout.
- Create `src/components/ToolPanel.tsx`: target shape and same-diameter controls.
- Create `src/components/StagePanel.tsx`: stage, seam group, order, and selected seam controls.
- Create `src/components/PosePanel.tsx`: reference normal and laser pose parameters.
- Create `src/components/Viewer3D.tsx`: 3D scene with manifold model, weld overlays, hover/selection, ghost torch preview.
- Create `src/styles.css`: app visual system.
- Create tests in `src/domain/*.test.ts`.

## Task 1: Project Scaffold

- [ ] Write minimal configuration files.
- [ ] Install dependencies.
- [ ] Run `npm test` baseline.

## Task 2: Domain Logic With TDD

- [ ] Write failing tests for target-shape filtering.
- [ ] Implement target-shape filtering.
- [ ] Write failing tests for same-diameter selection.
- [ ] Implement same-diameter selection.
- [ ] Write failing tests for circular torch pose sampling.
- [ ] Implement pose sampling.
- [ ] Run `npm test`.

## Task 3: Workbench State And Sample Geometry

- [ ] Write tests for creating a seam from selected candidates.
- [ ] Implement sample manifold metadata and store actions.
- [ ] Run `npm test`.

## Task 4: 3D Workbench UI

- [ ] Build restrained operational layout.
- [ ] Build 3D manifold approximation from metadata.
- [ ] Add hover, click selection, same-diameter highlight, and weld overlays.
- [ ] Add stage list, seam list, and pose parameter inspector.
- [ ] Add ghost torch preview and animation controls.

## Task 5: Verification

- [ ] Run `npm test`.
- [ ] Run `npm run build`.
- [ ] Start local dev server and report URL.
